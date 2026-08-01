"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import { db } from "../_lib/db";
import type { StudyPlan, PlanDay } from "../_lib/types";
import { aiMakeStudyPath } from "../actions";
import { useCourse } from "../_lib/CourseProvider";
import { CoursePicker } from "../_components/CoursePicker";
import { CourseBar } from "../_components/CourseBar";

export default function StudyPathPage() {
  var { activeCourse } = useCourse();

  if (!activeCourse) {
    return <AppShell><CoursePicker /></AppShell>;
  }

  var courseId = activeCourse.id;

  var [plans, setPlans] = React.useState<StudyPlan[]>([]);
  var [activePlanId, setActivePlanId] = React.useState("");
  var [generating, setGenerating] = React.useState(false);
  var [examDate, setExamDate] = React.useState("");
  var [goals, setGoals] = React.useState("");
  var [language, setLanguage] = React.useState("en");
  var [planDays, setPlanDays] = React.useState<PlanDay[]>([]);
  var [dayCounts, setDayCounts] = React.useState<Record<string, number>>({});

  React.useEffect(function() {
    (async function() {
      var allPlans = await db.listAll("study_plans", { courseId: courseId }, null);
      setPlans(allPlans);
      var counts: Record<string, number> = {};
      for (var i = 0; i < allPlans.length; i++) {
        var days = await db.listAll("plan_days", { planId: allPlans[i].id }, null);
        counts[allPlans[i].id] = days.length;
      }
      setDayCounts(counts);
    })();
  }, []);

  async function handleGenerate(): Promise<void> {
    if (examDate === "") {
      return;
    }
    setGenerating(true);
    try {
      var result = await aiMakeStudyPath("Demo Course", examDate, goals || "Pass the exam", language);
      var plan = await db.insert("study_plans", {
        courseId: courseId,
        examDate: examDate,
        goals: goals
      });
      for (var i = 0; i < result.days.length; i++) {
        var day = result.days[i];
        await db.insert("plan_days", {
          planId: plan.id,
          dayNumber: day.dayNumber,
          date: day.date,
          topic: day.topic,
          tasks: JSON.stringify(day.tasks),
          done: false
        });
      }
      var allPlans = await db.listAll("study_plans", { courseId: courseId }, null);
      setPlans(allPlans);
      setActivePlanId(plan.id);
      var days = await db.listAll("plan_days", { planId: plan.id }, "dayNumber");
      setPlanDays(days);
      setExamDate("");
      setGoals("");
    } catch (err) {
      console.error("Generate study path failed", err);
    }
    setGenerating(false);
  }

  async function handleSelectPlan(planId: string): Promise<void> {
    setActivePlanId(planId);
    var days = await db.listAll("plan_days", { planId: planId }, "dayNumber");
    setPlanDays(days);
  }

  async function handleToggleDone(dayId: string, currentDone: boolean): Promise<void> {
    await db.update("plan_days", dayId, { done: !currentDone });
    if (activePlanId) {
      var days = await db.listAll("plan_days", { planId: activePlanId }, "dayNumber");
      setPlanDays(days);
    }
  }

  async function handleDeletePlan(planId: string): Promise<void> {
    if (!window.confirm("Delete this study plan?")) {
      return;
    }
    var days = await db.listAll("plan_days", { planId: planId }, null);
    for (var i = 0; i < days.length; i++) {
      await db.delete("plan_days", days[i].id);
    }
    await db.delete("study_plans", planId);
    var allPlans = await db.listAll("study_plans", { courseId: courseId }, null);
    setPlans(allPlans);
    if (activePlanId === planId) {
      setActivePlanId("");
      setPlanDays([]);
    }
  }

  return (
    <AppShell>
      <PageHero
        eyebrow="Study"
        title="Study Path"
        description="Generate personalized study plans"
        icon="ti-map-2"
      />
      <CourseBar />

      <Card>
        <h3>Create Study Plan</h3>
        <div className="plan-form">
          <label>
            Exam date:
            <input
              type="date"
              value={examDate}
              onChange={function(e) { setExamDate(e.target.value); }}
            />
          </label>
          <label>
            Goals (optional):
            <textarea
              value={goals}
              onChange={function(e) { setGoals(e.target.value); }}
              placeholder="Pass with distinction"
              rows={2}
            />
          </label>
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={examDate === "" || generating}
          >
            {generating ? "Generating..." : "Generate Plan"}
          </button>
        </div>
      </Card>

      {plans.length > 0 ? (
        <Card>
          <h3>Saved Plans</h3>
          <div className="saved-plans">
            {plans.map(function(plan: StudyPlan) {
              var dayCount = dayCounts[plan.id] || 0;
              return (
                <div key={plan.id} className={"plan-card" + (activePlanId === plan.id ? " active" : "")}>
                  <div className="plan-info">
                    <p><strong>Exam: {new Date(plan.examDate).toLocaleDateString()}</strong></p>
                    <p>{dayCount} days</p>
                  </div>
                  <div className="plan-actions">
                    <button className="btn btn-sm" onClick={function() { handleSelectPlan(plan.id); }}>
                      View
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={function() { handleDeletePlan(plan.id); }}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {planDays.length > 0 ? (
        <Card>
          <h3>Study Plan</h3>
          <div className="plan-days">
            {planDays.map(function(day: PlanDay) {
              var tasksList: string[] = [];
              try {
                tasksList = JSON.parse(day.tasks || "[]");
              } catch (_e) {
                tasksList = [];
              }
              return (
                <div key={day.id} className={"plan-day" + (day.done ? " done" : "")}>
                  <div className="day-header">
                    <input
                      type="checkbox"
                      checked={day.done}
                      onChange={function() { handleToggleDone(day.id, day.done); }}
                    />
                    <strong>Day {day.dayNumber}</strong>
                    <span className="day-date">{day.date}</span>
                    <span className="day-topic">{day.topic}</span>
                  </div>
                  <ul className="day-tasks">
                    {tasksList.map(function(task: string, idx: number) {
                      return <li key={idx}>{task}</li>;
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}
    </AppShell>
  );
}
