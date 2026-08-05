"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Icon } from "@/components/ui/Icon";
import { useSession } from "@/lib/auth-context";
import { db } from "../_lib/db";
import { renderMarkdown } from "../_lib/render-markdown";
import { useCourse } from "../_lib/CourseProvider";
import { CoursePicker } from "../_components/CoursePicker";
import { CourseBar } from "../_components/CourseBar";
import { aiExtractMemory, aiGradeEssay } from "../actions";
import type { Material } from "../_lib/types";

var STREAM_URL = "/study/api/chat";
var IMAGE_MAX_COUNT = 5;
var IMAGE_MAX_SIZE = 8 * 1024 * 1024;
var IMAGE_MAX_DIM = 2048; // Gemini downsamples to 3072 max; 2048 keeps math legible, half the bytes

var SUGGESTIONS = [
  "What is mMTC in 5G?",
  "Explain eigenvalues and eigenvectors",
  "Summarize the Krebs cycle",
  "What are Newton's three laws of motion?"
];

type ChatMessage = { role: string; content: string };
type Attachment = { id: string; name: string; objectUrl: string; file: File };
type Conversation = {
  id: string;
  userId: string;
  title: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
};

type SSEEvent =
  | { type: "tool_start"; tool: string }
  | { type: "tool_end"; tool: string; durationMs: number }
  | { type: "text"; content: string }
  | { type: "done"; toolCount: number };

type ToolActivity = { tool: string; status: "running" | "done"; durationMs: number };
type ArtifactMatch =
  | { kind: "deck"; id: string }
  | { kind: "quiz"; id: string }
  | { kind: "pdf"; url: string };

var ARTIFACT_RE = /<https?:\/\/[^>\s]+\/study\/flashcards\/([0-9a-f-]{8,})>|<https?:\/\/[^>\s]+\/study\/quizzes\/([0-9a-f-]{8,})>|\[([^\]]*)\]\(([^)\s]+)\)|\/study\/flashcards\/([0-9a-f-]{8,})|\/study\/quizzes\/([0-9a-f-]{8,})|https?:\/\/[^\s()]+\.pdf/gi;

var WIDGET_STYLE: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.05)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: "14px",
  padding: "14px 16px",
  margin: "10px 0 12px",
  backdropFilter: "blur(10px)",
  boxShadow: "0 6px 24px rgba(0, 0, 0, 0.25)"
};

var WIDGET_HEAD_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  marginBottom: "10px"
};

var WIDGET_TITLE_STYLE: React.CSSProperties = { fontWeight: 600, fontSize: "15px" };

var WIDGET_META_STYLE: React.CSSProperties = {
  marginLeft: "auto",
  fontSize: "12px",
  opacity: 0.7
};

var WIDGET_CTA_STYLE: React.CSSProperties = {
  display: "inline-block",
  marginTop: "10px",
  padding: "8px 14px",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#0f172a",
  border: "1px solid #cbd5e1",
  fontWeight: 600,
  textDecoration: "none",
  fontSize: "13px",
  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.08)"
};

var WIDGET_CARD_STYLE: React.CSSProperties = {
  background: "rgba(0, 0, 0, 0.35)",
  border: "1px solid rgba(255, 255, 255, 0.15)",
  borderRadius: "10px",
  padding: "10px 12px",
  color: "inherit",
  font: "inherit",
  textAlign: "left",
  cursor: "pointer",
  width: "100%",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "block"
};

var WIDGET_PILL_STYLE: React.CSSProperties = {
  display: "inline-block",
  background: "rgba(255, 255, 255, 0.08)",
  border: "1px solid rgba(255, 255, 255, 0.15)",
  borderRadius: "999px",
  padding: "4px 10px",
  margin: "0 6px 6px 0",
  fontSize: "12px"
};

function formatDate(iso: string): string {
  var d = new Date(iso);
  var now = new Date();
  var isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    var h = d.getHours();
    var m = d.getMinutes();
    var ampm = h >= 12 ? "PM" : "AM";
    var h12 = h % 12 || 12;
    return "Today " + h12 + ":" + (m < 10 ? "0" : "") + m + " " + ampm;
  }
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[d.getMonth()] + " " + d.getDate();
}

function humanizeTool(tool: string): string {
  var words = tool.split("_");
  var parts: string[] = [];
  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    parts.push(w.charAt(0).toUpperCase() + w.slice(1));
  }
  return parts.join(" ");
}

function ToolSpinner(): React.ReactNode {
  return (
    <span
      className="chat-widget-spinner"
      aria-label="running"
      style={{
        display: "inline-block",
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        border: "2px solid rgba(255, 255, 255, 0.25)",
        borderTopColor: "#fff",
        animation: "chatSpin 0.8s linear infinite"
      }}
    />
  );
}

function humanizeToolInfo(tool: string): { title: string; desc: string; icon: string } {
  switch (tool) {
    case "search_material":
      return { title: "Searching Course Material", desc: "Searching uploaded lecture notes & slides", icon: "ti-search" };
    case "search_memory":
      return { title: "Checking Student Memory", desc: "Retrieving user preferences & past weaknesses", icon: "ti-brain" };
    case "save_memory":
      return { title: "Saving Study Memory", desc: "Storing new learning memory for future sessions", icon: "ti-bookmark" };
    case "generate_flashcards":
      return { title: "Generating Flashcard Deck", desc: "Extracting key terms & creating Q&A cards", icon: "ti-cards" };
    case "generate_quiz":
      return { title: "Crafting Practice Quiz", desc: "Generating multiple choice & practice questions", icon: "ti-quiz" };
    case "get_exam_readiness":
      return { title: "Calculating Exam Readiness", desc: "Analyzing attempt history & readiness score", icon: "ti-chart-bar" };
    case "get_study_plan":
      return { title: "Generating Study Plan", desc: "Creating day-by-day revision schedule", icon: "ti-calendar" };
    case "search_past_papers":
      return { title: "Scanning Past Papers", desc: "Matching exam questions & solution keys", icon: "ti-files" };
    case "translate_text":
      return { title: "Translating Material", desc: "Converting content to target language", icon: "ti-language" };
    case "generate_exam_paper":
      return { title: "Synthesizing Practice Exam PDF", desc: "Compiling printable practice exam document", icon: "ti-file-text" };
    default:
      return { title: humanizeTool(tool), desc: "Executing tool operation", icon: "ti-settings" };
  }
}

function ToolActivityStrip(props: { activity: ToolActivity[]; isSearching?: boolean }): React.ReactNode {
  if (!props.activity || props.activity.length === 0) {
    return (
      <React.Fragment>
        <style>{`
          @keyframes chatSpin { to { transform: rotate(360deg); } }
          @keyframes pulseGlow { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        `}</style>
        <div style={{
          background: "#1e293b",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "14px",
          padding: "12px 16px",
          margin: "8px 0 12px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          fontSize: "13px",
          boxShadow: "0 6px 20px rgba(0, 0, 0, 0.2)"
        }}>
          <ToolSpinner />
          <span style={{ fontWeight: 600, color: "#f8fafc", animation: "pulseGlow 2s infinite" }}>
            {props.isSearching ? "Searching course materials..." : "Study Buddy is thinking..."}
          </span>
        </div>
      </React.Fragment>
    );
  }

  var runningTool = props.activity.find(function(t) { return t.status === "running"; });
  var activeInfo = runningTool ? humanizeToolInfo(runningTool.tool) : null;

  return (
    <React.Fragment>
      <style>{`
        @keyframes chatSpin { to { transform: rotate(360deg); } }
        @keyframes pulseGlow { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes stepFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="chat-widget chat-widget-tools" style={{
        background: "#1e293b",
        border: "1px solid rgba(255, 255, 255, 0.14)",
        borderRadius: "14px",
        padding: "14px 16px",
        margin: "10px 0 12px",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.25)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", paddingBottom: "8px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <div style={{
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            background: "#6366f1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            fontSize: "12px"
          }}>
            <Icon name={activeInfo ? activeInfo.icon : "ti-sparkles"} />
          </div>
          <span style={{ fontWeight: 600, fontSize: "13px", color: "#f8fafc" }}>
            {activeInfo ? activeInfo.title : "Study Buddy Working..."}
          </span>
          <span style={{ marginLeft: "auto", fontSize: "11px", color: "#94a3b8", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            {runningTool ? <ToolSpinner /> : <Icon name="ti-check" />}
            {runningTool ? "In Progress" : "Done"}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {props.activity.map(function(t, i) {
            var info = humanizeToolInfo(t.tool);
            var isDone = t.status === "done";
            return (
              <div
                key={t.tool + "-" + i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  borderRadius: "8px",
                  background: isDone ? "rgba(255, 255, 255, 0.03)" : "rgba(99, 102, 241, 0.14)",
                  border: isDone ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(99, 102, 241, 0.35)",
                  fontSize: "12px",
                  animation: "stepFadeIn 0.25s ease-out"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{
                    color: isDone ? "#10b981" : "#6366f1",
                    display: "flex",
                    alignItems: "center"
                  }}>
                    {isDone ? <Icon name="ti-check" /> : <ToolSpinner />}
                  </span>
                  <span style={{ fontWeight: isDone ? 500 : 600, color: isDone ? "#cbd5e1" : "#ffffff" }}>
                    {info.title}
                  </span>
                </div>

                {!isDone ? (
                  <span style={{ color: "#a5b4fc", fontSize: "11px", fontStyle: "italic", animation: "pulseGlow 1.5s infinite" }}>
                    {info.desc}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </React.Fragment>
  );
}

import FlashcardReview from "../_components/FlashcardReview";

function FlashcardCard(props: { deckId: string }): React.ReactNode {
  var deckId = props.deckId;
  var [deck, setDeck] = React.useState<any | null>(null);
  var [cards, setCards] = React.useState<any[]>([]);
  var [viewIndex, setViewIndex] = React.useState(0);
  var [isFlipped, setIsFlipped] = React.useState(false);
  var [focusMode, setFocusMode] = React.useState(false);
  var [failed, setFailed] = React.useState(false);

  React.useEffect(function() {
    var cancelled = false;
    (async function() {
      try {
        var d = await db.getById("decks", deckId);
        var c = await db.listAll("cards", { deckId: deckId }, null);
        if (!cancelled) {
          if (d) {
            setDeck(d);
            setCards(c || []);
          } else {
            setFailed(true);
          }
        }
      } catch (_err) {
        if (!cancelled) {
          setFailed(true);
        }
      }
    })();
    return function() { cancelled = true; };
  }, [deckId]);

  async function handleUpdateCard(cardId: string, updates: any): Promise<void> {
    await db.update("cards", cardId, updates);
  }

  if (failed) {
    return (
      <a className="chat-widget chat-widget-fallback" href={"/study/flashcards/" + deckId} style={Object.assign({}, WIDGET_STYLE, { textDecoration: "underline" })}>
        Practice this deck &rarr;
      </a>
    );
  }
  if (!deck || cards.length === 0) {
    return null;
  }

  var currentCard = cards[Math.min(viewIndex, cards.length - 1)];

  return (
    <React.Fragment>
      {focusMode ? (
        <FlashcardReview
          cards={cards}
          onUpdateCard={handleUpdateCard}
          focusMode={true}
          onEnterFocusMode={function() { setFocusMode(true); }}
          onExitFocusMode={function() { setFocusMode(false); }}
        />
      ) : null}

      <div className="chat-widget chat-widget-deck" style={WIDGET_STYLE}>
        <div className="chat-widget-head" style={WIDGET_HEAD_STYLE}>
          <Icon name="ti-cards" />
          <span className="chat-widget-title" style={WIDGET_TITLE_STYLE}>{deck.title}</span>
          <span className="chat-widget-meta" style={WIDGET_META_STYLE}>
            {viewIndex + 1} of {cards.length} cards
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "12px 0", position: "relative" }}>
          <button
            type="button"
            disabled={viewIndex === 0}
            onClick={function() {
              if (viewIndex > 0) {
                setViewIndex(viewIndex - 1);
                setIsFlipped(false);
              }
            }}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              background: viewIndex === 0 ? "rgba(255, 255, 255, 0.4)" : "#ffffff",
              border: "1px solid #cbd5e1",
              color: viewIndex === 0 ? "#cbd5e1" : "#0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: viewIndex === 0 ? "default" : "pointer",
              flexShrink: 0,
              boxShadow: viewIndex === 0 ? "none" : "0 2px 8px rgba(0, 0, 0, 0.15)",
              transition: "all 0.2s ease"
            }}
            title="Previous Card"
            aria-label="Previous Card"
          >
            <i className="ti ti-chevron-left" style={{ fontSize: "20px", fontWeight: "bold" }} />
          </button>

          <div
            className={"mini-flashcard-3d-wrap" + (isFlipped ? " is-flipped" : "")}
            style={{
              flex: 1,
              position: "relative",
              minHeight: "220px",
              background: "#ffffff",
              border: isFlipped ? "2px solid #2563eb" : "2px solid #e2e8f0",
              borderRadius: "16px",
              padding: "24px 28px",
              cursor: "pointer",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 6px 18px rgba(0, 0, 0, 0.12)",
              transition: "all 0.3s ease",
              userSelect: "none"
            }}
            onClick={function() {
              setIsFlipped(function(prev) { return !prev; });
            }}
            title="Click to flip card"
          >
            <button
              type="button"
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                background: "rgba(15, 23, 42, 0.08)",
                color: "#0f172a",
                border: "1px solid rgba(15, 23, 42, 0.15)",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: "16px",
                transition: "all 0.2s ease",
                zIndex: 10
              }}
              onClick={function(e) {
                e.stopPropagation();
                setFocusMode(true);
              }}
              title="Enter Focus Mode"
              aria-label="Enter Focus Mode"
            >
              <i className="ti ti-arrows-maximize" />
            </button>

            <p style={{
              fontSize: "18px",
              fontWeight: 800,
              fontFamily: "'Outfit', 'Inter', sans-serif",
              color: "#0f172a",
              lineHeight: 1.35,
              margin: 0,
              maxWidth: "90%",
              wordBreak: "break-word"
            }}>
              {isFlipped ? currentCard.back : currentCard.front}
            </p>
          </div>

          <button
            type="button"
            disabled={viewIndex >= cards.length - 1}
            onClick={function() {
              if (viewIndex < cards.length - 1) {
                setViewIndex(viewIndex + 1);
                setIsFlipped(false);
              }
            }}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              background: viewIndex >= cards.length - 1 ? "rgba(255, 255, 255, 0.4)" : "#ffffff",
              border: "1px solid #cbd5e1",
              color: viewIndex >= cards.length - 1 ? "#cbd5e1" : "#0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: viewIndex >= cards.length - 1 ? "default" : "pointer",
              flexShrink: 0,
              boxShadow: viewIndex >= cards.length - 1 ? "none" : "0 2px 8px rgba(0, 0, 0, 0.15)",
              transition: "all 0.2s ease"
            }}
            title="Next Card"
            aria-label="Next Card"
          >
            <i className="ti ti-chevron-right" style={{ fontSize: "20px", fontWeight: "bold" }} />
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px" }}>
          <button
            type="button"
            onClick={function() {
              setIsFlipped(function(prev) { return !prev; });
            }}
            style={{
              background: "#ffffff",
              color: "#0f172a",
              border: "1px solid #cbd5e1",
              borderRadius: "10px",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0, 0, 0, 0.08)"
            }}
          >
            {isFlipped ? "Show Question" : "Reveal Answer"}
          </button>

          <a className="chat-widget-cta" href={"/study/flashcards/" + deckId} style={Object.assign({}, WIDGET_CTA_STYLE, { marginTop: 0 })}>
            Practice Deck &rarr;
          </a>
        </div>
      </div>
    </React.Fragment>
  );
}

import QuizRunner from "../_components/QuizRunner";

function getOptionExplanation(question: any, opt: string, idx: number): string {
  if (!question.explanations && !question.rubric) {
    return opt.trim().toLowerCase() === String(question.answer || "").trim().toLowerCase()
      ? "Correct choice based on the material."
      : "Incorrect choice based on the material.";
  }
  var exp: any = question.explanations;
  if (!exp && question.rubric) {
    try {
      exp = JSON.parse(question.rubric);
    } catch (_e) {
      exp = question.rubric;
    }
  }
  if (typeof exp === "string" && exp.trim().length > 0) {
    return exp;
  }
  if (Array.isArray(exp)) {
    if (exp[idx]) return String(exp[idx]);
  }
  if (typeof exp === "object" && exp !== null) {
    if (exp[opt]) return String(exp[opt]);

    var keys = Object.keys(exp);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].trim().toLowerCase() === opt.trim().toLowerCase()) {
        return String(exp[keys[i]]);
      }
    }

    var letter = String.fromCharCode(65 + idx);
    var num = String(idx + 1);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i].trim().toUpperCase();
      if (k === letter || k === "OPTION " + letter || k === "OPTION" + letter || k === num || k === "OPTION " + num) {
        return String(exp[keys[i]]);
      }
    }

    for (var i = 0; i < keys.length; i++) {
      if (opt.toLowerCase().includes(keys[i].trim().toLowerCase()) || keys[i].toLowerCase().includes(opt.trim().toLowerCase())) {
        return String(exp[keys[i]]);
      }
    }
  }

  return opt.trim().toLowerCase() === String(question.answer || "").trim().toLowerCase()
    ? "Correct choice based on the material."
    : "Incorrect choice based on the material.";
}

function QuizCard(props: { quizId: string }): React.ReactNode {
  var quizId = props.quizId;
  var [quiz, setQuiz] = React.useState<any | null>(null);
  var [questions, setQuestions] = React.useState<any[]>([]);
  var [viewIndex, setViewIndex] = React.useState(0);
  var [userAnswers, setUserAnswers] = React.useState<Record<string, string>>({});
  var [submittingQuiz, setSubmittingQuiz] = React.useState(false);
  var [quizResults, setQuizResults] = React.useState<Record<string, { correct: boolean; feedback?: string }> | null>(null);
  var [showEssayAnswer, setShowEssayAnswer] = React.useState<Record<string, boolean>>({});
  var [submittedEssay, setSubmittedEssay] = React.useState<Record<string, boolean>>({});
  var [gradingEssay, setGradingEssay] = React.useState<Record<string, boolean>>({});
  var [essayGradeResults, setEssayGradeResults] = React.useState<Record<string, { score: number; feedback: string } | null>>({});
  var [focusMode, setFocusMode] = React.useState(false);
  var [failed, setFailed] = React.useState(false);

  React.useEffect(function() {
    var cancelled = false;
    (async function() {
      try {
        var q = await db.getById("quizzes", quizId);
        var qs = await db.listAll("questions", { quizId: quizId }, null);
        if (!cancelled) {
          if (q) {
            setQuiz(q);
            setQuestions(qs || []);
          } else {
            setFailed(true);
          }
        }
      } catch (_err) {
        if (!cancelled) {
          setFailed(true);
        }
      }
    })();
    return function() { cancelled = true; };
  }, [quizId]);

  async function handleQuizSubmit() {
    if (submittingQuiz) return;
    setSubmittingQuiz(true);
    try {
      var newResults: Record<string, { correct: boolean; feedback?: string }> = {};
      var correctCount = 0;

      for (var i = 0; i < questions.length; i++) {
        var q = questions[i];
        var userAns = (userAnswers[q.id] || "").trim();
        var rawOpts = q.options;
        var isEssayQ = q.kind === "essay" || (!rawOpts || rawOpts.length === 0) && q.kind !== "tf";

        if (!isEssayQ) {
          var isCorrect = userAns.toLowerCase() === String(q.answer || "").trim().toLowerCase();
          newResults[q.id] = { correct: isCorrect };
          if (isCorrect) correctCount++;
        } else {
          if (userAns) {
            try {
              var rubricStr = q.rubric || q.answer || "";
              var grade = await aiGradeEssay(q.prompt, rubricStr, userAns);
              var passed = grade.score >= 50;
              newResults[q.id] = {
                correct: passed,
                feedback: "Score: " + grade.score + "/100. " + grade.feedback
              };
              if (passed) correctCount++;
            } catch (_e) {
              newResults[q.id] = { correct: false, feedback: "Grading error occurred." };
            }
          } else {
            newResults[q.id] = { correct: false, feedback: "No answer provided." };
          }
        }
      }

      setQuizResults(newResults);

      var finalScorePct = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
      try {
        await db.insert("attempts", {
          quizId: quizId,
          score: finalScorePct,
          answers: JSON.stringify(userAnswers),
          gradedAt: new Date().toISOString()
        });
      } catch (_dbErr) {}
    } finally {
      setSubmittingQuiz(false);
    }
  }

  if (failed) {
    return (
      <a className="chat-widget chat-widget-fallback" href={"/study/quizzes/" + quizId} style={Object.assign({}, WIDGET_STYLE, { textDecoration: "underline" })}>
        Take this quiz &rarr;
      </a>
    );
  }
  if (!quiz || questions.length === 0) {
    return null;
  }

  if (quizResults !== null) {
    var scoreCount = 0;
    var resultKeys = Object.keys(quizResults);
    for (var rIdx = 0; rIdx < resultKeys.length; rIdx++) {
      if (quizResults[resultKeys[rIdx]].correct) scoreCount++;
    }
    var scorePct = questions.length > 0 ? Math.round((scoreCount / questions.length) * 100) : 0;

    return (
      <React.Fragment>
        {focusMode ? (
          <div className="focus-overlay" onClick={function() { setFocusMode(false); }}>
            <div className="focus-header" onClick={function(e) { e.stopPropagation(); }}>
              <h3>Quiz Review: {quiz.title}</h3>
              <button
                type="button"
                className="focus-exit-btn"
                onClick={function() { setFocusMode(false); }}
                title="Exit Focus Mode"
              >
                <i className="ti ti-x"></i>
              </button>
            </div>
            <div className="focus-content-wrap" style={{ width: "95%", maxWidth: "800px" }} onClick={function(e) { e.stopPropagation(); }}>
              <QuizRunner
                questions={questions}
                onSubmit={function() { setFocusMode(false); }}
                onGradeEssay={async function() { return null; }}
                results={quizResults}
              />
            </div>
          </div>
        ) : null}

        <div className="chat-widget chat-widget-quiz" style={WIDGET_STYLE}>
          <div className="chat-widget-head" style={WIDGET_HEAD_STYLE}>
            <Icon name="ti-quiz" />
            <span className="chat-widget-title" style={WIDGET_TITLE_STYLE}>{quiz.title}</span>
            <span className="chat-widget-meta" style={{
              background: scorePct >= 50 ? "#10b981" : "#ef4444",
              color: "#ffffff",
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: "12px",
              fontSize: "12px"
            }}>
              Score: {scoreCount} / {questions.length} ({scorePct}%)
            </span>
          </div>

          <div style={{
            background: "#ffffff",
            border: "2px solid #e2e8f0",
            borderRadius: "16px",
            padding: "20px 24px",
            margin: "12px 0",
            boxShadow: "0 6px 18px rgba(0, 0, 0, 0.12)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            maxHeight: "450px",
            overflowY: "auto"
          }}>
            {questions.map(function(q: any, qIdx: number) {
              var activeResults = quizResults || {};
              var qRes = activeResults[q.id];
              var isQCorrect = qRes?.correct;
              var userAnsText = userAnswers[q.id] || "(No answer)";
              var rawOpts = q.options;
              var isEssayQ = q.kind === "essay" || (!rawOpts || rawOpts.length === 0) && q.kind !== "tf";

              return (
                <div key={q.id} style={{
                  padding: "14px 16px",
                  borderRadius: "12px",
                  background: isQCorrect ? "#f0fdf4" : "#fef2f2",
                  border: "1px solid " + (isQCorrect ? "#a7f3d0" : "#fca5a5")
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>
                      Q{qIdx + 1}. {q.prompt}
                    </span>
                    <span style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "6px",
                      background: isQCorrect ? "#10b981" : "#ef4444",
                      color: "#ffffff"
                    }}>
                      {isQCorrect ? "✓ Correct" : "✕ Incorrect"}
                    </span>
                  </div>

                  <div style={{ fontSize: "13px", color: "#334155", marginBottom: "6px" }}>
                    <strong>Your Answer:</strong> {userAnsText}
                  </div>

                  {!isEssayQ ? (
                    <div style={{ fontSize: "13px", color: "#065f46" }}>
                      <strong>Correct Answer:</strong> {q.answer}
                    </div>
                  ) : null}

                  {qRes?.feedback ? (
                    <div style={{ fontSize: "12px", color: "#475569", marginTop: "6px", fontStyle: "italic" }}>
                      <strong>Feedback:</strong> {qRes.feedback}
                    </div>
                  ) : null}

                  {isEssayQ ? (
                    <div style={{
                      marginTop: "6px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: "#ecfdf5",
                      border: "1px solid #a7f3d0",
                      color: "#065f46",
                      fontSize: "12px"
                    }}>
                      <strong>Sample / Model Answer:</strong> {q.answer || q.rubric || "Refer to course notes."}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
            <button
              type="button"
              onClick={function() {
                setQuizResults(null);
                setUserAnswers({});
              }}
              style={{
                background: "#ffffff",
                color: "#0f172a",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0, 0, 0, 0.08)"
              }}
            >
              Retake Quiz
            </button>
            <a className="chat-widget-cta" href={"/study/quizzes/" + quizId} style={Object.assign({}, WIDGET_CTA_STYLE, { marginTop: 0 })}>
              Go to Quiz page &rarr;
            </a>
          </div>
        </div>
      </React.Fragment>
    );
  }

  var currentQuestion = questions[Math.min(viewIndex, questions.length - 1)];
  var selectedOpt = userAnswers[currentQuestion.id];
  var isAnswered = typeof selectedOpt === "string" && selectedOpt.length > 0;

  var rawOptions = currentQuestion.options;
  var isEssay = currentQuestion.kind === "essay" || (!rawOptions || rawOptions.length === 0) && currentQuestion.kind !== "tf";
  var optionsList: string[] = Array.isArray(rawOptions) && rawOptions.length > 0
    ? rawOptions
    : (currentQuestion.kind === "tf" ? ["True", "False"] : []);

  if (optionsList.length === 0) {
    isEssay = true;
  }

  return (
    <React.Fragment>
      {focusMode ? (
        <div className="focus-overlay" onClick={function() { setFocusMode(false); }}>
          <div className="focus-header" onClick={function(e) { e.stopPropagation(); }}>
            <h3>Quiz Review: {quiz.title}</h3>
            <button
              type="button"
              className="focus-exit-btn"
              onClick={function() { setFocusMode(false); }}
              title="Exit Focus Mode"
            >
              <i className="ti ti-x"></i>
            </button>
          </div>
          <div className="focus-content-wrap" style={{ width: "95%", maxWidth: "800px" }} onClick={function(e) { e.stopPropagation(); }}>
            <QuizRunner
              questions={questions}
              onSubmit={function() { setFocusMode(false); }}
              onGradeEssay={async function() { return null; }}
              results={null}
            />
          </div>
        </div>
      ) : null}

      <div className="chat-widget chat-widget-quiz" style={WIDGET_STYLE}>
        <div className="chat-widget-head" style={WIDGET_HEAD_STYLE}>
          <Icon name="ti-quiz" />
          <span className="chat-widget-title" style={WIDGET_TITLE_STYLE}>{quiz.title}</span>
          <span className="chat-widget-meta" style={WIDGET_META_STYLE}>
            Question {viewIndex + 1} of {questions.length}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "12px 0", position: "relative" }}>
          <button
            type="button"
            disabled={viewIndex === 0}
            onClick={function() {
              if (viewIndex > 0) {
                setViewIndex(viewIndex - 1);
              }
            }}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              background: viewIndex === 0 ? "rgba(255, 255, 255, 0.4)" : "#ffffff",
              border: "1px solid #cbd5e1",
              color: viewIndex === 0 ? "#cbd5e1" : "#0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: viewIndex === 0 ? "default" : "pointer",
              flexShrink: 0,
              boxShadow: viewIndex === 0 ? "none" : "0 2px 8px rgba(0, 0, 0, 0.15)",
              transition: "all 0.2s ease"
            }}
            title="Previous Question"
            aria-label="Previous Question"
          >
            <i className="ti ti-chevron-left" style={{ fontSize: "20px", fontWeight: "bold" }} />
          </button>

          <div
            style={{
              flex: 1,
              position: "relative",
              background: "#ffffff",
              border: "2px solid #e2e8f0",
              borderRadius: "16px",
              padding: "20px 24px",
              boxShadow: "0 6px 18px rgba(0, 0, 0, 0.12)"
            }}
          >
            <button
              type="button"
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                background: "rgba(15, 23, 42, 0.08)",
                color: "#0f172a",
                border: "1px solid rgba(15, 23, 42, 0.15)",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: "16px",
                transition: "all 0.2s ease",
                zIndex: 10
              }}
              onClick={function() {
                setFocusMode(true);
              }}
              title="Enter Focus Mode"
              aria-label="Enter Focus Mode"
            >
              <i className="ti ti-arrows-maximize" />
            </button>

            <p style={{
              fontSize: "15px",
              fontWeight: 700,
              fontFamily: "'Outfit', 'Inter', sans-serif",
              color: "#0f172a",
              lineHeight: 1.4,
              margin: "0 0 14px 0",
              paddingRight: "36px"
            }}>
              {viewIndex + 1}. {currentQuestion.prompt}
            </p>

            {isEssay ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <textarea
                  value={userAnswers[currentQuestion.id] || ""}
                  onChange={function(e) {
                    var val = e.target.value;
                    setUserAnswers(function(prev) {
                      var next = Object.assign({}, prev);
                      next[currentQuestion.id] = val;
                      return next;
                    });
                  }}
                  placeholder="Write your open-ended answer here..."
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    fontFamily: "inherit",
                    color: "#0f172a",
                    background: "#f8fafc",
                    outline: "none",
                    resize: "vertical"
                  }}
                />
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {optionsList.map(function(opt: string, oi: number) {
                  var letter = String.fromCharCode(65 + oi);
                  var isTargetCorrect = opt.trim().toLowerCase() === String(currentQuestion.answer || "").trim().toLowerCase();
                  var isSelected = selectedOpt === opt;

                  var optionBg = "#f8fafc";
                  var optionBorder = "1px solid #e2e8f0";
                  var optionColor = "#1e293b";
                  var badgeBg = "#e2e8f0";
                  var badgeColor = "#475569";

                  if (isAnswered) {
                    if (isTargetCorrect) {
                      optionBg = "#ecfdf5";
                      optionBorder = "2px solid #10b981";
                      optionColor = "#065f46";
                      badgeBg = "#10b981";
                      badgeColor = "#ffffff";
                    } else if (isSelected) {
                      optionBg = "#fef2f2";
                      optionBorder = "2px solid #ef4444";
                      optionColor = "#991b1b";
                      badgeBg = "#ef4444";
                      badgeColor = "#ffffff";
                    } else {
                      optionBg = "#f8fafc";
                      optionBorder = "1px solid #e2e8f0";
                      optionColor = "#64748b";
                    }
                  }

                  var explanationText = isAnswered ? getOptionExplanation(currentQuestion, opt, oi) : "";

                  return (
                    <div key={oi} style={{ width: "100%" }}>
                      <button
                        type="button"
                        onClick={function() {
                          if (isAnswered) return;
                          setUserAnswers(function(prev) {
                            var next = Object.assign({}, prev);
                            next[currentQuestion.id] = opt;
                            return next;
                          });
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          background: optionBg,
                          border: optionBorder,
                          color: optionColor,
                          fontWeight: isSelected || (isAnswered && isTargetCorrect) ? 700 : 500,
                          fontSize: "13px",
                          textAlign: "left",
                          cursor: isAnswered ? "default" : "pointer",
                          transition: "all 0.15s ease"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{
                            width: "24px",
                            height: "24px",
                            borderRadius: "50%",
                            background: badgeBg,
                            color: badgeColor,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "11px",
                            fontWeight: 700,
                            flexShrink: 0
                          }}>
                            {letter}
                          </span>
                          <span>{opt}</span>
                        </div>

                        {isAnswered ? (
                          <span style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "6px",
                            background: isTargetCorrect ? "#10b981" : isSelected ? "#ef4444" : "transparent",
                            color: isTargetCorrect || isSelected ? "#ffffff" : "#94a3b8"
                          }}>
                            {isTargetCorrect ? "✓ Correct" : isSelected ? "✕ Incorrect" : ""}
                          </span>
                        ) : null}
                      </button>

                      {isAnswered && explanationText && (isTargetCorrect || isSelected) ? (
                        <div style={{
                          marginTop: "4px",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          fontSize: "12px",
                          lineHeight: 1.4,
                          background: isTargetCorrect ? "#d1fae5" : isSelected ? "#fee2e2" : "#f1f5f9",
                          color: isTargetCorrect ? "#065f46" : isSelected ? "#991b1b" : "#475569",
                          borderLeft: "3px solid " + (isTargetCorrect ? "#10b981" : isSelected ? "#ef4444" : "#94a3b8")
                        }}>
                          <strong>Explanation:</strong> {explanationText}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={viewIndex >= questions.length - 1}
            onClick={function() {
              if (viewIndex < questions.length - 1) {
                setViewIndex(viewIndex + 1);
              }
            }}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              background: viewIndex >= questions.length - 1 ? "rgba(255, 255, 255, 0.4)" : "#ffffff",
              border: "1px solid #cbd5e1",
              color: viewIndex >= questions.length - 1 ? "#cbd5e1" : "#0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: viewIndex >= questions.length - 1 ? "default" : "pointer",
              flexShrink: 0,
              boxShadow: viewIndex >= questions.length - 1 ? "none" : "0 2px 8px rgba(0, 0, 0, 0.15)",
              transition: "all 0.2s ease"
            }}
            title="Next Question"
            aria-label="Next Question"
          >
            <i className="ti ti-chevron-right" style={{ fontSize: "20px", fontWeight: "bold" }} />
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginTop: "12px", gap: "10px" }}>
          {viewIndex === questions.length - 1 ? (
            <button
              type="button"
              disabled={submittingQuiz}
              onClick={handleQuizSubmit}
              style={{
                background: "#ffffff",
                color: "#0f172a",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                padding: "8px 20px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: submittingQuiz ? "default" : "pointer",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12)",
                transition: "all 0.15s ease",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              {submittingQuiz ? (
                <React.Fragment>
                  <i className="ti ti-loader spin" /> Submitting...
                </React.Fragment>
              ) : (
                "Submit Quiz"
              )}
            </button>
          ) : (
            <a className="chat-widget-cta" href={"/study/quizzes/" + quizId} style={Object.assign({}, WIDGET_CTA_STYLE, { marginTop: 0 })}>
              Go to Quiz page &rarr;
            </a>
          )}
        </div>
      </div>
    </React.Fragment>
  );
}

function ExamPaperCard(props: { url: string }): React.ReactNode {
  var url = props.url;
  var filename = url.split("?")[0].split("/").pop() || "exam-paper.pdf";
  return (
    <div className="chat-widget chat-widget-paper" style={WIDGET_STYLE}>
      <div className="chat-widget-head" style={WIDGET_HEAD_STYLE}>
        <Icon name="ti-file-text" />
        <span className="chat-widget-title" style={WIDGET_TITLE_STYLE}>{filename}</span>
        <span className="chat-widget-meta" style={WIDGET_META_STYLE}>Exam paper</span>
      </div>
      <div className="chat-widget-paper-actions">
        <a className="chat-widget-cta" href={url} download={filename} style={Object.assign({}, WIDGET_CTA_STYLE, { marginRight: "8px" })}>Download PDF</a>
        <a className="chat-widget-cta" href={url} target="_blank" rel="noopener noreferrer" style={WIDGET_CTA_STYLE}>View PDF</a>
      </div>
    </div>
  );
}

function classifyArtifact(m: RegExpExecArray): ArtifactMatch | null {
  if (m[1] !== undefined) return { kind: "deck", id: m[1] };
  if (m[2] !== undefined) return { kind: "quiz", id: m[2] };
  if (m[4] !== undefined) {
    var url = m[4];
    if (url.indexOf("/study/flashcards/") !== -1) {
      var did = url.match(/\/study\/flashcards\/([0-9a-f-]{8,})/);
      if (did) return { kind: "deck", id: did[1] };
    }
    if (url.indexOf("/study/quizzes/") !== -1) {
      var qid = url.match(/\/study\/quizzes\/([0-9a-f-]{8,})/);
      if (qid) return { kind: "quiz", id: qid[1] };
    }
    if (/\.pdf$/i.test(url)) return { kind: "pdf", url: url };
    return null;
  }
  if (m[5] !== undefined) return { kind: "deck", id: m[5] };
  if (m[6] !== undefined) return { kind: "quiz", id: m[6] };
  if (m[7] !== undefined) return { kind: "pdf", url: m[7] };
  return null;
}

function cleanTextBeforeArtifact(text: string): string {
  if (!text) return "";
  var cleaned = text
    .replace(/<https?:?\/?\/?[^>\s]*$/i, "")
    .replace(/\[[^\]]*\]\(\s*https?:?\/?\/?[^)\s]*$/i, "")
    .replace(/\(\s*https?:?\/?\/?[^)\s]*$/i, "")
    .replace(/<\s*$/i, "")
    .trim();
  return cleaned;
}

function renderAssistantContent(content: string): React.ReactNode[] {
  var parts: React.ReactNode[] = [];
  if (!content) {
    return parts;
  }
  var m: RegExpExecArray | null;
  var last = 0;
  var key = 0;
  while ((m = ARTIFACT_RE.exec(content)) !== null) {
    if (m.index > last) {
      var textSlice = content.slice(last, m.index);
      var artifactCheck = classifyArtifact(m);
      if (artifactCheck) {
        textSlice = cleanTextBeforeArtifact(textSlice);
      }
      if (textSlice) {
        parts.push(<div key={key++} dangerouslySetInnerHTML={{ __html: renderMarkdown(textSlice) }} />);
      }
    }
    var artifact = classifyArtifact(m);
    if (artifact) {
      if (artifact.kind === "deck") {
        parts.push(<FlashcardCard key={key++} deckId={artifact.id} />);
      } else if (artifact.kind === "quiz") {
        parts.push(<QuizCard key={key++} quizId={artifact.id} />);
      } else {
        parts.push(<ExamPaperCard key={key++} url={artifact.url} />);
      }
    } else {
      parts.push(<div key={key++} dangerouslySetInnerHTML={{ __html: renderMarkdown(m[0]) }} />);
    }
    last = m.index + m[0].length;
  }
  if (last < content.length) {
    var tailSlice = content.slice(last);
    if (tailSlice && tailSlice.trim() !== ">") {
      parts.push(<div key={key++} dangerouslySetInnerHTML={{ __html: renderMarkdown(tailSlice) }} />);
    }
  }
  return parts;
}

export default function ChatPage() {
  var { activeCourse } = useCourse();

  if (!activeCourse) {
    return <AppShell><CoursePicker /></AppShell>;
  }

  var [messages, setMessages] = React.useState<ChatMessage[]>([]);
  var [inputValue, setInputValue] = React.useState("");
  var [loading, setLoading] = React.useState(false);
  var [activeTab, setActiveTab] = React.useState("chat");
  var [conversations, setConversations] = React.useState<Conversation[]>([]);
  var [activeConvId, setActiveConvId] = React.useState("");
  var { user } = useSession();
  var [historyLoading, setHistoryLoading] = React.useState(false);
  var [sources, setSources] = React.useState<{ material: Material; chunkCount: number }[]>([]);
  var [isSearching, setIsSearching] = React.useState(false);
  var [attachments, setAttachments] = React.useState<Attachment[]>([]);
  var [attachError, setAttachError] = React.useState("");
  var [lightbox, setLightbox] = React.useState<{ url: string; caption: string } | null>(null);
  var [toolActivity, setToolActivity] = React.useState<ToolActivity[]>([]);
  var messagesEndRef = React.useRef<HTMLDivElement>(null);
  var textareaRef = React.useRef<HTMLTextAreaElement>(null);
  var fileInputRef = React.useRef<HTMLInputElement>(null);
  var loadedUserIdRef = React.useRef<string | null>(null);
  var memoriesCacheRef = React.useRef<{ courseId: string; list: string[] } | null>(null);

  var pendingBufferRef = React.useRef("");
  var displayedTextRef = React.useRef("");
  var typewriterIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  var isStreamDoneRef = React.useRef(false);

  React.useEffect(function() {
    return function() {
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
      }
    };
  }, []);

  React.useEffect(function() {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ block: "end" });
    }
  }, [messages]);

  React.useEffect(function() {
    if (user && user.id !== loadedUserIdRef.current) {
      loadedUserIdRef.current = user.id;
      loadConversations(user.id);
    } else if (!user) {
      loadedUserIdRef.current = null;
    }
  }, [user]);

  React.useEffect(function() {
    if (!activeCourse) {
      return;
    }
    console.log("[SOURCES-LOAD] activeCourse:", activeCourse.id, activeCourse.name);
    db.listAll("materials", { courseId: activeCourse.id }, "createdAt").then(function(all) {
      console.log("[SOURCES-LOAD] materials found:", all.length);
      Promise.all(all.map(function(m: Material) {
        return db.listAll("chunks", { materialId: m.id }, null).then(function(chunks) {
          console.log("[SOURCES-LOAD] material:", m.id, m.title, "status:", m.status, "chunks:", chunks.length);
          return { material: m, chunkCount: chunks.length };
        });
      })).then(function(data) {
        console.log("[SOURCES-LOAD] setSources with", data.length, "items");
        setSources(data);
      });
    }).catch(function(err) {
      console.error("[SOURCES-LOAD] ERROR:", err);
    });
  }, [activeCourse]);

  async function loadConversations(userId: string): Promise<void> {
    try {
      var list = await db.listConversations(userId);
      setConversations(list as Conversation[]);
    } catch (err) {
      console.error("loadConversations:", err);
    }
  }

  async function ensureConversation(title: string): Promise<string> {
    if (activeConvId !== "" && user) {
      return activeConvId;
    }
    if (!user) {
      return "";
    }
    try {
      var conv = await db.createConversation(user.id, title);
      var convData = conv as Conversation;
      setActiveConvId(convData.id);
      var list = await db.listConversations(user.id);
      setConversations(list as Conversation[]);
      return convData.id;
    } catch (err) {
      console.error("ensureConversation:", err);
      return "";
    }
  }

  async function handleNewChat(): Promise<void> {
    setMessages([]);
    setActiveConvId("");
    setActiveTab("chat");
  }

  async function handleSelectConversation(convId: string): Promise<void> {
    setHistoryLoading(true);
    try {
      var msgs = await db.listMessages(convId);
      setMessages((msgs as ChatMessage[]));
      setActiveConvId(convId);
      setActiveTab("chat");
    } catch (err) {
      console.error("handleSelectConversation:", err);
    }
    setHistoryLoading(false);
  }

  async function handleDeleteConversation(convId: string, e: React.MouseEvent): Promise<void> {
    e.stopPropagation();
    try {
      await db.deleteConversation(convId);
      if (activeConvId === convId) {
        setMessages([]);
        setActiveConvId("");
      }
      if (user) {
        var list = await db.listConversations(user.id);
        setConversations(list as Conversation[]);
      }
    } catch (err) {
      console.error("handleDeleteConversation:", err);
    }
  }

  function autoGrow(): void {
    var ta = textareaRef.current;
    if (!ta) {
      return;
    }
    ta.style.height = "auto";
    var max = 160;
    var next = ta.scrollHeight;
    if (next > max) {
      next = max;
    }
    ta.style.height = next + "px";
  }

  function compressImage(file: File): Promise<Blob> {
    return new Promise(function(resolve, reject) {
      var img = new Image();
      img.onload = function() {
        var scale = Math.min(1, IMAGE_MAX_DIM / Math.max(img.width, img.height));
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        var ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function(blob) {
          if (blob) {
            resolve(blob);
          } else {
            canvas.toBlob(function(jblob) {
              if (jblob) resolve(jblob);
              else reject(new Error("Image compression failed"));
            }, "image/jpeg", 0.85);
          }
        }, "image/webp", 0.85);
      };
      img.onerror = function() { reject(new Error("Could not read image")); };
      img.src = URL.createObjectURL(file);
    });
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>): void {
    var files = Array.from(e.target.files || []);
    e.target.value = "";
    var valid = files.filter(function(f) { return f.type.startsWith("image/") && f.size <= IMAGE_MAX_SIZE; });
    var room = IMAGE_MAX_COUNT - attachments.length;
    var overflow = Math.max(0, valid.length - room);
    var added: Attachment[] = [];
    for (var i = 0; i < valid.length && room > 0; i++) {
      var f = valid[i];
      added.push({ id: crypto.randomUUID(), name: f.name, objectUrl: URL.createObjectURL(f), file: f });
      room--;
    }
    if (overflow > 0) {
      setAttachError("Max " + IMAGE_MAX_COUNT + " images. " + overflow + " image" + (overflow === 1 ? " was" : "s were") + " skipped.");
    } else if (added.length === 0) {
      setAttachError("Max " + IMAGE_MAX_COUNT + " images, 8MB each.");
    } else {
      setAttachError("");
    }
    if (added.length > 0) {
      setAttachments(function(prev) { return prev.concat(added); });
    }
  }

  function removeAttachment(id: string): void {
    setAttachments(function(prev) {
      var removed = prev.find(function(a) { return a.id === id; });
      if (removed) {
        URL.revokeObjectURL(removed.objectUrl);
      }
      return prev.filter(function(a) { return a.id !== id; });
    });
  }

  function renderUserContent(content: string) {
    var parts: React.ReactNode[] = [];
    var re = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
    var last = 0;
    var m: RegExpExecArray | null;
    var key = 0;
    while ((m = re.exec(content)) !== null) {
      if (m.index > last) {
        parts.push(<span key={key++}>{content.slice(last, m.index)}</span>);
      }
      var url = db.getPublicUrl("materials", m[2]);
      var cap = m[1] || "";
      parts.push(
        <figure key={key++} className="chat-image-wrap">
          <img
            className="chat-image"
            src={url}
            alt={cap || "attached image"}
            role="button"
            tabIndex={0}
            onClick={function() { setLightbox({ url: url, caption: cap }); }}
            onKeyDown={function(e) { if (e.key === "Enter" || e.key === " ") { setLightbox({ url: url, caption: cap }); } }}
          />
          {cap ? <figcaption className="chat-image-caption">{cap}</figcaption> : null}
        </figure>
      );
      last = m.index + m[0].length;
    }
    if (last < content.length) {
      parts.push(<span key={key++}>{content.slice(last)}</span>);
    }
    return parts;
  }

  async function handleSend(): Promise<void> {
    if ((inputValue.trim() === "" && attachments.length === 0) || loading) {
      return;
    }
    if (!user && attachments.length > 0) {
      setAttachError("Sign in to send images with your message.");
      return;
    }
    var question = inputValue.trim() || "Describe the attached images.";
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setLoading(true);

    var title = question.slice(0, 60);
    var targetConvId = activeConvId;
    if (user && !targetConvId) {
      targetConvId = await ensureConversation(title);
    }

    var uploadedPaths: string[] = [];
    var userContent = question;
    var userMsgIndex = messages.length;
    if (user && targetConvId && attachments.length > 0) {
      for (var ai = 0; ai < attachments.length; ai++) {
        var att = attachments[ai];
        var blob = await compressImage(att.file);
        var ext = blob.type === "image/webp" ? "webp" : "jpeg";
        var path = (activeCourse?.id || "") + "/chat/" + targetConvId + "/" + crypto.randomUUID() + "." + ext;
        await db.uploadFile("materials", path, blob, blob.type);
        uploadedPaths.push(path);
        userContent = userContent + "\n![](" + path + ")";
      }
      attachments.forEach(function(a) { URL.revokeObjectURL(a.objectUrl); });
      setAttachments([]);
      setAttachError("");
    }

    setMessages(function(prev) {
      var updated = prev.slice();
      updated.push({ role: "user", content: userContent });
      return updated;
    });

    var userMsgId: string | null = null;
    if (user && targetConvId) {
      try {
        userMsgId = await db.addMessage(targetConvId, "user", userContent);
      } catch (err) {
        console.error("addMessage user error:", err);
      }
    }

    try {
      var recent = messages.slice(-10);
      var historyLines: string[] = [];
      for (var i = 0; i < recent.length; i++) {
        var role = recent[i].role === "user" ? "User" : "Assistant";
        var histContent = recent[i].content.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function(_m: string, alt: string) {
          return alt !== "" ? "[image: " + alt + "]" : "[image]";
        });
        historyLines.push(role + ": " + histContent);
      }
      var chatHistory = historyLines.join("\n");

      var currentConv = conversations.find(function(c) { return c.id === activeConvId; });
      var currentSummary = currentConv?.summary || "";

      var memories: string[] = [];
      if (user && activeCourse) {
        var memCache = memoriesCacheRef.current;
        if (memCache && memCache.courseId === activeCourse.id) {
          memories = memCache.list;
        } else {
          try {
            var memList = await db.listMemories(user.id, activeCourse.id);
            memories = memList.map(function(m: any) { return "[" + m.type + "] " + m.content; });
            memoriesCacheRef.current = { courseId: activeCourse.id, list: memories };
          } catch (_mErr) {}
        }
      }

      // ponytail: sliding window — re-attach bytes of images from the last 2 user
      // turns; older images survive only as [image: caption] tokens in history.
      // Ceiling: heuristics don't know intent; explicit re-attach via paperclip is the upgrade path.
      var slidingImages: string[] = [];
      var userTurns = 0;
      for (var si = messages.length - 1; si >= 0 && userTurns < 2; si--) {
        if (messages[si].role !== "user") {
          continue;
        }
        userTurns++;
        var tokenRe = /!\[[^\]]*\]\(([^)\s]+)\)/g;
        var tm: RegExpExecArray | null;
        while ((tm = tokenRe.exec(messages[si].content)) !== null) {
          slidingImages.push(tm[1]);
        }
      }

      console.log("[SEND] sources count:", sources.length);
      var readyMaterialIds = sources.filter(function(s) {
        return s.material.status === "ready" && s.chunkCount > 0;
      }).map(function(s) {
        return s.material.id;
      });
      var isGreeting = /^(hi|hello|hey|greetings|thanks|thank you|good morning|good afternoon)\b/i.test(question.trim());

      if (readyMaterialIds.length > 0 && !isGreeting) {
        setIsSearching(true);
      } else {
        setIsSearching(false);
      }

      pendingBufferRef.current = "";
      displayedTextRef.current = "";
      isStreamDoneRef.current = false;
      setToolActivity([]);
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
        typewriterIntervalRef.current = null;
      }

      function startTypewriter() {
        if (typewriterIntervalRef.current) return;
        typewriterIntervalRef.current = setInterval(function() {
          if (pendingBufferRef.current.length > 0) {
            var step = pendingBufferRef.current.length > 200 ? 20 : 4;
            var chunk = pendingBufferRef.current.slice(0, step);
            pendingBufferRef.current = pendingBufferRef.current.slice(step);
            displayedTextRef.current += chunk;
            var currentText = displayedTextRef.current;
            setMessages(function(prev) {
              var updated = prev.slice();
              updated[updated.length - 1] = { role: "assistant", content: currentText };
              return updated;
            });
          } else if (isStreamDoneRef.current) {
            if (typewriterIntervalRef.current) {
              clearInterval(typewriterIntervalRef.current);
              typewriterIntervalRef.current = null;
            }
          }
        }, 45);
      }

      var response = await fetch(STREAM_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: question,
          materialIds: isGreeting ? [] : readyMaterialIds,
          courseId: activeCourse?.id || "",
          chatHistory: chatHistory,
          summary: currentSummary,
          memories: memories,
          language: "en",
          images: uploadedPaths.concat(slidingImages)
        })
      });

      if (!response.ok) {
        var errorBody = await response.text();
        throw new Error("Request failed (" + response.status + "): " + errorBody);
      }

      var reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      var decoder = new TextDecoder();
      var assistantMessage = "";
      var sseBuffer = "";
      var textStarted = false;

      setMessages(function(prev) {
        var updated = prev.slice();
        updated.push({ role: "assistant", content: "" });
        return updated;
      });

      function handleSSEEvent(ev: SSEEvent): void {
        if (ev.type === "tool_start") {
          setToolActivity(function(prev) {
            return prev.concat([{ tool: ev.tool, status: "running", durationMs: 0 }]);
          });
        } else if (ev.type === "tool_end") {
          setToolActivity(function(prev) {
            return prev.map(function(t) {
              if (t.tool === ev.tool) {
                return { tool: t.tool, status: "done", durationMs: ev.durationMs };
              }
              return t;
            });
          });
        } else if (ev.type === "text") {
          if (!textStarted) {
            textStarted = true;
            setToolActivity([]);
          }
          setIsSearching(false);
          assistantMessage = assistantMessage + ev.content;
          pendingBufferRef.current += ev.content;
          startTypewriter();
        } else if (ev.type === "done") {
          setToolActivity([]);
        }
      }

      while (true) {
        var result = await reader.read();
        if (result.done) {
          break;
        }
        sseBuffer = sseBuffer + decoder.decode(result.value, { stream: true });
        var events = sseBuffer.split("\n\n");
        sseBuffer = events.pop() || "";
        for (var ei = 0; ei < events.length; ei++) {
          var line = events[ei].trim();
          if (line === "") {
            continue;
          }
          if (line.indexOf("data:") === 0) {
            line = line.slice(5).trim();
          }
          try {
            handleSSEEvent(JSON.parse(line) as SSEEvent);
          } catch (_parseErr) {
            console.warn("[CHAT] Skipping malformed SSE event:", line);
          }
        }
      }

      isStreamDoneRef.current = true;

      if (user && targetConvId) {
        await db.addMessage(targetConvId, "assistant", assistantMessage);
        await db.renameConversation(targetConvId, title);
        var list = await db.listConversations(user.id);
        setConversations(list as Conversation[]);
        // Fire non-blocking memory extraction hook (skip trivial exchanges)
        var isTrivial = /^(hi|hello|hey|thanks|thank you|ok|okay|good|great|nice|bye|noted)\b/i.test(question.trim()) || assistantMessage.trim().length < 60;
        if (!isTrivial) {
          aiExtractMemory(targetConvId, activeCourse?.id || null, question, assistantMessage)
            .then(function() {
              memoriesCacheRef.current = null;
            })
            .catch(function(mErr) {
              console.error("[CHAT] Non-blocking aiExtractMemory error:", mErr);
            });
        }
        // Non-blocking image captions: store description as the token alt text so
        // later turns remember the image without re-sending its bytes.
        if (userMsgId && uploadedPaths.length > 0) {
          fetch("/study/api/caption", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ paths: uploadedPaths })
          })
            .then(function(r) { return r.json(); })
            .then(function(data: { captions?: string[] }) {
              var caps = data.captions || [];
              var captioned = userContent;
              for (var ci = 0; ci < uploadedPaths.length; ci++) {
                var cap = caps[ci] || "User uploaded image";
                captioned = captioned.replace("![](" + uploadedPaths[ci] + ")", "![" + cap + "](" + uploadedPaths[ci] + ")");
              }
              return db.updateMessage(userMsgId!, captioned).then(function() { return captioned; });
            })
            .then(function(captioned: string) {
              setMessages(function(prev) {
                var updated = prev.slice();
                if (updated[userMsgIndex]) {
                  updated[userMsgIndex] = { role: "user", content: captioned };
                }
                return updated;
              });
            })
            .catch(function(cErr) {
              console.error("[CHAT] caption update failed:", cErr);
            });
        }
      }
    } catch (err) {
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
        typewriterIntervalRef.current = null;
      }
      setIsSearching(false);
      setMessages(function(prev) {
        var updated = prev.slice();
        updated.push({ role: "assistant", content: "Error: " + String(err) });
        return updated;
      });
    }

    setIsSearching(false);
    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSuggestion(text: string): void {
    setInputValue(text);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }

  function handleTabClick(tab: string): void {
    setActiveTab(tab);
  }

  return (
    <AppShell>
      <CourseBar />
      <div className="chat-page">
        <div className="chat-tabs">
          <button
            type="button"
            className={"chat-tab" + (activeTab === "chat" ? " active" : "")}
            onClick={function() { handleTabClick("chat"); }}
          >
            <Icon name="ti-message-2" />
            <span>Chat</span>
          </button>
          <button
            type="button"
            className={"chat-tab" + (activeTab === "sources" ? " active" : "")}
            onClick={function() { handleTabClick("sources"); }}
          >
            <Icon name="ti-folders" />
            <span>Sources</span>
          </button>
          <button
            type="button"
            className={"chat-tab" + (activeTab === "history" ? " active" : "")}
            onClick={function() { handleTabClick("history"); }}
          >
            <Icon name="ti-history" />
            <span>History</span>
          </button>
          <div className="chat-tabs-actions">
            {messages.length > 0 ? (
              <button type="button" className="chat-icon-btn" onClick={handleNewChat} title="New chat">
                <Icon name="ti-plus" />
              </button>
            ) : null}
          </div>
        </div>

        {!user ? (
          <div className="chat-auth-banner">
            <Icon name="ti-user" />
            <span>Sign in to save conversations across sessions.</span>
            <a href="/signin" className="chat-auth-link">Sign in</a>
          </div>
        ) : null}

        {activeTab === "chat" ? (
          <div className="chat-center">
            <div className="chat-scroll">
              {messages.length === 0 ? (
                <div className="chat-empty">
                  {conversations.length > 0 ? (
                    <button
                      type="button"
                      className="chat-resume-pill"
                      onClick={function() { handleSelectConversation(conversations[0].id); }}
                    >
                      <Icon name="ti-arrow-back-up" />
                      <span>Resume: <strong>{conversations[0].title}</strong></span>
                    </button>
                  ) : null}
                  <h2>What can I help you study?</h2>
                  <p className="chat-empty-sub">Ask about any subject. Responses are augmented by your indexed materials.</p>
                  <div className="chat-suggestions">
                    {SUGGESTIONS.map(function(s) {
                      return (
                        <button
                          key={s}
                          type="button"
                          className="chat-suggestion"
                          onClick={function() { handleSuggestion(s); }}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {messages.map(function(msg, index) {
                var isUser = msg.role === "user";
                return (
                  <div key={index} className={"chat-row chat-row-" + msg.role}>
                    <div className="chat-avatar">
                      <Icon name={isUser ? "ti-user" : "ti-robot"} />
                    </div>
                    <div className="chat-content">
                      <div className="chat-name">{isUser ? "You" : "Study Buddy"}</div>
                      {isUser ? (
                        <div className="chat-text chat-text-user">{renderUserContent(msg.content)}</div>
                      ) : (
                        <div className="chat-text chat-text-ai">
                          {index === messages.length - 1 && loading && (toolActivity.length > 0 || msg.content === "") ? (
                            <ToolActivityStrip activity={toolActivity} isSearching={isSearching} />
                          ) : null}
                          {renderAssistantContent(msg.content)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {loading && (messages.length === 0 || messages[messages.length - 1].role === "user") ? (
                <div className="chat-row chat-row-assistant">
                  <div className="chat-avatar"><Icon name="ti-robot" /></div>
                  <div className="chat-content">
                    <div className="chat-name">Study Buddy</div>
                    <ToolActivityStrip activity={toolActivity} isSearching={isSearching} />
                  </div>
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-compose">
              {attachError ? <div className="chat-attach-error">{attachError}</div> : null}
              <div className={"chat-input-wrap" + (attachments.length > 0 ? " has-attach" : "")}>
                {attachments.length > 0 ? (
                  <div className="chat-attach-row">
                    {attachments.map(function(a) {
                      return (
                        <div key={a.id} className="chat-attach-thumb">
                          <img
                            src={a.objectUrl}
                            alt={a.name}
                            role="button"
                            tabIndex={0}
                            onClick={function() { setLightbox({ url: a.objectUrl, caption: a.name }); }}
                            onKeyDown={function(e) { if (e.key === "Enter" || e.key === " ") { setLightbox({ url: a.objectUrl, caption: a.name }); } }}
                          />
                          <button
                            type="button"
                            className="chat-attach-remove"
                            onClick={function() { removeAttachment(a.id); }}
                            title="Remove"
                          >
                            <Icon name="ti-x" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                <div className="chat-input-row">
                <button
                  type="button"
                  className="chat-attach"
                  onClick={function() { fileInputRef.current?.click(); }}
                  disabled={loading}
                  title="Attach images"
                >
                  <Icon name="ti-paperclip" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="chat-file-input"
                  onChange={handleFiles}
                />
                <textarea
                  ref={textareaRef}
                  className="chat-textarea"
                  placeholder="Message Study Buddy..."
                  value={inputValue}
                  rows={1}
                  onChange={function(e) { setInputValue(e.target.value); autoGrow(); }}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                />
                <button
                  type="button"
                  className={"chat-send " + ((inputValue.trim() === "" && attachments.length === 0) || loading ? "disabled" : "")}
                  onClick={handleSend}
                  disabled={(inputValue.trim() === "" && attachments.length === 0) || loading}
                  title="Send"
                >
                  <Icon name="ti-arrow-up" />
                </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "sources" ? (
          sources.length === 0 ? (
            <div className="chat-empty chat-center">
              <div className="chat-empty-icon"><Icon name="ti-folder-off" /></div>
              <h2>No sources indexed yet</h2>
              <p className="chat-empty-sub">Upload materials in the Materials page to use them as sources.</p>
            </div>
          ) : (
            <div className="chat-center">
              <div className="chat-source-list">
                {sources.map(function(s) {
                  return (
                    <div key={s.material.id} className="chat-source-item">
                      <div className="chat-source-icon"><Icon name="ti-file-text" /></div>
                      <div className="chat-source-info">
                        <div className="chat-source-title">{s.material.title}</div>
                        <div className="chat-source-meta">
                          {s.chunkCount > 0 ? s.chunkCount + " chunks" : "No chunks"}
                          <span className="chat-source-status"> &middot; {s.material.status}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : null}

        {activeTab === "history" ? (
          <div className="chat-center">
            {historyLoading ? (
              <div className="chat-empty">
                <p className="chat-empty-sub">Loading conversations...</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="chat-empty">
                <div className="chat-empty-icon"><Icon name="ti-history-off" /></div>
                <h2>No conversations yet</h2>
                <p className="chat-empty-sub">Start a new chat and it will appear here.</p>
              </div>
            ) : (
              <div className="chat-history-list">
                {conversations.map(function(conv) {
                  return (
                    <button
                      key={conv.id}
                      type="button"
                      className={"chat-history-item" + (conv.id === activeConvId ? " active" : "")}
                      onClick={function() { handleSelectConversation(conv.id); }}
                    >
                      <div className="chat-history-info">
                        <div className="chat-history-title">{conv.title}</div>
                        <div className="chat-history-date">{formatDate(conv.updatedAt)}</div>
                      </div>
                      <span
                        className="chat-history-delete"
                        onClick={function(e) { handleDeleteConversation(conv.id, e); }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={function(e) { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); handleDeleteConversation(conv.id, e as unknown as React.MouseEvent); } }}
                      >
                        <Icon name="ti-trash" />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {lightbox ? (
        <div
          className="chat-lightbox"
          role="button"
          tabIndex={0}
          onClick={function() { setLightbox(null); }}
          onKeyDown={function(e) { if (e.key === "Escape" || e.key === "Enter") { setLightbox(null); } }}
        >
          <button
            type="button"
            className="chat-lightbox-close"
            onClick={function(e) { e.stopPropagation(); setLightbox(null); }}
            title="Close"
          >
            <Icon name="ti-x" />
          </button>
          <img
            className="chat-lightbox-img"
            src={lightbox.url}
            alt={lightbox.caption || "attached image"}
            onClick={function(e) { e.stopPropagation(); }}
          />
          {lightbox.caption ? <div className="chat-lightbox-caption">{lightbox.caption}</div> : null}
        </div>
      ) : null}
    </AppShell>
  );
}
