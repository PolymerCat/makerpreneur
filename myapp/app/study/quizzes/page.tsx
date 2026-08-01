"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import Link from "next/link";
import { db } from "../_lib/db";
import type { Material, Quiz } from "../_lib/types";
import SourceSelector from "../_components/SourceSelector";
import { aiMakeQuiz } from "../actions";
import { useCourse } from "../_lib/CourseProvider";
import { CoursePicker } from "../_components/CoursePicker";
import { CourseBar } from "../_components/CourseBar";

export default function QuizzesPage() {
  var { activeCourse } = useCourse();

  if (!activeCourse) {
    return <AppShell><CoursePicker /></AppShell>;
  }
  var courseId = activeCourse.id;

  var [materials, setMaterials] = React.useState<Material[]>([]);
  var [quizzes, setQuizzes] = React.useState<Quiz[]>([]);
  var [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  var [questionCount, setQuestionCount] = React.useState(10);
  var [quizName, setQuizName] = React.useState("");
  var [generating, setGenerating] = React.useState(false);
  var [language, setLanguage] = React.useState("en");
  var [questionsCount, setQuestionsCount] = React.useState<Record<string, number>>({});
  var [sourceNames, setSourceNames] = React.useState<Record<string, string>>({});

  React.useEffect(function() {
    (async function() {
      var allMats = await db.listAll("materials", { status: "ready", courseId: courseId }, "title");
      setMaterials(allMats);
      var allQuizzes = await db.listAll("quizzes", null, null);
      setQuizzes(allQuizzes);
      var qCounts: Record<string, number> = {};
      var sNames: Record<string, string> = {};
      for (var i = 0; i < allQuizzes.length; i++) {
        var q = allQuizzes[i];
        var qs = await db.listAll("questions", { quizId: q.id }, null);
        qCounts[q.id] = qs.length;
        var mat = await db.getById("materials", q.materialId);
        sNames[q.id] = mat ? mat.title : "Unknown";
      }
      setQuestionsCount(qCounts);
      setSourceNames(sNames);
    })();
  }, []);

  async function handleGenerate(): Promise<void> {
    if (selectedIds.length === 0) {
      return;
    }
    setGenerating(true);
    try {
      var fullText = await db.materialText(selectedIds);
      var questions = await aiMakeQuiz(fullText, language, questionCount);
      var quizTitle = quizName.trim() || ("Quiz v" + (quizzes.length + 1));
      var quiz = await db.insert("quizzes", {
        materialId: selectedIds[0],
        title: quizTitle
      });
      for (var i = 0; i < questions.length; i++) {
        var rubricVal = "";
        if (questions[i].kind === "mcq" || questions[i].kind === "tf") {
          if (questions[i].explanations) {
            rubricVal = JSON.stringify(questions[i].explanations);
          }
        } else {
          rubricVal = questions[i].rubric || "";
        }
        await db.insert("questions", {
          quizId: quiz.id,
          kind: questions[i].kind,
          prompt: questions[i].prompt,
          options: questions[i].options || [],
          answer: questions[i].answer,
          rubric: rubricVal
        });
      }
      var allQuizzes = await db.listAll("quizzes", null, null);
      setQuizzes(allQuizzes);
      var qCounts = { ...questionsCount };
      var sNames = { ...sourceNames };
      qCounts[quiz.id] = questions.length;
      var mat = await db.getById("materials", quiz.materialId);
      sNames[quiz.id] = mat ? mat.title : "Unknown";
      setQuestionsCount(qCounts);
      setSourceNames(sNames);
      setQuizName("");
    } catch (err) {
      console.error("Generate quiz failed", err);
    }
    setGenerating(false);
  }

  return (
    <AppShell>
      <PageHero
        eyebrow="Study"
        title="Quizzes"
        description="Practice with AI-generated quizzes"
        icon="ti-quiz"
      />
      <CourseBar />

      <Card>
        <h3>Generate New Quiz</h3>
        <SourceSelector
          materials={materials}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          label="Source materials"
        />
        <div className="generate-controls">
          <div className="form-group">
            <label htmlFor="quiz-name">Quiz Name</label>
            <input
              id="quiz-name"
              type="text"
              value={quizName}
              onChange={function(e) { setQuizName(e.target.value); }}
              placeholder="e.g. QoS & QoE Practice Quiz"
            />
          </div>
          <div className="form-group">
            <label htmlFor="question-count">Questions: <strong>{questionCount}</strong></label>
            <input
              id="question-count"
              type="range"
              min={5}
              max={30}
              value={questionCount}
              onChange={function(e) { setQuestionCount(parseInt(e.target.value, 10)); }}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary generate-btn"
            onClick={handleGenerate}
            disabled={selectedIds.length === 0 || generating}
          >
            {generating ? "Generating..." : "Generate Quiz"}
          </button>
        </div>
      </Card>

      <Card>
        <h3>Your Quizzes</h3>
        <div className="quiz-grid">
          {quizzes.length === 0 ? (
            <p className="empty-state">No quizzes yet. Generate one above.</p>
          ) : null}
          {quizzes.map(function(quiz: Quiz) {
            var qCount = questionsCount[quiz.id] || 0;
            var sourceName = sourceNames[quiz.id] || "Unknown";
            return (
              <div key={quiz.id} className="quiz-card">
                <h4>{quiz.title}</h4>
                <p className="quiz-meta">From: {sourceName}</p>
                <p className="quiz-meta" style={{ marginBottom: "14px" }}>{qCount} questions</p>
                <Link href={"/study/quizzes/" + quiz.id} className="btn btn-primary btn-sm">
                  Take Quiz
                </Link>
              </div>
            );
          })}
        </div>
      </Card>
    </AppShell>
  );
}
