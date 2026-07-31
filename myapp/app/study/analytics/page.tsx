"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { useCourse } from "../_lib/CourseProvider";
import { CoursePicker } from "../_components/CoursePicker";
import { CourseBar } from "../_components/CourseBar";
import { db } from "../_lib/db";
import { renderMarkdown } from "../_lib/render-markdown";
import "katex/dist/katex.min.css";
import { useSession } from "@/lib/auth-context";

interface TopicMastery {
  id: string;
  name: string;
  pyqFrequency: number;
  mastery: number;
  isUrgent: boolean;
  questionText: string;
  pastYearQuestions: string[];
  pastYearQuestionsLang: string;
  answerScheme: string[];
}

interface DayActivity {
  total: number;
  quiz: number;
  chat: number;
  pyq: number;
  memory: number;
}

interface AnalyticsData {
  readinessScore: number;
  factors: {
    quizAverage: number;
    pyqStudiedPercent: number;
    planCompletionPercent: number;
    spacedRepetitionHealth: number;
    chatRecencyLabel: string;
    chatActiveToday: boolean;
  };
  riskFlag: {
    level: string;
    message: string;
    isHighRisk: boolean;
  };
  topics: TopicMastery[];
  dailyActivityMap: Record<string, DayActivity>;
  MONTH_NAMES: string[];
  FULL_MONTH_NAMES: string[];
}

export default function AnalyticsPage() {
  var { activeCourse } = useCourse();
  var { user } = useSession();

  var [data, setData] = React.useState<AnalyticsData | null>(null);
  var [loading, setLoading] = React.useState(true);
  var [selectedTopic, setSelectedTopic] = React.useState<TopicMastery | null>(null);
  var [practicedSuccess, setPracticedSuccess] = React.useState(false);
  var [expandedId, setExpandedId] = React.useState<string | null>(null);
  var enrichedCoursesRef = React.useRef<Record<string, boolean>>({});

  // viewMonth: initialized lazily (runs only in browser) to use local timezone, not server UTC
  var nowRef = React.useRef(new Date());
  var [viewYear, setViewYear] = React.useState<number>(function() { return new Date().getFullYear(); });
  var [viewMonth, setViewMonth] = React.useState<number>(function() { return new Date().getMonth(); });

  function prevMonth(): void {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(function(y) { return y - 1; }); }
    else { setViewMonth(function(m) { return m - 1; }); }
  }
  function nextMonth(): void {
    var now = nowRef.current;
    if (viewYear > now.getFullYear() || (viewYear === now.getFullYear() && viewMonth >= now.getMonth())) return;
    if (viewMonth === 11) { setViewMonth(0); setViewYear(function(y) { return y + 1; }); }
    else { setViewMonth(function(m) { return m + 1; }); }
  }

  var lastCourseIdRef = React.useRef<string | null>(null);

  var loadAnalytics = React.useCallback(async function(silent: boolean) {
    if (!activeCourse) {
      setLoading(false);
      return;
    }
    if (!silent) {
      setLoading(true);
    }
    try {
      var userId = user ? user.id : "anonymous-user";
      var res = await db.getCourseAnalytics(activeCourse.id, userId, activeCourse.name);
      setData(res);
    } catch (err) {
      console.error("Failed to load integrated analytics:", err);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [activeCourse, user]);

  React.useEffect(function() {
    if (!activeCourse) return;
    var isSameCourse = lastCourseIdRef.current === activeCourse.id;
    lastCourseIdRef.current = activeCourse.id;
    loadAnalytics(isSameCourse);
  }, [activeCourse, loadAnalytics]);

  // Enrich topics with verbatim past-year questions AFTER render so the page never blocks on the LLM call.
  // One shot per course per session; persisted rows reload instantly.
  React.useEffect(function() {
    if (!data || !activeCourse) return;
    if (enrichedCoursesRef.current[activeCourse.id]) return;
    if (!data.topics.some(function(t) { return t.pastYearQuestions.length === 0 || t.pastYearQuestionsLang !== "en"; })) return;
    enrichedCoursesRef.current[activeCourse.id] = true;
    (async function() {
      try {
        var enriched = await db.enrichPastQuestions(activeCourse.id, activeCourse.name, data.topics);
        setData(function(prev) {
          return prev ? { ...prev, topics: enriched } : prev;
        });
      } catch (err) {
        console.error("Failed to enrich past questions:", err);
      }
    })();
  }, [data, activeCourse]);

  React.useEffect(function() {
    if (!selectedTopic) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedTopic(null);
    }
    window.addEventListener("keydown", onKey);
    return function() { window.removeEventListener("keydown", onKey); };
  }, [selectedTopic]);

  if (!activeCourse) {
    return <AppShell><CoursePicker /></AppShell>;
  }

  if ((loading && !data) || !data) {
    return (
      <AppShell>
        <div className="analytics-skeleton" aria-busy="true" aria-label="Loading analytics">
          <div className="skeleton-kpis">
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>
          <div className="skeleton-card skeleton-card-tall" />
        </div>
      </AppShell>
    );
  }

  var analyticsData = data;

  function handleOpenPractice(topic: TopicMastery): void {
    setSelectedTopic(topic);
    setPracticedSuccess(false);
  }

  async function handleCompletePractice(): Promise<void> {
    if (!selectedTopic || !data) return;
    var targetId = selectedTopic.id;
    
    // Update local UI immediately for responsiveness
    var updatedTopics = data.topics.map(function(t) {
      if (t.id === targetId) {
        var newMastery = Math.min(95, t.mastery + 22);
        return {
          ...t,
          mastery: newMastery,
          isUrgent: t.pyqFrequency >= 75 && newMastery < 65
        };
      }
      return t;
    });

    setData({
      ...data,
      readinessScore: Math.min(100, data.readinessScore + 3),
      topics: updatedTopics
    });

    setPracticedSuccess(true);

    // Persist practice activity into Supabase memories so it integrates with Spaced Repetition & Heatmap
    try {
      if (user && activeCourse) {
        await db.upsertEpisodeMemory(
          user.id,
          activeCourse.id,
          "practice-" + targetId,
          "Practiced weak PYQ topic: " + selectedTopic.name + ". Improved mastery.",
          "[0.1, 0.2, 0.3]"
        );
      }
    } catch (err) {
      console.warn("Failed to log practice memory to Supabase:", err);
    }

    setTimeout(function() {
      setSelectedTopic(null);
      setPracticedSuccess(false);
    }, 1800);
  }

  return (
    <AppShell>
      <PageHero
        eyebrow="Makerpreneur 2026 • Longitudinal Learning"
        title="Student Academic Health & PYQ Analytics"
        description="Real-time exam readiness, plain-language risk flags, 5-year PYQ topic mastery, and semester consistency tracking integrated with Supabase."
        icon="ti-chart-radar"
      />

      <CourseBar />

      {/* Hero Section: KPI Cards */}
      <div className="kpi-grid">
        <div className={"kpi-card " + (analyticsData.readinessScore >= 75 ? "kpi-success" : analyticsData.readinessScore >= 60 ? "kpi-warning" : "kpi-danger")}>
          <span className="kpi-label">Readiness Score</span>
          <div className="kpi-value-row">
            <span className="kpi-value">{analyticsData.readinessScore}<small> / 100</small></span>
            <Badge tone={analyticsData.readinessScore >= 75 ? "success" : analyticsData.readinessScore >= 60 ? "neutral" : "warning"}>
              {analyticsData.readinessScore >= 75 ? "Exam Ready" : analyticsData.readinessScore >= 60 ? "On Track" : "Action Needed"}
            </Badge>
          </div>
          <div className="kpi-bar">
            <div className="kpi-bar-fill" style={{ width: analyticsData.readinessScore + "%" }} />
          </div>
          <p className="kpi-sub">Composite of quiz attempts, study plan completion, spaced-repetition backlog, PYQ topics, and chat recency.</p>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Quiz Attempt Average</span>
          <div className="kpi-value-row">
            <span className="kpi-value">{analyticsData.factors.quizAverage}<small>%</small></span>
          </div>
          <div className="kpi-bar">
            <div className={"kpi-bar-fill " + (analyticsData.factors.quizAverage < 50 ? "danger" : analyticsData.factors.quizAverage < 70 ? "warning" : "success")} style={{ width: analyticsData.factors.quizAverage + "%" }} />
          </div>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">PYQ Topics Studied</span>
          <div className="kpi-value-row">
            <span className="kpi-value">{analyticsData.factors.pyqStudiedPercent}<small>%</small></span>
          </div>
          <div className="kpi-bar">
            <div className={"kpi-bar-fill " + (analyticsData.factors.pyqStudiedPercent < 50 ? "danger" : analyticsData.factors.pyqStudiedPercent < 70 ? "warning" : "success")} style={{ width: analyticsData.factors.pyqStudiedPercent + "%" }} />
          </div>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Study Plan Progress</span>
          <div className="kpi-value-row">
            <span className="kpi-value">{analyticsData.factors.planCompletionPercent}<small>%</small></span>
          </div>
          <div className="kpi-bar">
            <div className={"kpi-bar-fill " + (analyticsData.factors.planCompletionPercent < 50 ? "danger" : analyticsData.factors.planCompletionPercent < 70 ? "warning" : "success")} style={{ width: analyticsData.factors.planCompletionPercent + "%" }} />
          </div>
        </div>
      </div>

      {/* Mentor Risk Flag Banner */}
      <div className={"mentor-banner " + (analyticsData.riskFlag.isHighRisk ? "risk-high" : "risk-low")}>
        <div className="mentor-banner-icon">
          <Icon name={analyticsData.riskFlag.isHighRisk ? "ti-alert-triangle" : "ti-bulb"} />
        </div>
        <div className="mentor-banner-main">
          <div className="mentor-banner-label">Mentor Risk Flag</div>
          <div className="mentor-banner-message">
            &ldquo;<strong>{analyticsData.riskFlag.message}</strong>&rdquo;
          </div>
        </div>
        <div className="mentor-banner-stats">
          <div className="mentor-banner-stat">
            <span className="mentor-banner-stat-label">Spaced-Repetition</span>
            <span className="mentor-banner-stat-value">
              <span className="kpi-bar">
                <span className={"kpi-bar-fill " + (analyticsData.factors.spacedRepetitionHealth < 50 ? "danger" : analyticsData.factors.spacedRepetitionHealth < 70 ? "warning" : "success")} style={{ width: analyticsData.factors.spacedRepetitionHealth + "%" }} />
              </span>
              {analyticsData.factors.spacedRepetitionHealth}%
            </span>
          </div>
          <div className="mentor-banner-stat">
            <span className="mentor-banner-stat-label">AI Chat</span>
            <span className="mentor-banner-stat-value">
              <Icon name={analyticsData.factors.chatActiveToday ? "ti-message-circle-check" : "ti-message-circle"} />
              {analyticsData.factors.chatRecencyLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Section 2: PYQ Topic Mastery */}
      <Card style={{ marginBottom: "24px" }}>
        <div className="analytics-card-header">
          <div>
            <h3 className="analytics-card-title">PYQ Topic Mastery</h3>
            <p className="analytics-card-desc">
              Topics that appear frequently in past-year Malaysian university exams but where your accuracy is low receive an urgent priority badge.
            </p>
          </div>
          <Badge tone="brand">1-Click Practice Loop</Badge>
        </div>

        <div className="table-scroll">
        <table className="pyq-radar-table">
          <thead>
            <tr>
              <th>Topic Name</th>
              <th>5-Year PYQ Frequency</th>
              <th>Your Mastery</th>
              <th>Priority Status</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {analyticsData.topics.map(function(topic) {
              var isExpanded = expandedId === topic.id;
              var expandQs = topic.pastYearQuestions.slice(0, 2);
              return [
                <tr
                  key={topic.id}
                  className="clickable"
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  aria-label={"View past-year questions for " + topic.name}
                  onClick={function() { setExpandedId(isExpanded ? null : topic.id); }}
                  onKeyDown={function(e) {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpandedId(isExpanded ? null : topic.id);
                    }
                  }}
                >
                  <td><strong style={{ color: "var(--text)" }}>{topic.name}</strong></td>
                  <td>
                    <div className="pyq-freq-bar">
                      <div className="pyq-freq-fill" style={{ width: topic.pyqFrequency + "%" }} />
                    </div>
                    <strong>{topic.pyqFrequency}%</strong>
                  </td>
                  <td>
                    <div className="pyq-freq-bar">
                      <div
                        className="pyq-freq-fill"
                        style={{
                          width: topic.mastery + "%",
                          background: topic.mastery < 50 ? "var(--danger)" : topic.mastery < 70 ? "var(--warning)" : "var(--success)"
                        }}
                      />
                    </div>
                    <strong>{topic.mastery}%</strong>
                  </td>
                  <td>
                    {topic.isUrgent ? (
                      <span className="urgent-badge"><Icon name="ti-bolt" /> Urgent Exam Priority</span>
                    ) : (
                      <Badge tone={topic.mastery >= 80 ? "success" : "neutral"}>
                        {topic.mastery >= 80 ? "Exam Secure" : "On Track"}
                      </Badge>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className={"btn btn-sm " + (topic.isUrgent ? "btn-primary" : "btn-ghost")}
                      onClick={function(e) { e.stopPropagation(); handleOpenPractice(topic); }}
                    >
                      Practice Weak Topic &rarr;
                    </button>
                  </td>
                </tr>,
                isExpanded ? (
                  <tr key={topic.id + "-expand"}>
                    <td colSpan={5} className="topic-expand-cell">
                      {expandQs.length > 0 ? (
                        <div>
                          <div className="topic-expand-label">
                            Past Year Questions {expandQs.length < topic.pastYearQuestions.length ? "· Showing " + expandQs.length + " of " + topic.pastYearQuestions.length : ""}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {expandQs.map(function(q, qi) {
                              return (
                                <div key={qi} className="topic-expand-question chat-text-ai">
                                  <span style={{ display: "inline-block", background: "var(--brand)", color: "#fff", borderRadius: "4px", fontSize: "10px", fontWeight: "700", padding: "1px 6px", marginRight: "8px", verticalAlign: "middle", letterSpacing: "0.04em" }}>
                                    Q{qi + 1}
                                  </span>
                                  <span className="topic-expand-qtext" dangerouslySetInnerHTML={{ __html: renderMarkdown(q, true) }} />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="topic-expand-empty">No matching past-year questions found for this topic yet.</div>
                      )}
                    </td>
                  </tr>
                ) : null
              ];
            })}
          </tbody>
        </table>
        </div>
      </Card>

      {/* Section 3: Monthly Calendar Heatmap */}
      <Card>
        {/* Header with prev/next month navigation */}
        <div className="analytics-card-header">
          <div>
            <h3 className="analytics-card-title">Consistency Heatmap</h3>
            <p className="analytics-card-desc">
              Your <strong>longitudinal learning</strong> by day. Deeper green = more activity that day (quizzes, chats, PYQ practice). Hover for breakdown.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={prevMonth}>
              <Icon name="ti-chevron-left" />
            </button>
            <span style={{ fontWeight: "700", fontSize: "15px", minWidth: "120px", textAlign: "center" }}>
              {analyticsData.FULL_MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={nextMonth}
              disabled={viewYear > nowRef.current.getFullYear() || (viewYear === nowRef.current.getFullYear() && viewMonth >= nowRef.current.getMonth())}
            >
              <Icon name="ti-chevron-right" />
            </button>
          </div>
        </div>

        {/* Day-of-week column headers */}
        <div className="cal-heatmap-grid">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(function(dow) {
            return (
              <div key={dow} className="cal-heatmap-dow">{dow}</div>
            );
          })}

          {/* Offset blank cells to align first day to correct weekday */}
          {(function() {
            var firstDay = new Date(viewYear, viewMonth, 1).getDay();
            // Convert Sunday=0 to Mon-based offset (Sun=6, Mon=0)
            var offset = firstDay === 0 ? 6 : firstDay - 1;
            var blanks = [];
            for (var b = 0; b < offset; b++) {
              blanks.push(<div key={"blank-" + b} className="cal-heatmap-blank" />);
            }
            return blanks;
          })()}

          {/* Actual day squares */}
          {(function() {
            var today = new Date();
            var todayKey = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
            var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
            var cells = [];
            for (var d = 1; d <= daysInMonth; d++) {
              var dateKey = viewYear + "-" + String(viewMonth + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
              var act = analyticsData.dailyActivityMap[dateKey] || { total: 0, quiz: 0, chat: 0, pyq: 0, memory: 0 };
              var lvl = act.total === 0 ? 0 : act.total === 1 ? 1 : act.total <= 3 ? 2 : act.total <= 6 ? 3 : 4;
              var tooltip = d + " " + analyticsData.MONTH_NAMES[viewMonth] + " " + viewYear +
                " • " + act.total + " activities" +
                (act.quiz > 0 ? " | " + act.quiz + " Quiz" : "") +
                (act.chat > 0 ? " | " + act.chat + " Chat" : "") +
                (act.pyq > 0 ? " | " + act.pyq + " PYQ" : "");
              cells.push(
                <div
                  key={d}
                  className={"cal-heatmap-day heatmap-level-" + lvl + (dateKey === todayKey ? " today" : "")}
                  title={tooltip}
                >
                  <span className="cal-heatmap-label">{d}</span>
                </div>
              );
            }
            return cells;
          })()}
        </div>

        {/* Legend */}
        <div className="heatmap-legend">
          <span>No activity</span>
          <div className="heatmap-legend-square heatmap-level-0" />
          <div className="heatmap-legend-square heatmap-level-1" />
          <div className="heatmap-legend-square heatmap-level-2" />
          <div className="heatmap-legend-square heatmap-level-3" />
          <div className="heatmap-legend-square heatmap-level-4" />
          <span>Highly active</span>
        </div>
      </Card>

      {/* 1-Click Practice Weak Topic Modal */}
      {selectedTopic ? (
        <div className="dialog-overlay" onClick={function() { setSelectedTopic(null); }}>
          <div
            className="dialog"
            style={{ width: "560px" }}
            role="dialog"
            aria-modal="true"
            aria-label={"Practice weak topic: " + selectedTopic.name}
            onClick={function(e) { e.stopPropagation(); }}
          >
            <div className="dialog-header">
              <h3>Practice Weak Topic: {selectedTopic.name}</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={function() { setSelectedTopic(null); }} autoFocus>
                <Icon name="ti-x" />
              </button>
            </div>
            <div className="dialog-body">
              <div style={{ background: "var(--surface-2)", padding: "16px", borderRadius: "10px", marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--brand)", marginBottom: "6px" }}>
                  AI Predicted Practice Question
                </div>
                <div style={{ fontSize: "14px", color: "var(--text)", fontWeight: "600", lineHeight: "1.5" }}>
                  {selectedTopic.questionText}
                </div>
              </div>

              <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--muted)", textTransform: "uppercase", marginBottom: "8px" }}>
                Official Malaysian University Answer Scheme
              </div>
              <ul style={{ margin: "0 0 16px", paddingLeft: "20px", fontSize: "13px", color: "var(--text)", lineHeight: "1.6" }}>
                {selectedTopic.answerScheme.map(function(point, idx) {
                  return <li key={idx}><strong>{point.split("]")[0] + "]"}</strong>{point.split("]")[1]}</li>;
                })}
              </ul>

              {practicedSuccess ? (
                <div style={{ padding: "12px", background: "var(--success-soft)", color: "var(--success)", borderRadius: "8px", textAlign: "center", fontWeight: "700" }}>
                  <Icon name="ti-check" /> Topic Practiced! Mastery Increased +22%
                </div>
              ) : null}
            </div>
            <div className="dialog-footer">
              <button type="button" className="btn btn-ghost" onClick={function() { setSelectedTopic(null); }}>
                Close
              </button>
              {!practicedSuccess ? (
                <button type="button" className="btn btn-primary" onClick={handleCompletePractice}>
                  <Icon name="ti-check" /> Mark as Practiced &amp; Improve Mastery
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
