"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import { db } from "../_lib/db";
import type { Material, Summary } from "../_lib/types";
import SourceSelector from "../_components/SourceSelector";
import { aiSummarize } from "../actions";
import { stripCitations } from "../_lib/ai/citations";
import { useCourse } from "../_lib/CourseProvider";
import { CoursePicker } from "../_components/CoursePicker";
import { CourseBar } from "../_components/CourseBar";

var MODES = [
  { value: "short", label: "Short", desc: "3-5 bullet points" },
  { value: "detailed", label: "Detailed", desc: "All key concepts" },
  { value: "study_guide", label: "Study Guide", desc: "Headings, terms, exam tips" }
];

export default function SummariesPage() {
  var { activeCourse } = useCourse();

  if (!activeCourse) {
    return <AppShell><CoursePicker /></AppShell>;
  }
  var courseId = activeCourse.id;

  var [materials, setMaterials] = React.useState<Material[]>([]);
  var [summaries, setSummaries] = React.useState<Summary[]>([]);
  var [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  var [mode, setMode] = React.useState("short");
  var [generating, setGenerating] = React.useState(false);
  var [language, setLanguage] = React.useState("en");
  var [sourceNames, setSourceNames] = React.useState<Record<string, string>>({});

  React.useEffect(function() {
    (async function() {
      var allMats = await db.listAll("materials", { status: "ready", courseId: courseId }, "title");
      setMaterials(allMats);
      var allSummaries = await db.listAll("summaries", null, "id");
      setSummaries(allSummaries);
      var sn: Record<string, string> = {};
      for (var i = 0; i < allSummaries.length; i++) {
        var mat = await db.getById("materials", allSummaries[i].materialId);
        sn[allSummaries[i].id] = mat ? mat.title : "Unknown";
      }
      setSourceNames(sn);
    })();
  }, []);

  async function handleGenerate(): Promise<void> {
    if (selectedIds.length === 0) {
      return;
    }
    setGenerating(true);
    try {
      var fullText = await db.materialText(selectedIds);
      var primaryId = selectedIds[0];
      var content = await aiSummarize(fullText, mode, language);
      await db.insert("summaries", {
        materialId: primaryId,
        mode: mode,
        language: language,
        content: content
      });
      var allSummaries = await db.listAll("summaries", null, "id");
      setSummaries(allSummaries);
    } catch (err) {
      console.error("Generate failed", err);
    }
    setGenerating(false);
  }

  var filtered = summaries.filter(function(s: Summary) {
    return s.mode === mode && s.language === language;
  });

  return (
    <AppShell>
      <PageHero
        eyebrow="Study"
        title="Summaries"
        description="Generate AI summaries from your materials"
        icon="ti-notes"
      />

      <CourseBar />

      <Card>
        <h3>Generate New Summary</h3>
        <SourceSelector
          materials={materials}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          label="Source materials"
        />
        <div className="mode-selector">
          {MODES.map(function(m) {
            return (
              <label key={m.value} className={"mode-option" + (mode === m.value ? " selected" : "")}>
                <input
                  type="radio"
                  name="summaryMode"
                  value={m.value}
                  checked={mode === m.value}
                  onChange={function() { setMode(m.value); }}
                />
                {" " + m.label}
                <span className="mode-desc">{m.desc}</span>
              </label>
            );
          })}
        </div>
        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={selectedIds.length === 0 || generating}
        >
          {generating ? "Generating..." : "Generate Summary"}
        </button>
      </Card>

      <Card>
        <h3>Saved Summaries</h3>
        {filtered.length === 0 ? (
          <p className="empty-state">No summaries yet. Generate one above.</p>
        ) : null}
        {filtered.map(function(s: Summary) {
          var sourceName = sourceNames[s.id] || "Unknown";
          return (
            <div key={s.id} className="summary-item">
              <p className="summary-source">Source: {sourceName}</p>
              <div className="summary-content">
                {stripCitations(s.content).split("\n").map(function(line, idx) {
                  return <p key={idx}>{line}</p>;
                })}
              </div>
            </div>
          );
        })}
      </Card>
    </AppShell>
  );
}
