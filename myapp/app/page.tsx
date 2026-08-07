"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { EventList } from "@/components/domain/EventList";
import { AssignmentTracker } from "@/components/domain/AssignmentTracker";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { MetricCard } from "@/components/ui/MetricCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Icon } from "@/components/ui/Icon";
import { db } from "@/app/study/_lib/db";
import { useSession } from "@/lib/auth-context";
import { getProfile, type Profile } from "@/lib/profile-store";
import type { CalendarEvent, CampusEvent, Metric, MyCSDEvent } from "@/lib/types";
import { expandEvents } from "@/lib/planner-utils";
import { WelcomeOverlay } from "@/components/landing/WelcomeOverlay";

export default function DashboardPage() {
  var { user } = useSession();
  var userId = user?.id || "";

  var [profile, setProfile] = useState<Profile | null>(null);
  var [mycsdPoints, setMycsdPoints] = useState(0);
  var [attendedCount, setAttendedCount] = useState(0);
  var [openEventsCount, setOpenEventsCount] = useState(0);
  var [subjectsCount, setSubjectsCount] = useState(0);

  var [todayPlannerEvents, setTodayPlannerEvents] = useState<CalendarEvent[]>([]);
  var [upcomingEvents, setUpcomingEvents] = useState<CampusEvent[]>([]);
  var [loading, setLoading] = useState(true);

  var now = new Date();

  // Formatting date for eyebrow
  var dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Time-aware greeting
  var hour = now.getHours();
  var greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // Name resolution
  var rawName =
    profile?.full_name ||
    (profile as any)?.fullName ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    (user?.email && user.email.indexOf("@") !== -1 ? user.email.split("@")[0] : "");
  var firstName = rawName ? rawName.trim().split(" ")[0] : "Student";
  var dynamicTitle = greeting + ", " + firstName;

  useEffect(function() {
    async function loadDashboardData() {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        // 1. Profile & MyCSD Points
        var localProf = getProfile(userId);
        if (localProf) {
          setProfile(localProf);
          if (typeof localProf.mycsd_points === "number") {
            setMycsdPoints(localProf.mycsd_points);
          }
        }

        try {
          var dbProf = await db.getById("profiles", userId);
          if (dbProf) {
            setProfile(dbProf);
            setMycsdPoints(dbProf.mycsdPoints || dbProf.mycsd_points || 0);
          }
        } catch (_pErr) {}

        // 2. Attended Events & Registrations
        var regs = await db.listAll("event_registrations", { userId: userId }, null);
        var attended = (regs || []).filter(function(r) { return r.status === "attended"; });
        setAttendedCount(attended.length);

        // 3. Open Events & Bottom Section Upcoming Events
        var allEvents: MyCSDEvent[] = await db.listAll("events", null, "startsAt");
        var openEvents = (allEvents || []).filter(function(e) {
          return e.status === "open" && new Date(e.startsAt).getTime() > now.getTime();
        });
        setOpenEventsCount(openEvents.length);

        // Map top 3 open events to CampusEvent format for EventList card
        var top3Events: CampusEvent[] = openEvents.slice(0, 3).map(function(e) {
          var startDate = new Date(e.startsAt);
          return {
            id: e.id,
            name: e.name,
            date: startDate.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }),
            time: startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            location: e.location,
            points: e.points || 0,
            category: e.category || "General",
          };
        });
        setUpcomingEvents(top3Events);

        // 4. My Subjects Count from Study Hub
        try {
          var subjects = await db.listAll("subjects", { createdBy: userId }, null);
          setSubjectsCount(subjects ? subjects.length : 0);
        } catch (_sErr) {}

        // 5. Today's Events from Main Planner (/planner -> planner_events)
        try {
          var rawPlanner: CalendarEvent[] = await db.listAll("planner_events", { userId: userId }, "start_time");
          if (rawPlanner && rawPlanner.length > 0) {
            var monthExpanded = expandEvents(rawPlanner, now);
            var todayItems = monthExpanded.filter(function(ev) {
              var d = new Date(ev.start_time);
              return (
                d.getFullYear() === now.getFullYear() &&
                d.getMonth() === now.getMonth() &&
                d.getDate() === now.getDate()
              );
            });
            setTodayPlannerEvents(todayItems);
          }
        } catch (bErr) {
          console.warn("[DASHBOARD] Main planner events load error:", bErr);
        }

      } catch (err) {
        console.error("[DASHBOARD] load error:", err);
      }
      setLoading(false);
    }

    loadDashboardData();
  }, [userId]);

  // Real Metric Cards
  var realMetrics: Metric[] = [
    {
      label: "MyCSD points",
      value: String(mycsdPoints),
      icon: "ti-trophy",
      helper: "Persisted from attended events",
    },
    {
      label: "Events attended",
      value: String(attendedCount),
      icon: "ti-confetti",
      helper: "Verified attendance",
    },
    {
      label: "Upcoming events",
      value: String(openEventsCount),
      icon: "ti-calendar-event",
      helper: "Open for registration",
    },
    {
      label: "My subjects",
      value: String(subjectsCount),
      icon: "ti-school",
      helper: "Study Hub courses",
    },
  ];

  function formatBlockTime(isoStr: string) {
    if (!isoStr) return "";
    try {
      var d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (_e) {
      return isoStr.substring(11, 16);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--background)" }}>
        <div style={{ fontFamily: "var(--font-header)", fontWeight: 700, color: "var(--brand)" }}>Loading StudentHub...</div>
      </div>
    );
  }

  if (!user) {
    return <WelcomeOverlay />;
  }

  return (
    <AppShell>
      <PageHero
        eyebrow={dateStr}
        title={dynamicTitle}
        description="A compact campus dashboard for classes, reminders, points, and student activity."
        icon="ti-sparkles"
      />

      {/* Real Metric Cards Grid */}
      <section className="metric-grid">
        {realMetrics.map(function(metric) {
          return <MetricCard metric={metric} key={metric.label} />;
        })}
      </section>

      {/* Two Column Layout: Assignment Tracker & Today Schedule */}
      <section className="two-column">
        <div>
          <AssignmentTracker />
        </div>

        <Card className="schedule-panel">
          <SectionHeader title="Today schedule" icon="ti-calendar-event" />

          {todayPlannerEvents.length === 0 ? (
            <div style={{ padding: "16px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              <span style={{ fontSize: 24, marginBottom: 4, opacity: 0.6, display: "inline-block" }}>
                <Icon name="ti-calendar-off" />
              </span>
              <p style={{ margin: "4px 0 0", fontWeight: 600 }}>No schedule events for today</p>
              <span style={{ fontSize: 11 }}>Add events in your StudentHub Planner.</span>
            </div>
          ) : (
            todayPlannerEvents.map(function(ev: CalendarEvent, idx: number) {
              return (
                <div className="timeline-row" key={ev.id || idx}>
                  <strong>{formatBlockTime(ev.start_time)}</strong>
                  <span>{ev.title}</span>
                </div>
              );
            })
          )}

          <div style={{ marginTop: 12 }}>
            <ButtonLink href="/planner" icon="ti-books">
              View planner
            </ButtonLink>
          </div>
        </Card>
      </section>

      {/* Bottom Section: Real Open Events */}
      <section style={{ marginTop: 24 }}>
        <SectionHeader
          title="Events open for registration"
          description="Latest MyCSD activities posted on campus"
          icon="ti-confetti"
        />
        {upcomingEvents.length === 0 ? (
          <Card style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>
            <p style={{ margin: 0, fontSize: 14 }}>No upcoming open events right now.</p>
            <div style={{ marginTop: 10, display: "inline-flex" }}>
              <ButtonLink href="/events" icon="ti-plus">
                Explore MyCSD Events
              </ButtonLink>
            </div>
          </Card>
        ) : (
          <EventList events={upcomingEvents} />
        )}
      </section>
    </AppShell>
  );
}
