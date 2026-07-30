"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import { db } from "../_lib/db";
import type { Material, Prediction } from "../_lib/types";
import { aiPredictQuestions } from "../actions";
import { useCourse } from "../_lib/CourseProvider";
import { CoursePicker } from "../_components/CoursePicker";
import { CourseBar } from "../_components/CourseBar";

export default function PapersPage() {
  var { activeCourse } = useCourse();

  if (!activeCourse) {
    return <AppShell><CoursePicker /></AppShell>;
  }
  var courseId = activeCourse.id;

  var [papers, setPapers] = React.useState<Material[]>([]);
  var [selectedPaperId, setSelectedPaperId] = React.useState("");
  var [analyzing, setAnalyzing] = React.useState(false);
  var [predictions, setPredictions] = React.useState<any[]>([]);
  var [activePrediction, setActivePrediction] = React.useState<string>("");

  React.useEffect(function() {
    (async function() {
      var examPapers = await db.listAll("materials", { category: "exam_paper", courseId: courseId }, "title");
      var regularPapers = await db.listAll("materials", { category: "regular", courseId: courseId }, "title");
      setPapers(examPapers.concat(regularPapers));
    })();
  }, []);

  async function handleAnalyze(): Promise<void> {
    if (selectedPaperId === "") {
      return;
    }
    setAnalyzing(true);
    try {
      var allText = await db.materialText([selectedPaperId]);
      var topicFreq = "Topics: biology, cells, DNA (high frequency), mitochondria, membrane (medium frequency)";
      var courseName = "Demo Course";
      var predicted = await aiPredictQuestions(topicFreq, courseName, "en");
      setPredictions(predicted);
      await db.insert("predictions", {
        courseId: courseId,
        createdAt: new Date().toISOString(),
        freqJson: JSON.stringify({}),
        questionsJson: JSON.stringify(predicted),
        studiedIds: JSON.stringify([])
      });
    } catch (err) {
      console.error("Analysis failed", err);
    }
    setAnalyzing(false);
  }

  var filteredPapers = papers.filter(function(p: Material) {
    return p.category === "exam_paper";
  });

  return (
    <AppShell>
      <PageHero
        eyebrow="Study"
        title="Papers"
        description="Browse past exam papers and predict future questions"
        icon="ti-books"
      />
      <CourseBar />

      <Card>
        <h3>Browse Exam Papers</h3>
        {filteredPapers.length === 0 ? (
          <p className="empty-state">
            No exam papers yet. Upload materials with category "Exam Paper" from the Materials page.
          </p>
        ) : null}
        <div className="paper-list">
          {filteredPapers.map(function(paper: Material) {
            return (
              <div key={paper.id} className="paper-row">
                <strong>{paper.title}</strong>
                <span className="paper-meta">{paper.year} / Sem {paper.semester}</span>
                <span className="status-badge status-ready">{paper.status}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <h3>Analyze & Predict</h3>
        <div className="analyze-controls">
          <select value={selectedPaperId} onChange={function(e) { setSelectedPaperId(e.target.value); }}>
            <option value="">Select a paper to analyze</option>
            {papers.map(function(p: Material) {
              return <option key={p.id} value={p.id}>{p.title}</option>;
            })}
          </select>
          <button
            className="btn btn-primary"
            onClick={handleAnalyze}
            disabled={selectedPaperId === "" || analyzing}
          >
            {analyzing ? "Analyzing..." : "Analyze & Predict"}
          </button>
        </div>

        {predictions.length > 0 ? (
          <div className="prediction-list">
            <h4>Predicted Questions</h4>
            {predictions.map(function(pred: any, idx: number) {
              var probClass = "prob-" + (pred.probability || "medium");
              return (
                <div key={idx} className="prediction-item">
                  <div className="prediction-header">
                    <span className={"probability-dot " + probClass}></span>
                    <strong>Q{idx + 1}: {pred.question}</strong>
                    <span className="marks-badge">{pred.marks || 0} marks</span>
                  </div>
                  <details>
                    <summary>Model Answer</summary>
                    <p>{pred.modelAnswer || "N/A"}</p>
                  </details>
                </div>
              );
            })}
          </div>
        ) : null}
      </Card>
    </AppShell>
  );
}
