"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import Link from "next/link";
import { db } from "../../_lib/db";
import type { Quiz, Question } from "../../_lib/types";
import QuizRunner from "../../_components/QuizRunner";
import { aiGradeEssay } from "../../actions";

export default function QuizTakePage(props: { params: Promise<{ id: string }> }) {
  var params = React.use(props.params);
  var quizId = params.id;
  var [quiz, setQuiz] = React.useState<Quiz | null>(null);
  var [questions, setQuestions] = React.useState<Question[]>([]);
  var [results, setResults] = React.useState<Record<string, { correct: boolean; feedback?: string }> | null>(null);

  React.useEffect(function() {
    if (!quizId) {
      return;
    }
    (async function() {
      var q = await db.getById("quizzes", quizId);
      setQuiz(q);
      var qs = (await db.listAll("questions", { quizId: quizId }, null)) as Question[];
      var mappedQs = qs.map(function(question) {
        if (question.kind === "mcq" || question.kind === "tf") {
          var explanations = null;
          if (question.rubric) {
            try {
              explanations = JSON.parse(question.rubric);
            } catch (_e) {}
          }
          return {
            ...question,
            explanations: explanations
          };
        }
        return question;
      });
      setQuestions(mappedQs);
    })();
  }, [quizId]);

  async function handleGradeEssay(questionId: string, answer: string): Promise<{ score: number; feedback: string } | null> {
    var question = await db.getById("questions", questionId);
    if (!question || !answer.trim()) {
      return null;
    }
    try {
      return await aiGradeEssay(question.prompt, question.rubric || "", answer);
    } catch (err) {
      return { score: 0, feedback: "Grading failed: " + String(err) };
    }
  }

  async function handleSubmit(answers: { questionId: string; answer: string }[]): Promise<void> {
    var newResults: Record<string, { correct: boolean; feedback?: string }> = {};
    var score = 0;
    for (var i = 0; i < answers.length; i++) {
      var a = answers[i];
      var question = await db.getById("questions", a.questionId);
      if (!question) {
        continue;
      }
      if (question.kind === "mcq" || question.kind === "tf") {
        var isCorrect = a.answer.trim().toLowerCase() === question.answer.trim().toLowerCase();
        newResults[a.questionId] = { correct: isCorrect };
        if (isCorrect) {
          score = score + 1;
        }
      } else {
        var essayGrade = await handleGradeEssay(a.questionId, a.answer);
        if (essayGrade) {
          var isPassed = essayGrade.score >= 50;
          newResults[a.questionId] = {
            correct: isPassed,
            feedback: "Score: " + essayGrade.score + "/100. Feedback: " + essayGrade.feedback
          };
          if (isPassed) {
            score = score + 1;
          }
        } else {
          newResults[a.questionId] = { correct: false, feedback: "No answer provided or grading failed" };
        }
      }
    }
    setResults(newResults);

    await db.insert("attempts", {
      quizId: quizId,
      score: Math.round((score / questions.length) * 100),
      answers: JSON.stringify(answers),
      gradedAt: new Date().toISOString()
    });
  }

  if (!quiz) {
    return (
      <AppShell>
        <p>Loading...</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHero
        eyebrow="Quiz"
        title={quiz.title}
        description={questions.length + " questions"}
        icon="ti-quiz"
      />

      <div className="back-link">
        <Link href="/study/quizzes" className="btn btn-sm">
          <i className="ti ti-arrow-left"></i>
          {" Back to Quizzes"}
        </Link>
      </div>

      <Card>
        <QuizRunner
          questions={questions}
          onSubmit={handleSubmit}
          onGradeEssay={handleGradeEssay}
          results={results}
        />
      </Card>
    </AppShell>
  );
}
