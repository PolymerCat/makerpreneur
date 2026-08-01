"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import { db } from "../_lib/db";
import type { ScheduleBlock } from "../_lib/types";
import { CourseBar } from "../_components/CourseBar";

var DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
var KIND_ICONS: Record<string, string> = {
  class: "🏫",
  study: "📚",
  exam: "✏️"
};

export default function PlannerPage() {
  var [blocks, setBlocks] = React.useState<ScheduleBlock[]>([]);
  var [weekStart, setWeekStart] = React.useState(getMonday(new Date()));
  var [showForm, setShowForm] = React.useState(false);
  var [formTitle, setFormTitle] = React.useState("");
  var [formKind, setFormKind] = React.useState("study");
  var [formDate, setFormDate] = React.useState("");
  var [formStart, setFormStart] = React.useState("09:00");
  var [formEnd, setFormEnd] = React.useState("10:00");

  async function loadBlocks(): Promise<void> {
    var allBlocks = await db.listAll("schedule_blocks", null, "startsAt");
    setBlocks(allBlocks);
  }

  React.useEffect(function() {
    (async function() {
      await loadBlocks();
    })();
  }, []);

  function getWeekDays(start: Date): Date[] {
    var days: Date[] = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }

  function getBlocksForDate(date: Date): ScheduleBlock[] {
    var dateStr = date.toISOString().substring(0, 10);
    return blocks.filter(function(b: ScheduleBlock) {
      return b.startsAt.substring(0, 10) === dateStr;
    });
  }

  function handlePreviousWeek(): void {
    var newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() - 7);
    setWeekStart(newStart);
  }

  function handleNextWeek(): void {
    var newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + 7);
    setWeekStart(newStart);
  }

  function handleAddBlock(): void {
    setShowForm(true);
  }

  async function handleSubmitForm(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (formTitle.trim() === "" || formDate === "") {
      return;
    }
    var startsAt = formDate + "T" + formStart + ":00";
    var endsAt = formDate + "T" + formEnd + ":00";
    await db.insert("schedule_blocks", {
      title: formTitle,
      kind: formKind,
      startsAt: startsAt,
      endsAt: endsAt
    });
    setShowForm(false);
    setFormTitle("");
    setFormKind("study");
    setFormDate("");
    setFormStart("09:00");
    setFormEnd("10:00");
    await loadBlocks();
  }

  async function handleDeleteBlock(blockId: string): Promise<void> {
    await db.delete("schedule_blocks", blockId);
    await loadBlocks();
  }

  var weekDays = getWeekDays(weekStart);
  var todayStr = new Date().toISOString().substring(0, 10);

  return (
    <AppShell>
      <PageHero
        eyebrow="Study"
        title="Planner"
        description="Weekly schedule planner"
        icon="ti-calendar"
      />

      <CourseBar />

      <Card>
        <div className="planner-header">
          <button className="btn btn-sm" onClick={handlePreviousWeek}>
            <i className="ti ti-chevron-left"></i>
            {" Previous"}
          </button>
          <h3>
            {weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            {" — "}
            {weekDays[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </h3>
          <button className="btn btn-sm" onClick={handleNextWeek}>
            {"Next "}
            <i className="ti ti-chevron-right"></i>
          </button>
        </div>

        <button className="btn btn-primary" onClick={handleAddBlock}>
          <i className="ti ti-plus"></i>
          {" Add Event"}
        </button>

        {showForm ? (
          <form className="planner-form" onSubmit={handleSubmitForm}>
            <label>
              Title:
              <input
                type="text"
                value={formTitle}
                onChange={function(e) { setFormTitle(e.target.value); }}
                required
              />
            </label>
            <label>
              Type:
              <select value={formKind} onChange={function(e) { setFormKind(e.target.value); }}>
                <option value="class">Class</option>
                <option value="study">Study</option>
                <option value="exam">Exam</option>
              </select>
            </label>
            <label>
              Date:
              <input
                type="date"
                value={formDate}
                onChange={function(e) { setFormDate(e.target.value); }}
                required
              />
            </label>
            <label>
              Start:
              <input
                type="time"
                value={formStart}
                onChange={function(e) { setFormStart(e.target.value); }}
              />
            </label>
            <label>
              End:
              <input
                type="time"
                value={formEnd}
                onChange={function(e) { setFormEnd(e.target.value); }}
              />
            </label>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Save</button>
              <button type="button" className="btn btn-ghost" onClick={function() { setShowForm(false); }}>
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </Card>

      <Card>
        <div className="week-grid">
          {weekDays.map(function(day: Date, idx: number) {
            var dayStr = day.toISOString().substring(0, 10);
            var dayBlocks = getBlocksForDate(day);
            var isToday = dayStr === todayStr;
            return (
              <div key={idx} className={"week-day" + (isToday ? " today" : "")}>
                <div className="day-header">
                  <span className="day-name">{DAY_NAMES[day.getDay()]}</span>
                  <span className="day-number">{day.getDate()}</span>
                  {dayBlocks.length > 0 ? (
                    <span className="event-count">{dayBlocks.length}</span>
                  ) : null}
                </div>
                <div className="day-blocks">
                  {dayBlocks.map(function(block: ScheduleBlock) {
                    var icon = KIND_ICONS[block.kind] || "📌";
                    var blockTime = block.startsAt.substring(11, 16) + "-" + block.endsAt.substring(11, 16);
                    return (
                      <div key={block.id} className={"block-item block-" + block.kind}>
                        <div className="block-header">
                          <span className="block-icon">{icon}</span>
                          <span className="block-title">{block.title}</span>
                        </div>
                        <span className="block-time">{blockTime}</span>
                        <button
                          className="btn btn-xs btn-ghost block-delete"
                          onClick={function() { handleDeleteBlock(block.id); }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                  {dayBlocks.length === 0 ? (
                    <p className="empty-day">No events</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </AppShell>
  );
}

function getMonday(date: Date): Date {
  var d = new Date(date);
  var day = d.getDay();
  var diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
