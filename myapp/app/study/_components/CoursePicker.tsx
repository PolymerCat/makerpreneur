"use client";

import React from "react";
import { db } from "../_lib/db";
import { useCourse } from "../_lib/CourseProvider";
import type { Course } from "../_lib/types";

export function CoursePicker(): React.JSX.Element {
  var [courses, setCourses] = React.useState<Course[]>([]);
  var [loading, setLoading] = React.useState(true);
  var [showDialog, setShowDialog] = React.useState(false);
  var [newName, setNewName] = React.useState("");
  var [creating, setCreating] = React.useState(false);
  var { setActiveCourse } = useCourse();

  React.useEffect(function() {
    (async function() {
      var allCourses = await db.listAll("courses", null, "name");
      setCourses(allCourses);
      setLoading(false);
    })();
  }, []);

  async function handleCreate(): Promise<void> {
    if (newName.trim() === "") {
      return;
    }
    setCreating(true);
    try {
      var course = await db.insert("courses", {
        name: newName.trim()
      });
      setCourses(courses.concat([course]));
      setShowDialog(false);
      setNewName("");
      setActiveCourse(course);
    } catch (err) {
      console.error("Create course failed", err);
    }
    setCreating(false);
  }

  function handleSelect(course: Course): void {
    setActiveCourse(course);
  }

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  return (
    <div className="course-picker-container">
      <div className="course-picker-header">
        <h1>Study Hub</h1>
        <p>Select a course or create a new one to get started</p>
      </div>

      <div className="course-picker-grid">
        {courses.map(function(course: Course) {
          return (
            <button key={course.id} className="course-card" onClick={function() { handleSelect(course); }}>
              <div className="course-card-icon">
                <i className="ti ti-book"></i>
              </div>
              <strong>{course.name}</strong>
            </button>
          );
        })}

        <button className="course-card course-card-add" onClick={function() { setShowDialog(true); }}>
          <div className="course-card-icon">
            <i className="ti ti-plus"></i>
          </div>
          <strong>New Course</strong>
        </button>
      </div>

      {courses.length === 0 ? (
        <p className="course-picker-empty">
          No courses yet. Click "New Course" to create one.
        </p>
      ) : null}

      {showDialog ? (
        <div className="dialog-overlay" onClick={function() { setShowDialog(false); }}>
          <div className="dialog" onClick={function(e) { e.stopPropagation(); }}>
            <div className="dialog-header">
              <h3>New Course</h3>
              <button className="btn btn-ghost btn-sm" onClick={function() { setShowDialog(false); }}>&times;</button>
            </div>
            <div className="dialog-body">
              <label>
                Name
                <input
                  type="text"
                  value={newName}
                  onChange={function(e) { setNewName(e.target.value); }}
                  placeholder="e.g. Biology 101"
                  autoFocus
                />
              </label>
            </div>
            <div className="dialog-footer">
              <button className="btn" onClick={function() { setShowDialog(false); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={newName.trim() === "" || creating}>
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
