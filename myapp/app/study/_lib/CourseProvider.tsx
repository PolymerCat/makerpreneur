"use client";

import React from "react";
import { db } from "./db";
import type { Course } from "./types";

var ACTIVE_COURSE_KEY = "study_active_course";

type CourseContextValue = {
  activeCourse: Course | null;
  setActiveCourse: (course: Course) => void;
  clearActiveCourse: () => void;
};

var CourseContext = React.createContext<CourseContextValue>({
  activeCourse: null,
  setActiveCourse: function() {},
  clearActiveCourse: function() {}
});

export function useCourse(): CourseContextValue {
  return React.useContext(CourseContext);
}

export function CourseProvider(props: { children: React.ReactNode }): React.JSX.Element {
  var [activeCourse, setActiveCourseState] = React.useState<Course | null>(null);
  var [ready, setReady] = React.useState(false);

  React.useEffect(function() {
    (async function() {
      var savedId = localStorage.getItem(ACTIVE_COURSE_KEY);
      if (savedId) {
        try {
          var course = await db.getById("subjects", savedId);
          if (course) {
            setActiveCourseState(course);
          }
        } catch (_err) {
        }
      }
      setReady(true);
    })();
  }, []);

  function setActiveCourse(course: Course): void {
    localStorage.setItem(ACTIVE_COURSE_KEY, course.id);
    setActiveCourseState(course);
  }

  function clearActiveCourse(): void {
    localStorage.removeItem(ACTIVE_COURSE_KEY);
    setActiveCourseState(null);
  }

  if (!ready) {
    return <div className="loading-screen">Loading...</div>;
  }

  return (
    <CourseContext.Provider value={{ activeCourse: activeCourse, setActiveCourse: setActiveCourse, clearActiveCourse: clearActiveCourse }}>
      {props.children}
    </CourseContext.Provider>
  );
}
