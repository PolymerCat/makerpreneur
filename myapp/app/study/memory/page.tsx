"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import { useCourse } from "../_lib/CourseProvider";
import { CoursePicker } from "../_components/CoursePicker";
import { CourseBar } from "../_components/CourseBar";
import { db } from "../_lib/db";
import { useSession } from "@/lib/auth-context";
import { aiSaveMemory, aiDeleteMemory } from "../actions";
import type { Memory } from "../_lib/types";

export default function MemoryManagerPage() {
  var { activeCourse } = useCourse();
  var { user } = useSession();

  var [memories, setMemories] = React.useState<Memory[]>([]);
  var [loading, setLoading] = React.useState(true);
  var [filterType, setFilterType] = React.useState<string>("all");

  // Form state
  var [newType, setNewType] = React.useState<string>("fact");
  var [newContent, setNewContent] = React.useState("");
  var [newTags, setNewTags] = React.useState("");
  var [submitting, setSubmitting] = React.useState(false);

  var loadMemories = React.useCallback(async function() {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      var courseId = activeCourse ? activeCourse.id : undefined;
      var list = await db.listMemories(user.id, courseId);
      setMemories(list as Memory[]);
    } catch (err) {
      console.error("loadMemories error:", err);
    } finally {
      setLoading(false);
    }
  }, [user, activeCourse]);

  React.useEffect(function() {
    loadMemories();
  }, [loadMemories]);

  if (!activeCourse) {
    return <AppShell><CoursePicker /></AppShell>;
  }

  async function handleAddMemory(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!newContent.trim() || submitting) return;
    setSubmitting(true);
    try {
      var tagsArray = newTags.split(",").map(function(t) { return t.trim(); }).filter(Boolean);
      var courseId = activeCourse ? activeCourse.id : null;
      var ok = await aiSaveMemory(courseId, newType, newContent.trim(), tagsArray);
      if (ok) {
        setNewContent("");
        setNewTags("");
        await loadMemories();
      }
    } catch (err) {
      console.error("handleAddMemory error:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    try {
      await aiDeleteMemory(id);
      setMemories(function(prev) { return prev.filter(function(m) { return m.id !== id; }); });
    } catch (err) {
      console.error("handleDelete error:", err);
    }
  }

  async function handleClearAll(): Promise<void> {
    if (!window.confirm("Are you sure you want to clear all non-episode memories for this course?")) {
      return;
    }
    try {
      var toDelete = memories.filter(function(m) { return m.type !== "episode"; });
      for (var i = 0; i < toDelete.length; i++) {
        await aiDeleteMemory(toDelete[i].id);
      }
      await loadMemories();
    } catch (err) {
      console.error("handleClearAll error:", err);
    }
  }

  var filteredMemories = memories.filter(function(m) {
    if (filterType === "all") return true;
    return m.type === filterType;
  });

  function getTypeBadgeClass(type: string): string {
    switch (type) {
      case "weakness": return "badge-red";
      case "fact": return "badge-blue";
      case "preference": return "badge-purple";
      case "goal": return "badge-green";
      case "episode": return "badge-amber";
      default: return "badge-secondary";
    }
  }

  return (
    <AppShell>
      <CourseBar />
      <PageHero
        eyebrow="AI Intelligence"
        title="Study Buddy Memory"
        description="View and manage the facts, weaknesses, goals, and session episodes Study Buddy has learned about your learning habits."
        icon="ti-brain"
      />

      <div className="study-container space-y-6 mt-6">
        {/* Form: Add Manual Memory */}
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <i className="ti ti-plus text-primary"></i> Add Manual Memory
          </h3>
          <form onSubmit={handleAddMemory} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-muted mb-1">Memory Type</label>
                <select
                  value={newType}
                  onChange={function(e) { setNewType(e.target.value); }}
                  className="input w-full"
                >
                  <option value="fact">Fact</option>
                  <option value="preference">Preference</option>
                  <option value="goal">Goal</option>
                  <option value="weakness">Weakness</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase text-muted mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. math, eigenvalues, exam-prep"
                  value={newTags}
                  onChange={function(e) { setNewTags(e.target.value); }}
                  className="input w-full"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-muted mb-1">Memory Content</label>
              <textarea
                rows={2}
                placeholder="e.g. Student prefers concise summaries in English and struggles with matrix diagonalisation."
                value={newContent}
                onChange={function(e) { setNewContent(e.target.value); }}
                className="input w-full"
                required
              />
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={submitting || !newContent.trim()} className="btn btn-primary btn-sm">
                <i className="ti ti-check"></i> {submitting ? "Saving..." : "Save Memory"}
              </button>
            </div>
          </form>
        </Card>

        {/* Filter & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {["all", "fact", "weakness", "preference", "goal", "episode"].map(function(type) {
              var label = type.charAt(0).toUpperCase() + type.slice(1);
              return (
                <button
                  key={type}
                  onClick={function() { setFilterType(type); }}
                  className={"btn btn-xs " + (filterType === type ? "btn-primary" : "btn-secondary")}
                >
                  {label} ({type === "all" ? memories.length : memories.filter(function(m) { return m.type === type; }).length})
                </button>
              );
            })}
          </div>

          {memories.length > 0 && (
            <button onClick={handleClearAll} className="btn btn-outline btn-danger btn-xs">
              <i className="ti ti-trash"></i> Clear Course Memories
            </button>
          )}
        </div>

        {/* Memories Grid */}
        {loading ? (
          <div className="p-8 text-center text-muted">
            <i className="ti ti-loader animate-spin text-2xl mb-2"></i>
            <p>Loading memories...</p>
          </div>
        ) : filteredMemories.length === 0 ? (
          <Card className="p-8 text-center text-muted">
            <i className="ti ti-brain-off text-4xl mb-3 opacity-50"></i>
            <p className="font-semibold">No memories found for this filter.</p>
            <p className="text-xs text-muted mt-1">Study Buddy will automatically learn facts as you chat and take quizzes!</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMemories.map(function(mem) {
              return (
                <Card key={mem.id} className="p-4 relative flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={"badge text-xs uppercase font-semibold " + getTypeBadgeClass(mem.type)}>
                        {mem.type}
                      </span>
                      <span className="text-xs text-muted">
                        <i className="ti ti-source"></i> {mem.source}
                      </span>
                    </div>

                    <p className="text-sm font-medium mb-3 whitespace-pre-wrap">{mem.content}</p>

                    {mem.tags && mem.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {mem.tags.map(function(t, idx) {
                          return (
                            <span key={idx} className="badge badge-secondary text-[10px]">
                              #{t}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted mt-2">
                    <span>{new Date(mem.createdAt).toLocaleDateString()}</span>
                    <button
                      onClick={function() { handleDelete(mem.id); }}
                      className="text-red-500 hover:text-red-700 font-semibold flex items-center gap-1"
                      title="Delete memory"
                    >
                      <i className="ti ti-trash"></i> Delete
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
