"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import Link from "next/link";
import { db } from "./_lib/db";
import { useCourse } from "./_lib/CourseProvider";
import { CoursePicker } from "./_components/CoursePicker";
import { CourseBar } from "./_components/CourseBar";

var FEATURES = [
  { href: "/study/materials", icon: "ti-file-text", label: "Materials", desc: "Upload and index study materials" },
  { href: "/study/chat", icon: "ti-message", label: "Chat", desc: "Ask questions about your materials" },
  { href: "/study/summaries", icon: "ti-notes", label: "Summaries", desc: "Generate AI summaries" },
  { href: "/study/flashcards", icon: "ti-cards", label: "Flashcards", desc: "Create and review flashcards" },
  { href: "/study/quizzes", icon: "ti-quiz", label: "Quizzes", desc: "Practice with AI-generated quizzes" },
  { href: "/study/papers", icon: "ti-books", label: "Papers", desc: "Browse past exam papers and predict exam questions" },
  { href: "/study/path", icon: "ti-map-2", label: "Study Path", desc: "Generate study plans" },
  { href: "/study/planner", icon: "ti-calendar", label: "Planner", desc: "Weekly schedule planner" }
];

export default function StudyPage() {
  var { activeCourse } = useCourse();

  if (!activeCourse) {
    return (
      <AppShell>
        <PageHero
          eyebrow="Study"
          title="Choose a course"
          description="Select or create a course to get started with AI-powered study tools."
          icon="ti-school"
        />
        <CoursePicker />
      </AppShell>
    );
  }

  var titleText = "AI Study Hub";
  var descText = "RAG-powered study tools: chat with materials, flashcards, quizzes, and more";

  return (
    <AppShell>
      <PageHero
        eyebrow="Study"
        title={titleText}
        description={descText}
        icon="ti-school"
      />

      <CourseBar />

      <section className="feature-grid">
        {FEATURES.map(function(feature, index) {
          return (
            <Link key={index} href={feature.href} className="feature-card">
              <i className={"ti " + feature.icon}></i>
              <h3>{feature.label}</h3>
              <p>{feature.desc}</p>
            </Link>
          );
        })}
      </section>
    </AppShell>
  );
}
