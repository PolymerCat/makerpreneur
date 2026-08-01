"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import { db } from "../_lib/db";
import type { Material, Prediction, GeneratedExam } from "../_lib/types";
import { aiPredictQuestions, aiGeneratePdfExam } from "../actions";
import { stripCitations } from "../_lib/ai/citations";
import { useCourse } from "../_lib/CourseProvider";
import { CoursePicker } from "../_components/CoursePicker";
import { CourseBar } from "../_components/CourseBar";
import SourceSelector from "../_components/SourceSelector";
import LanguageToggle from "../_components/LanguageToggle";

export default function PapersPage() {
  var { activeCourse } = useCourse();

  if (!activeCourse) {
    return <AppShell><CoursePicker /></AppShell>;
  }
  var courseId = activeCourse.id;

  var [activeTab, setActiveTab] = React.useState("predictor");
  var [allMaterials, setAllMaterials] = React.useState<Material[]>([]);
  var [materials, setMaterials] = React.useState<Material[]>([]);
  var [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  var [filter, setFilter] = React.useState("exam_paper");
  
  var [predictions, setPredictions] = React.useState<any[]>([]);
  var [savedPredictions, setSavedPredictions] = React.useState<Prediction[]>([]);
  var [activePredictionId, setActivePredictionId] = React.useState("");
  var [activePrediction, setActivePrediction] = React.useState<Prediction | null>(null);
  var [analyzing, setAnalyzing] = React.useState(false);
  var [language, setLanguage] = React.useState("en");

  var [numQuestions, setNumQuestions] = React.useState(4);
  var [generating, setGenerating] = React.useState(false);
  var [savedGeneratedExams, setSavedGeneratedExams] = React.useState<GeneratedExam[]>([]);

  function applyFilter(all: Material[], f: string): Material[] {
    if (f === "exam_paper") {
      return all.filter(function(m) { return m.category === "exam_paper"; });
    }
    return all;
  }

  React.useEffect(function() {
    (async function() {
      var allMats = await db.listAll("materials", { status: "ready", courseId: courseId }, "title");
      setAllMaterials(allMats);
      setMaterials(applyFilter(allMats, filter));
      
      var allPreds = await db.listAll("predictions", { courseId: courseId }, null);
      setSavedPredictions(allPreds);

      try {
        var allExams = await db.listGeneratedExams(courseId);
        setSavedGeneratedExams(allExams);
      } catch(e) {
        console.error("Failed to load generated exams", e);
      }
    })();
  }, [courseId]);

  function handleFilterChange(f: string): void {
    setFilter(f);
    setMaterials(applyFilter(allMaterials, f));
    setSelectedIds([]);
  }

  async function handleAnalyze(): Promise<void> {
    setAnalyzing(true);
    try {
      var allText = "";
      for (var i = 0; i < selectedIds.length; i++) {
        allText = allText + (await db.materialText([selectedIds[i]])) + "\n\n";
      }
      var courseTitle = activeCourse?.name || "Exam Course";
      var predicted = await aiPredictQuestions(allText, courseTitle, language);
      setPredictions(predicted);
      var pred = await db.insert("predictions", {
        courseId: courseId,
        createdAt: new Date().toISOString(),
        freqJson: JSON.stringify({}),
        questionsJson: JSON.stringify(predicted),
        studiedIds: JSON.stringify([])
      });
      var allPreds = await db.listAll("predictions", { courseId: courseId }, null);
      setSavedPredictions(allPreds);
    } catch (err) {
      console.error("Prediction failed", err);
    }
    setAnalyzing(false);
  }

  async function handleGeneratePdf(): Promise<void> {
    setGenerating(true);
    try {
      await aiGeneratePdfExam(courseId, selectedIds, undefined, undefined, numQuestions);
      var allExams = await db.listGeneratedExams(courseId);
      setSavedGeneratedExams(allExams);
      setActiveTab("saved");
      setNumQuestions(4);
      setSelectedIds([]);
    } catch (err) {
      console.error("PDF Generation failed", err);
      alert("Failed to generate PDF: " + String(err));
    }
    setGenerating(false);
  }

  async function handleSelectSaved(predictionId: string): Promise<void> {
    setActivePredictionId(predictionId);
    var pred = await db.getById("predictions", predictionId);
    setActivePrediction(pred);
    if (pred) {
      try {
        var qs = JSON.parse(pred.questionsJson);
        setPredictions(qs);
      } catch (_e) {
        setPredictions([]);
      }
    }
  }

  async function handleDeletePrediction(predictionId: string): Promise<void> {
    if (!window.confirm("Delete this prediction?")) {
      return;
    }
    await db.delete("predictions", predictionId);
    var allPreds = await db.listAll("predictions", { courseId: courseId }, null);
    setSavedPredictions(allPreds);
    if (activePredictionId === predictionId) {
      setActivePredictionId("");
      setActivePrediction(null);
      setPredictions([]);
    }
  }

  async function handleDeleteGeneratedExam(examId: string): Promise<void> {
    if (!window.confirm("Delete this generated exam?")) {
      return;
    }
    try {
      await db.deleteGeneratedExam(examId);
      var allExams = await db.listGeneratedExams(courseId);
      setSavedGeneratedExams(allExams);
    } catch (err) {
      console.error("Failed to delete exam", err);
    }
  }

  async function handleToggleStudied(idx: number): Promise<void> {
    if (!activePrediction) return;
    var studiedIds: string[] = [];
    try {
      studiedIds = JSON.parse(activePrediction.studiedIds || "[]");
    } catch (_e) {}

    var idxStr = String(idx);
    var pos = studiedIds.indexOf(idxStr);
    if (pos >= 0) {
      studiedIds.splice(pos, 1);
    } else {
      studiedIds.push(idxStr);
    }
    
    var updatedPred = await db.update("predictions", activePrediction.id, {
      studiedIds: JSON.stringify(studiedIds)
    });
    
    var allPreds = await db.listAll("predictions", { courseId: courseId }, null);
    setSavedPredictions(allPreds);
    setActivePrediction(updatedPred);
  }

  var studiedIds: string[] = [];
  if (activePrediction) {
    try {
      studiedIds = JSON.parse(activePrediction.studiedIds || "[]");
    } catch (_e) {}
  }

  return (
    <AppShell>
      <PageHero
        eyebrow="Study"
        title="Papers & Exam Generator"
        description="Predict exam questions or generate USM-style bilingual PDF exams."
        icon="ti-books"
      />
      <CourseBar />

      <div className="tab-bar">
        <button className={"tab" + (activeTab === "predictor" ? " active" : "")} onClick={function() { setActiveTab("predictor"); }}>Question Predictor</button>
        <button className={"tab" + (activeTab === "generator" ? " active" : "")} onClick={function() { setActiveTab("generator"); }}>USM PDF Exam Generator</button>
        <button className={"tab" + (activeTab === "saved" ? " active" : "")} onClick={function() { setActiveTab("saved"); }}>Saved Exams & Predictions</button>
      </div>

      {activeTab === "predictor" && (
        <div>
          <Card>
            <h3>Source Materials for Prediction</h3>
            <div className="tab-bar">
              <button className={"tab" + (filter === "exam_paper" ? " active" : "")} onClick={function() { handleFilterChange("exam_paper"); }}>Exam Papers</button>
              <button className={"tab" + (filter === "all" ? " active" : "")} onClick={function() { handleFilterChange("all"); }}>All Materials</button>
            </div>
            <SourceSelector materials={materials} selectedIds={selectedIds} onSelectionChange={setSelectedIds} label="Select Materials to Analyze" />
            <div className="predictor-controls">
              <LanguageToggle currentLanguage={language} onToggle={setLanguage} />
              <button className="btn btn-primary" onClick={handleAnalyze} disabled={selectedIds.length === 0 || analyzing}>
                {analyzing ? "Analyzing..." : "Predict Questions"}
              </button>
            </div>
          </Card>

          {predictions.length > 0 ? (
            <Card>
              <h3>Predicted Questions</h3>
              <div className="predictions-summary">
                <span className="prob-high">● High</span>
                <span className="prob-medium">● Medium</span>
                <span className="prob-low">● Low</span>
              </div>
              <div className="predictions-list">
                {predictions.map(function(pred: any, idx: number) {
                  var isStudied = false;
                  for (var i = 0; i < studiedIds.length; i++) {
                    if (studiedIds[i] === String(idx)) { isStudied = true; break; }
                  }
                  var probClass = "prob-" + (pred.probability || "medium");
                  return (
                    <div key={idx} className={"prediction-card" + (isStudied ? " studied" : "")}>
                      <div className="prediction-card-header">
                        <span className={"probability-dot " + probClass}></span>
                        <strong>Q{idx + 1}: {stripCitations(pred.question)}</strong>
                        <span className="marks-badge">{pred.marks || "?"} marks</span>
                      </div>
                      <details>
                        <summary>Model Answer</summary>
                        <p>{stripCitations(pred.modelAnswer || "N/A")}</p>
                      </details>
                      <button className={"btn btn-sm " + (isStudied ? "btn-ghost" : "btn-primary")} onClick={function() { handleToggleStudied(idx); }}>
                        {isStudied ? "Marked Studied" : "Mark as Studied"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : null}
        </div>
      )}

      {activeTab === "generator" && (
        <Card>
          <h3>Generate Bilingual USM Exam PDF</h3>
          <p style={{marginBottom: "1rem", color: "var(--text-secondary)"}}>
            Select reference past exam papers below. All uploaded course materials are silently included as the knowledge base syllabus.
          </p>
          <SourceSelector materials={materials.filter(function(m) { return m.category === "exam_paper"; })} selectedIds={selectedIds} onSelectionChange={setSelectedIds} label="Select Reference Past Papers" />
          
          <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem" }}>Number of Main Questions</label>
              <input type="number" className="input" value={numQuestions} onChange={function(e) { setNumQuestions(Number(e.target.value)); }} min={1} max={10} />
            </div>
          </div>

          <div style={{ marginTop: "1.5rem" }}>
            <button className="btn btn-primary" onClick={handleGeneratePdf} disabled={generating || selectedIds.length === 0}>
              {generating ? "Generating Exam PDF (Takes a minute)..." : "Generate Bilingual USM Exam PDF"}
            </button>
          </div>
        </Card>
      )}

      {activeTab === "saved" && (
        <div>
          <Card>
            <h3>Generated Exam PDFs</h3>
            {savedGeneratedExams.length > 0 ? (
              <div className="saved-predictions">
                {savedGeneratedExams.map(function(exam: GeneratedExam) {
                  return (
                    <div key={exam.id} className="saved-prediction">
                      <div style={{ flex: 1 }}>
                        <strong>{exam.courseCode} - {exam.title}</strong>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                          Created: {new Date(exam.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <a href={exam.fileUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary">
                          View / Download
                        </a>
                        <button className="btn btn-sm btn-ghost" onClick={function() { handleDeleteGeneratedExam(exam.id); }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p>No generated exams found.</p>
            )}
          </Card>
          
          <Card>
            <h3>Saved Question Predictions</h3>
            {savedPredictions.length > 0 ? (
              <div className="saved-predictions">
                {savedPredictions.map(function(pred: Prediction) {
                  var qCount = 0;
                  try { qCount = JSON.parse(pred.questionsJson).length; } catch (_e) {}
                  return (
                    <div key={pred.id} className={"saved-prediction" + (activePredictionId === pred.id ? " active" : "")}>
                      <button className="btn btn-sm" onClick={function() { handleSelectSaved(pred.id); }}>
                        {new Date(pred.createdAt).toLocaleDateString()} — {qCount} questions
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={function() { handleDeletePrediction(pred.id); }}>
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p>No saved predictions found.</p>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}
