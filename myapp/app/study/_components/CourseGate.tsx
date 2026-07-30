"use client";

import React from "react";
import { useCourse } from "../_lib/CourseProvider";
import { CoursePicker } from "./CoursePicker";
import { CourseBar } from "./CourseBar";

export function CourseGate(props: { children: React.ReactNode }): React.JSX.Element {
  var { activeCourse } = useCourse();

  if (!activeCourse) {
    return <CoursePicker />;
  }

  return (
    <div className="study-course-layout">
      <div className="study-course-top">
        <CourseBar />
      </div>
      {props.children}
    </div>
  );
}
