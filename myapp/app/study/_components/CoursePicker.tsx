"use client";

import React from "react";
import { db } from "../_lib/db";
import { useCourse } from "../_lib/CourseProvider";
import { useSession } from "@/lib/auth-context";
import { deleteStorageFiles } from "../actions";
import type { Course } from "../_lib/types";

export function CoursePicker(): React.JSX.Element {
  var { user, loading: authLoading } = useSession();
  var [courses, setCourses] = React.useState<Course[]>([]);
  var [loading, setLoading] = React.useState(true);
  var [showDialog, setShowDialog] = React.useState(false);
  var [newName, setNewName] = React.useState("");
  var [newCode, setNewCode] = React.useState("");
  var [newDesc, setNewDesc] = React.useState("");
  var [creating, setCreating] = React.useState(false);
  var [createError, setCreateError] = React.useState("");

  var [courseToDelete, setCourseToDelete] = React.useState<Course | null>(null);
  var [deleting, setDeleting] = React.useState(false);

  var { activeCourse, setActiveCourse, clearActiveCourse } = useCourse();

  React.useEffect(function() {
    if (!user) {
      setLoading(false);
      return;
    }
    (async function() {
      try {
        var allCourses = await db.listAll("subjects", { createdBy: user.id }, "name");
        setCourses(allCourses);
      } catch (err) {
        console.error("Failed to load subjects", err);
      }
      setLoading(false);
    })();
  }, [user]);

  async function handleCreate(): Promise<void> {
    if (newName.trim() === "" || !user) {
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      var course = await db.insert("subjects", {
        name: newName.trim(),
        subjectCode: newCode.trim() ? newCode.trim().toUpperCase() : null,
        description: newDesc.trim() || null,
        createdBy: user.id
      });
      setCourses(courses.concat([course]));
      setShowDialog(false);
      setNewName("");
      setNewCode("");
      setNewDesc("");
      setActiveCourse(course);
    } catch (err: any) {
      console.error("Create subject failed", err);
      if (err.message && err.message.includes("subjects_user_code_idx")) {
        setCreateError("A subject with this subject code already exists in your library.");
      } else {
        setCreateError(err.message || "Failed to create subject. Please try again.");
      }
    }
    setCreating(false);
  }

  async function handleDelete(): Promise<void> {
    if (!courseToDelete) return;
    var targetId = courseToDelete.id;
    setDeleting(true);
    try {
      // 1. Delete from subjects table (Postgres handles cascades to materials, chunks, etc.)
      await db.delete("subjects", targetId);

      // 2. Clean up storage folder for this subject if files exist
      try {
        var materials = await db.listAll("materials", { courseId: targetId }, null);
        var paths = materials.map(function(m: any) {
          if (m.fileUrl) {
            var parts = m.fileUrl.split("/materials/");
            if (parts.length > 1) return parts[1];
          }
          return null;
        }).filter(Boolean);
        if (paths.length > 0) {
          await deleteStorageFiles(paths);
        }
      } catch (_stErr) {
        // storage cleanup is best-effort
      }

      // 3. Update state
      setCourses(courses.filter(function(c) { return c.id !== targetId; }));
      if (activeCourse && activeCourse.id === targetId) {
        clearActiveCourse();
      }
      setCourseToDelete(null);
    } catch (err) {
      console.error("Delete subject failed", err);
    }
    setDeleting(false);
  }

  function handleSelect(course: Course): void {
    setActiveCourse(course);
  }

  if (authLoading || loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="course-picker-container">
        <div className="course-picker-empty" style={{ textAlign: "center", margin: "40px 0" }}>
          <p style={{ marginBottom: "16px", color: "var(--muted)", fontSize: "16px" }}>You must be signed in to create or select study subjects.</p>
          <a href="/signin" className="btn btn-primary" style={{ display: "inline-block", padding: "10px 24px" }}>
            Sign In to Study Hub
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="course-picker-container">
      <div className="course-picker-grid">
        {courses.map(function(course: Course) {
          return (
            <div key={course.id} className="course-card" onClick={function() { handleSelect(course); }} style={{ position: "relative" }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                title="Delete subject"
                style={{ position: "absolute", top: "12px", right: "12px", padding: "4px 8px", color: "var(--muted)" }}
                onClick={function(e) {
                  e.stopPropagation();
                  setCourseToDelete(course);
                }}
              >
                <i className="ti ti-trash"></i>
              </button>
              <div className="course-card-icon">
                <i className="ti ti-book"></i>
              </div>
              <div style={{ flex: 1, paddingRight: "20px" }}>
                {course.subjectCode ? (
                  <span className="badge badge-brand" style={{ marginBottom: "6px", display: "inline-block" }}>
                    {course.subjectCode}
                  </span>
                ) : null}
                <strong style={{ display: "block" }}>{course.name}</strong>
                {course.description ? (
                  <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px", margin: 0 }}>
                    {course.description}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}

        <button className="course-card course-card-add" onClick={function() { setShowDialog(true); }}>
          <div className="course-card-icon">
            <i className="ti ti-plus"></i>
          </div>
          <strong>New Subject</strong>
        </button>
      </div>

      {courses.length === 0 ? (
        <p className="course-picker-empty">
          No subjects yet. Click "New Subject" to create one.
        </p>
      ) : null}

      {showDialog ? (
        <div className="dialog-overlay" onClick={function() { setShowDialog(false); setCreateError(""); }}>
          <div className="dialog" onClick={function(e) { e.stopPropagation(); }}>
            <div className="dialog-header">
              <h3>New Subject</h3>
              <button className="btn btn-ghost btn-sm" onClick={function() { setShowDialog(false); setCreateError(""); }}>&times;</button>
            </div>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {createError ? (
                <div className="alert alert-error" style={{ fontSize: "13px", padding: "8px 12px" }}>
                  {createError}
                </div>
              ) : null}
              <label>
                Subject Name *
                <input
                  type="text"
                  value={newName}
                  onChange={function(e) { setNewName(e.target.value); }}
                  placeholder="e.g. Data Structures & Algorithms"
                  autoFocus
                />
              </label>
              <label>
                Subject Code (Optional)
                <input
                  type="text"
                  value={newCode}
                  onChange={function(e) { setNewCode(e.target.value); }}
                  placeholder="e.g. CST434"
                />
              </label>
              <label>
                Description (Optional)
                <input
                  type="text"
                  value={newDesc}
                  onChange={function(e) { setNewDesc(e.target.value); }}
                  placeholder="e.g. Core 4th year computer science subject"
                />
              </label>
            </div>
            <div className="dialog-footer">
              <button className="btn" onClick={function() { setShowDialog(false); setCreateError(""); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={newName.trim() === "" || creating}>
                {creating ? "Creating..." : "Create Subject"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {courseToDelete ? (
        <div className="dialog-overlay" onClick={function() { setCourseToDelete(null); }}>
          <div className="dialog" onClick={function(e) { e.stopPropagation(); }}>
            <div className="dialog-header">
              <h3>Delete Subject</h3>
              <button className="btn btn-ghost btn-sm" onClick={function() { setCourseToDelete(null); }}>&times;</button>
            </div>
            <div className="dialog-body">
              <p>Are you sure you want to delete <strong>{courseToDelete.name}</strong>?</p>
              <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "8px" }}>
                This will permanently delete this subject and all associated materials, flashcards, quizzes, and notes.
              </p>
            </div>
            <div className="dialog-footer">
              <button className="btn" onClick={function() { setCourseToDelete(null); }}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete Subject"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
