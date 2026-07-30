"use client";

import React from "react";
import { useCourse } from "../_lib/CourseProvider";

export function CourseBar(): React.JSX.Element | null {
  var { activeCourse, clearActiveCourse } = useCourse();

  if (!activeCourse) {
    return null;
  }

  return (
    <div className="course-bar">
      <span className="course-badge">
        {activeCourse.name}
      </span>
      <button className="btn btn-ghost btn-sm" onClick={clearActiveCourse}>
        Switch course
      </button>
    </div>
  );
}
