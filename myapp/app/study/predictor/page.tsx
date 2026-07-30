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

export default function PredictorPage() {
  var { activeCourse } = useCourse();

  if (!activeCourse) {
    return <AppShell><CoursePicker /></AppShell>;
  }
  var courseId = activeCourse.id;

  var [materials, setMaterials] = React.useState<Material[]>([]);
  var [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  var [predictions, setPredictions] = React.useState<any[]>([]);
  var [savedPredictions, setSavedPredictions] = React.useState<Prediction[]>([]);
  var [activePredictionId, setActivePredictionId] = React.useState("");
  var [analyzing, setAnalyzing] = React.useState(false);
  var [language, setLanguage] = React.useState("en");
  var [activePrediction, setActivePrediction] = React.useState<Prediction | null>(null);

  React.useEffect(function() {
    (async function() {
      var allMats = await db.listAll("materials", { status: "ready", courseId: courseId }, "title");
      setMaterials(allMats);
      var allPreds = await db.listAll("predictions", { courseId: courseId }, null);
      setSavedPredictions(allPreds);
    })();
  }, [courseId]);

  async function handleAnalyze(): Promise<void> {
    setAnalyzing(true);
    try {
      var allText = "";
      for (var i = 0; i < selectedIds.length; i++) {
        allText = allText + (await db.materialText([selectedIds[i]])) + "\n\n";
      }
      var topicFreq = "Topics analyzed from " + selectedIds.length + " materials.";
      var courseName = "Demo Course";
      var predicted = await aiPredictQuestions(topicFreq, courseName, language);
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

  async function handleToggleStudied(index: number): Promise<void> {
    if (activePredictionId === "") {
      return;
    }
    var pred = await db.getById("predictions", activePredictionId);
    if (!pred) {
      return;
    }
    var studiedIds: string[] = [];
    try {
      studiedIds = JSON.parse(pred.studiedIds || "[]");
    } catch (_e) {
    }
    var idxStr = String(index);
    var found = false;
    var newStudied: string[] = [];
    for (var i = 0; i < studiedIds.length; i++) {
      if (studiedIds[i] === idxStr) {
        found = true;
      } else {
        newStudied.push(studiedIds[i]);
      }
    }
    if (!found) {
      newStudied.push(idxStr);
    }
    await db.update("predictions", activePredictionId, { studiedIds: JSON.stringify(newStudied) });
    var updatedPred = { ...pred, studiedIds: JSON.stringify(newStudied) };
    setActivePrediction(updatedPred);
  }

  var studiedIds: string[] = [];
  if (activePrediction) {
    try {
      studiedIds = JSON.parse(activePrediction.studiedIds || "[]");
    } catch (_e) {
    }
  }

  return (
    <AppShell>
      <PageHero
        eyebrow="Study"
        title="Exam Predictor"
        description="AI-powered exam question predictions based on your materials"
        icon="ti-crystal-ball"
      />
      <CourseBar />

      <Card>
        <h3>Source Materials</h3>
        <div className="predictor-controls">
          <div className="checkbox-group">
            {materials.map(function(mat: Material) {
              var isSelected = false;
              for (var i = 0; i < selectedIds.length; i++) {
                if (selectedIds[i] === mat.id) {
                  isSelected = true;
                  break;
                }
              }
              return (
                <label key={mat.id} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={function() {
                      var newSelected = selectedIds.slice();
                      if (isSelected) {
                        var idx = newSelected.indexOf(mat.id);
                        if (idx > -1) {
                          newSelected.splice(idx, 1);
                        }
                      } else {
                        newSelected.push(mat.id);
                      }
                      setSelectedIds(newSelected);
                    }}
                  />
                  {" " + mat.title}
                </label>
              );
            })}
          </div>
          <button
            className="btn btn-primary"
            onClick={handleAnalyze}
            disabled={selectedIds.length === 0 || analyzing}
          >
            {analyzing ? "Analyzing..." : "Predict Questions"}
          </button>
        </div>
      </Card>

      {savedPredictions.length > 0 ? (
        <Card>
          <h3>Saved Predictions</h3>
          <div className="saved-predictions">
            {savedPredictions.map(function(pred: Prediction) {
              return (
                <div key={pred.id} className={"saved-prediction" + (activePredictionId === pred.id ? " active" : "")}>
                  <button className="btn btn-sm" onClick={function() { handleSelectSaved(pred.id); }}>
                    {new Date(pred.createdAt).toLocaleDateString()}
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={function() { handleDeletePrediction(pred.id); }}>
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {predictions.length > 0 ? (
        <Card>
          <h3>Predicted Questions</h3>
          <div className="predictions-summary">
            <p>
              <span className="prob-high">● High</span>
              <span className="prob-medium">● Medium</span>
              <span className="prob-low">● Low</span>
            </p>
          </div>
          <div className="predictions-list">
            {predictions.map(function(pred: any, idx: number) {
              var isStudied = false;
              for (var i = 0; i < studiedIds.length; i++) {
                if (studiedIds[i] === String(idx)) {
                  isStudied = true;
                  break;
                }
              }
              var probClass = "prob-" + (pred.probability || "medium");
              return (
                <div key={idx} className={"prediction-card" + (isStudied ? " studied" : "")}>
                  <div className="prediction-card-header">
                    <span className={"probability-dot " + probClass}></span>
                    <strong>Q{idx + 1}: {pred.question}</strong>
                    <span className="marks-badge">{pred.marks || "?"} marks</span>
                  </div>
                  <details>
                    <summary>Model Answer</summary>
                    <p>{pred.modelAnswer || "N/A"}</p>
                  </details>
                  <button
                    className={"btn btn-sm " + (isStudied ? "btn-ghost" : "btn-primary")}
                    onClick={function() { handleToggleStudied(idx); }}
                  >
                    {isStudied ? "Marked Studied" : "Mark as Studied"}
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}
    </AppShell>
  );
}
