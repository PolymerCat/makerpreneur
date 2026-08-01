"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { useCourse } from "../_lib/CourseProvider";

export function CourseBar(): React.JSX.Element | null {
  var { activeCourse, clearActiveCourse } = useCourse();
  var pathname = usePathname();

  if (!activeCourse) {
    return null;
  }

  var isSubPage = pathname !== "/study";

  return (
    <div className="course-bar">
      {isSubPage ? (
        <Link href="/study" className="study-back-btn" title="Back to Study">
          <Icon name="ti-arrow-left" />
        </Link>
      ) : null}
      <span className="course-badge">
        {activeCourse.subjectCode ? activeCourse.subjectCode + " • " : ""}{activeCourse.name}
      </span>
      <button className="btn btn-ghost btn-sm" onClick={clearActiveCourse}>
        Switch course
      </button>
    </div>
  );
}
