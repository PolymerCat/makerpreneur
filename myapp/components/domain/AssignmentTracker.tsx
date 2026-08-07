"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/app/study/_lib/db";
import { useSession } from "@/lib/auth-context";
import type { Assignment } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

function AssignmentEditModal({ assignment, onClose, onSaved }: {
  assignment: Assignment;
  onClose: () => void;
  onSaved: () => void;
}) {
  var [title, setTitle] = useState(assignment.title);
  var [subject, setSubject] = useState(assignment.subject || "");
  var [deadlineDate, setDeadlineDate] = useState(assignment.deadline.slice(0, 10));
  var [deadlineTime, setDeadlineTime] = useState(assignment.deadline.slice(11, 16) || "23:59");
  var [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !deadlineDate) return;
    setSubmitting(true);
    try {
      var deadlineIso = new Date(deadlineDate + "T" + deadlineTime + ":00").toISOString();
      await db.update("assignments", assignment.id, {
        title: title.trim(),
        subject: subject.trim() || null,
        deadline: deadlineIso,
      });
      onSaved();
    } catch (err) {
      console.error("[ASSIGNMENTS] update error:", err);
    }
    setSubmitting(false);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <Card className="modal" style={{ padding: 22, maxWidth: 480 }} onClick={function(e) { e.stopPropagation(); }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="ti-edit" /> Edit Assignment
          </h3>
          <button className="small-action" type="button" onClick={onClose} aria-label="Close" style={{ cursor: "pointer" }}>
            <Icon name="ti-x" />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--muted)" }}>
              Assignment Title *
            </label>
            <input
              type="text"
              className="input"
              placeholder="e.g., FIN345 Individual Report"
              value={title}
              onChange={function(e) { setTitle(e.target.value); }}
              required
              style={{ width: "100%", height: 38, padding: "0 12px", border: "1px solid var(--line)", borderRadius: "var(--radius)", background: "var(--background)", color: "var(--foreground)" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--muted)" }}>
              Subject / Course
            </label>
            <input
              type="text"
              className="input"
              placeholder="e.g., FIN345"
              value={subject}
              onChange={function(e) { setSubject(e.target.value); }}
              style={{ width: "100%", height: 38, padding: "0 12px", border: "1px solid var(--line)", borderRadius: "var(--radius)", background: "var(--background)", color: "var(--foreground)" }}
            />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: "1 1 200px" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--muted)" }}>
                Deadline Date *
              </label>
              <input
                type="date"
                className="input"
                value={deadlineDate}
                onChange={function(e) { setDeadlineDate(e.target.value); }}
                required
                style={{ width: "100%", height: 38, padding: "0 12px", border: "1px solid var(--line)", borderRadius: "var(--radius)", background: "var(--background)", color: "var(--foreground)" }}
              />
            </div>
            <div style={{ flex: "1 1 100px" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--muted)" }}>
                Time
              </label>
              <input
                type="time"
                className="input"
                value={deadlineTime}
                onChange={function(e) { setDeadlineTime(e.target.value); }}
                style={{ width: "100%", height: 38, padding: "0 12px", border: "1px solid var(--line)", borderRadius: "var(--radius)", background: "var(--background)", color: "var(--foreground)" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} style={{ cursor: "pointer", height: 38, padding: "0 16px" }}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ height: 38, padding: "0 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Icon name="ti-device-floppy" /> Save
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function AssignmentTracker() {
  var { user } = useSession();
  var userId = user?.id || "";

  var [assignments, setAssignments] = useState<Assignment[]>([]);
  var [loading, setLoading] = useState(true);
  var [showForm, setShowForm] = useState(false);
  var [sortOrder, setSortOrder] = useState<"earliest" | "latest">("earliest");
  var [title, setTitle] = useState("");
  var [subject, setSubject] = useState("");
  var [deadlineDate, setDeadlineDate] = useState("");
  var [deadlineTime, setDeadlineTime] = useState("23:59");
  var [submitting, setSubmitting] = useState(false);
  var [editing, setEditing] = useState<Assignment | null>(null);

  async function loadAssignments() {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      var data = await db.listAll("assignments", { userId: userId }, "deadline");
      setAssignments(data || []);
    } catch (err) {
      console.error("[ASSIGNMENTS] load error:", err);
    }
    setLoading(false);
  }

  useEffect(function() {
    loadAssignments();
  }, [userId]);

  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !deadlineDate || !userId) return;
    setSubmitting(true);

    try {
      var deadlineIso = new Date(deadlineDate + "T" + deadlineTime + ":00").toISOString();
      
      // 1. Insert into assignments table
      await db.insert("assignments", {
        userId: userId,
        title: title.trim(),
        subject: subject.trim() || null,
        deadline: deadlineIso,
        status: "pending",
      });

      // 2. Mirror into main planner_events table so it automatically shows up in /planner
      try {
        var endIso = new Date(new Date(deadlineIso).getTime() + 30 * 60 * 1000).toISOString();
        await db.insert("planner_events", {
          userId: userId,
          title: "Assignment: " + title.trim() + (subject.trim() ? " (" + subject.trim() + ")" : ""),
          description: "Assignment deadline",
          location: "eLearn",
          event_type: "task",
          start_time: deadlineIso,
          end_time: endIso,
          rrule: null,
          google_event_id: null,
        });
      } catch (pErr) {
        console.warn("[ASSIGNMENTS] planner event mirror error:", pErr);
      }

      // Reset form & reload
      setTitle("");
      setSubject("");
      setDeadlineDate("");
      setDeadlineTime("23:59");
      setShowForm(false);
      await loadAssignments();
    } catch (err) {
      console.error("[ASSIGNMENTS] create error:", err);
    }
    setSubmitting(false);
  }

  async function handleToggleStatus(assignment: Assignment) {
    var newStatus: "pending" | "done" = assignment.status === "pending" ? "done" : "pending";
    try {
      await db.update("assignments", assignment.id, { status: newStatus });
      setAssignments(function(prev) {
        return prev.map(function(item) {
          return item.id === assignment.id ? { ...item, status: newStatus } : item;
        });
      });
    } catch (err) {
      console.error("[ASSIGNMENTS] toggle error:", err);
    }
  }

  async function handleDeleteAssignment(id: string) {
    try {
      await db.delete("assignments", id);
      setAssignments(function(prev) {
        return prev.filter(function(item) { return item.id !== id; });
      });
    } catch (err) {
      console.error("[ASSIGNMENTS] delete error:", err);
    }
  }

  var now = new Date();

  function formatDue(deadlineStr: string) {
    var d = new Date(deadlineStr);
    var diffMs = d.getTime() - now.getTime();
    var diffHours = Math.round(diffMs / (1000 * 60 * 60));
    var diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs < 0) {
      return { label: "Overdue", isOverdue: true };
    }
    if (diffHours <= 24) {
      return { label: "Due in " + Math.max(1, diffHours) + "h", isOverdue: false, isUrgent: true };
    }
    if (diffDays <= 3) {
      return { label: "Due in " + diffDays + " days", isOverdue: false, isUrgent: false };
    }
    return {
      label: "Due " + d.toLocaleDateString([], { month: "short", day: "numeric" }),
      isOverdue: false,
      isUrgent: false,
    };
  }

  function formatFullDateTime(deadlineStr: string) {
    var d = new Date(deadlineStr);
    return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" })
      + " at "
      + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  var pendingItems = assignments
    .filter(function(a) { return a.status === "pending"; })
    .sort(function(a, b) {
      var diff = new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      return sortOrder === "earliest" ? diff : -diff;
    });
  var doneItems = assignments
    .filter(function(a) { return a.status === "done"; })
    .sort(function(a, b) {
      return new Date(b.deadline).getTime() - new Date(a.deadline).getTime();
    });
  var allItems = pendingItems.concat(doneItems);

  return (
    <Card style={{ padding: 18, overflow: "hidden", maxWidth: "100%" }}>
      {editing && (
        <AssignmentEditModal
          assignment={editing}
          onClose={function() { setEditing(null); }}
          onSaved={function() { setEditing(null); loadAssignments(); }}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 28, color: "var(--brand)" }}>
            <Icon name="ti-alarm" />
          </span>
          <div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Assignment Tracker</h3>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>Tasks & deadlines with automatic planner sync</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            title={sortOrder === "earliest" ? "Showing earliest first — click for latest" : "Showing latest first — click for earliest"}
            onClick={function() { setSortOrder(function(o) { return o === "earliest" ? "latest" : "earliest"; }); }}
            style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--muted)", userSelect: "none" }}
          >
            <Icon name={sortOrder === "earliest" ? "ti-sort-ascending" : "ti-sort-descending"} />
            {sortOrder === "earliest" ? "Earliest" : "Latest"}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={function() { setShowForm(!showForm); }}
            style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
          >
            <Icon name={showForm ? "ti-x" : "ti-plus"} />
            {showForm ? "Close" : "Add Assignment"}
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreateAssignment} style={{ border: "2px solid var(--line)", background: "var(--surface)", padding: 16, borderRadius: "var(--radius)", marginBottom: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "2 1 200px" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--muted)" }}>
                Assignment Title *
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g., FIN345 Individual Report"
                value={title}
                onChange={function(e) { setTitle(e.target.value); }}
                required
                style={{ width: "100%", height: 38, padding: "0 12px", border: "1px solid var(--line)", borderRadius: "var(--radius)", background: "var(--background)", color: "var(--foreground)" }}
              />
            </div>
            <div style={{ flex: "1 1 140px" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--muted)" }}>
                Subject / Course
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g., FIN345"
                value={subject}
                onChange={function(e) { setSubject(e.target.value); }}
                style={{ width: "100%", height: 38, padding: "0 12px", border: "1px solid var(--line)", borderRadius: "var(--radius)", background: "var(--background)", color: "var(--foreground)" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 140px" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--muted)" }}>
                Deadline Date *
              </label>
              <input
                type="date"
                className="input"
                value={deadlineDate}
                onChange={function(e) { setDeadlineDate(e.target.value); }}
                required
                style={{ width: "100%", height: 38, padding: "0 12px", border: "1px solid var(--line)", borderRadius: "var(--radius)", background: "var(--background)", color: "var(--foreground)" }}
              />
            </div>
            <div style={{ flex: "1 1 100px" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--muted)" }}>
                Time
              </label>
              <input
                type="time"
                className="input"
                value={deadlineTime}
                onChange={function(e) { setDeadlineTime(e.target.value); }}
                style={{ width: "100%", height: 38, padding: "0 12px", border: "1px solid var(--line)", borderRadius: "var(--radius)", background: "var(--background)", color: "var(--foreground)" }}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ height: 38, padding: "0 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Icon name="ti-check" /> Save
            </button>
          </div>
        </form>
      )}

      {/* Assignment List */}
      {loading ? (
        <div style={{ padding: "20px 0", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
          Loading assignments…
        </div>
      ) : allItems.length === 0 ? (
        <div style={{ padding: "24px 16px", textAlign: "center", background: "var(--surface)", border: "1px dashed var(--line)", borderRadius: "var(--radius)" }}>
          <span style={{ fontSize: 28, color: "var(--muted)", marginBottom: 6, display: "inline-block" }}>
            <Icon name="ti-clipboard-check" />
          </span>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>No assignments tracked yet</p>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Click &quot;Add Assignment&quot; above to track your deadlines.</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {allItems.map(function(item) {
            var isDone = item.status === "done";
            var dueInfo = formatDue(item.deadline);
            return (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  padding: "10px 14px",
                  borderRadius: "var(--radius)",
                  border: !isDone && dueInfo.isOverdue ? "1px solid #ef4444" : "1px solid var(--line)",
                  background: !isDone && dueInfo.isOverdue ? "rgba(239, 68, 68, 0.05)" : "var(--surface)",
                  opacity: isDone ? 0.65 : 1,
                  gap: 10,
                }}
              >
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 14, textDecoration: isDone ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.title}
                    </strong>
                    {item.subject && (
                      <Badge tone="neutral">{item.subject}</Badge>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                    {isDone ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Completed</span>
                    ) : (
                      <>
                        <span style={{ fontSize: 12, fontWeight: 600, color: dueInfo.isOverdue ? "#ef4444" : dueInfo.isUrgent ? "var(--brand)" : "var(--muted)" }}>
                          {dueInfo.label}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--muted)", opacity: 0.7 }}>
                          {formatFullDateTime(item.deadline)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {!isDone && (
                    <>
                      {dueInfo.isOverdue ? (
                        <Badge tone="warning">Overdue</Badge>
                      ) : dueInfo.isUrgent ? (
                        <Badge tone="brand">Urgent</Badge>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-xs btn-primary"
                        onClick={function() { handleToggleStatus(item); }}
                        style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                        title="Mark as completed"
                      >
                        <Icon name="ti-circle-check" /> Mark as completed
                      </button>
                    </>
                  )}
                  {isDone && (
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost"
                      onClick={function() { handleToggleStatus(item); }}
                      style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                      title="Reopen"
                    >
                      <Icon name="ti-rotate-left" /> Reopen
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-xs btn-ghost"
                    onClick={function() { setEditing(item); }}
                    style={{ cursor: "pointer", opacity: 0.6, fontSize: 18, padding: "4px 8px" }}
                    title="Edit Assignment"
                  >
                    <Icon name="ti-edit" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-xs btn-ghost"
                    onClick={function() { handleDeleteAssignment(item.id); }}
                    style={{ cursor: "pointer", opacity: 0.6, fontSize: 18, padding: "4px 8px" }}
                    title="Delete Assignment"
                  >
                    <Icon name="ti-trash" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
