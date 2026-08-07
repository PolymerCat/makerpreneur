"use client";

import "./events.css";
import React, { useMemo } from "react";
import { db } from "@/app/study/_lib/db";
import { useSession } from "@/lib/auth-context";
import type { EventRegistration, EventRegistrationStatus, MyCSDEvent } from "@/lib/types";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import {
  EVENT_CATEGORIES,
  EventCreateForm,
  type EventInput,
} from "@/components/domain/EventCreateForm";
import { RegistrationForm } from "@/components/domain/RegistrationForm";
import { EventRosterModal, participantsCsv } from "@/components/domain/EventRosterModal";

function formatWhen(iso: string, endsIso?: string | null): string {
  var startStr = new Date(iso).toLocaleString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (!endsIso) return startStr;
  var endStr = new Date(endsIso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return startStr + " to " + endStr;
}

function statusTone(status: EventRegistrationStatus): "brand" | "success" | "warning" | "neutral" {
  if (status === "attended") return "success";
  if (status === "no_show") return "warning";
  if (status === "cancelled") return "neutral";
  return "brand";
}

function statusLabel(status: EventRegistrationStatus): string {
  if (status === "attended") return "Attended";
  if (status === "no_show") return "No-show";
  if (status === "cancelled") return "Cancelled";
  return "Registered";
}

export default function EventsPage() {
  var { user } = useSession();
  var userId = user?.id || "";

  var [showFilter, setShowFilter] = React.useState(false);
  var [showSort, setShowSort] = React.useState(false);
  var [regsCollapsed, setRegsCollapsed] = React.useState(false);
  var [myEventsCollapsed, setMyEventsCollapsed] = React.useState(false);
  var [events, setEvents] = React.useState<MyCSDEvent[]>([]);
  var [registrations, setRegistrations] = React.useState<EventRegistration[]>([]);
  var [loading, setLoading] = React.useState(true);
  var [notice, setNotice] = React.useState("");

  var [showCreate, setShowCreate] = React.useState(false);
  var [editEvent, setEditEvent] = React.useState<MyCSDEvent | null>(null);
  var [detailEvent, setDetailEvent] = React.useState<MyCSDEvent | null>(null);
  var [registerEvent, setRegisterEvent] = React.useState<MyCSDEvent | null>(null);
  var [rosterEvent, setRosterEvent] = React.useState<MyCSDEvent | null>(null);
  var [rosterRegs, setRosterRegs] = React.useState<EventRegistration[]>([]);

  var [sortBy, setSortBy] = React.useState("earliest");
  var [search, setSearch] = React.useState("");
  var [categoryFilter, setCategoryFilter] = React.useState<string[]>(EVENT_CATEGORIES);
  var [organizerFilter, setOrganizerFilter] = React.useState("");
  var [regFilter, setRegFilter] = React.useState("all");

  async function loadAll() {
    try {
      var evs = await db.listAll("events", null, null);
      setEvents(evs);
      if (userId) {
        var regs = await db.listAll("event_registrations", { userId: userId }, null);
        setRegistrations(regs);
      }
      // Check query parameter ?eventId=... to auto-open details modal
      if (typeof window !== "undefined") {
        var params = new URLSearchParams(window.location.search);
        var targetId = params.get("eventId");
        if (targetId && evs && evs.length > 0) {
          var targetEv = evs.find(function(e) { return e.id === targetId; });
          if (targetEv) setDetailEvent(targetEv);
        }
      }
    } catch (err) {
      console.error("[EVENTS] Failed to load:", err);
    }
    setLoading(false);
  }

  React.useEffect(function() {
    loadAll();
  }, [userId]);

  function flashNotice(msg: string) {
    setNotice(msg);
    setTimeout(function() { setNotice(""); }, 4000);
  }

  var now = new Date();
  var eventById: Record<string, MyCSDEvent> = {};
  for (var i = 0; i < events.length; i++) {
    eventById[events[i].id] = events[i];
  }

  function myRegistration(eventId: string): EventRegistration | null {
    var mine = registrations.filter(function(r) { return r.eventId === eventId; });
    return mine.length > 0 ? mine[mine.length - 1] : null;
  }

  var attendedRegs = registrations.filter(function(r) { return r.status === "attended"; });
  var pointsTotal = attendedRegs.reduce(function(sum, r) {
    var ev = eventById[r.eventId];
    return sum + (ev ? ev.points : 0);
  }, 0);

  /* --- Browse --- */

  var browseEvents = useMemo(function() {
    return events
      .filter(function(e) {
        return e.status === "open" && new Date(e.startsAt).getTime() > now.getTime();
      })
      .filter(function(e) {
        if (categoryFilter.length === 0) return true;
        return categoryFilter.indexOf(e.category) !== -1;
      })
      .filter(function(e) {
        if (!organizerFilter.trim()) return true;
        return e.organizer.toLowerCase().indexOf(organizerFilter.trim().toLowerCase()) !== -1;
      })
      .filter(function(e) {
        if (!search.trim()) return true;
        return e.name.toLowerCase().indexOf(search.trim().toLowerCase()) !== -1;
      })
      .sort(function(a, b) {
        if (sortBy === "points") return b.points - a.points;
        if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sortBy === "closing") return new Date(a.registrationDeadline).getTime() - new Date(b.registrationDeadline).getTime();
        return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
      });
  }, [events, sortBy, search, categoryFilter, organizerFilter]);

  /* --- My registrations --- */

  var myRegs = registrations
    .map(function(r) { return { reg: r, event: eventById[r.eventId] }; })
    .filter(function(item) { return !!item.event; })
    .filter(function(item) {
      if (regFilter === "all") return true;
      return item.reg.status === regFilter;
    });

  var upcomingRegs = myRegs
    .filter(function(item) { return new Date(item.event.startsAt).getTime() > now.getTime(); })
    .sort(function(a, b) { return new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime(); });

  var pastRegs = myRegs
    .filter(function(item) { return new Date(item.event.startsAt).getTime() <= now.getTime(); })
    .sort(function(a, b) { return new Date(b.event.startsAt).getTime() - new Date(a.event.startsAt).getTime(); });

  /* --- My events --- */

  var myEvents = events.filter(function(e) { return e.createdBy === userId; });
  var upcomingMyEvents = myEvents
    .filter(function(e) { return e.status === "open" && new Date(e.startsAt).getTime() > now.getTime(); })
    .sort(function(a, b) { return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(); });
  var pastMyEvents = myEvents
    .filter(function(e) { return e.status !== "open" || new Date(e.startsAt).getTime() <= now.getTime(); })
    .sort(function(a, b) { return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(); });

  /* --- Mutations --- */

  async function handleCreate(data: EventInput) {
    try {
      await db.insert("events", {
        createdBy: userId,
        name: data.name,
        organizer: data.organizer,
        category: data.category,
        startsAt: data.startsAt,
        endsAt: data.endsAt || null,
        imageUrl: data.imageUrl || null,
        location: data.location,
        points: data.points,
        fee: data.fee || null,
        registrationDeadline: data.registrationDeadline,
        description: data.description || null,
        formFields: data.formFields,
        status: "open",
        registeredCount: 0,
      });
      setShowCreate(false);
      flashNotice("Event posted.");
      await loadAll();
    } catch (err) {
      console.error("[EVENTS] create error:", err);
    }
  }

  async function handleUpdate(id: string, data: EventInput) {
    try {
      await db.update("events", id, {
        name: data.name,
        organizer: data.organizer,
        category: data.category,
        startsAt: data.startsAt,
        endsAt: data.endsAt || null,
        imageUrl: data.imageUrl || null,
        location: data.location,
        points: data.points,
        fee: data.fee || null,
        registrationDeadline: data.registrationDeadline,
        description: data.description || null,
        formFields: data.formFields,
      });
      setEditEvent(null);
      flashNotice("Event updated.");
      await loadAll();
    } catch (err) {
      console.error("[EVENTS] update error:", err);
    }
  }

  async function handleRegister(ev: MyCSDEvent, answers: Record<string, string>) {
    try {
      await db.insert("event_registrations", {
        eventId: ev.id,
        userId: userId,
        answers: answers,
        status: "registered",
      });
      await db.update("events", ev.id, { registeredCount: (ev.registeredCount || 0) + 1 });
      setRegisterEvent(null);
      flashNotice("You have successfully registered for " + ev.name + "!");
      await loadAll();
    } catch (err) {
      console.error("[EVENTS] register error:", err);
    }
  }

  async function handleCancelRegistration(reg: EventRegistration) {
    try {
      if (!window.confirm("Cancel your registration for this event?")) return;
      await db.update("event_registrations", reg.id, { status: "cancelled" });
      var ev = eventById[reg.eventId];
      if (ev) {
        await db.update("events", ev.id, { registeredCount: Math.max(0, (ev.registeredCount || 0) - 1) });
      }
      flashNotice("Registration cancelled.");
      await loadAll();
    } catch (err) {
      console.error("[EVENTS] cancel registration error:", err);
    }
  }

  async function handleCancelEvent(ev: MyCSDEvent) {
    try {
      if (!window.confirm("Cancel this event? Registrants will be notified via the events page.")) return;
      await db.update("events", ev.id, { status: "cancelled" });
      setDetailEvent(null);
      flashNotice("Event cancelled.");
      await loadAll();
    } catch (err) {
      console.error("[EVENTS] cancel event error:", err);
    }
  }

  async function openRoster(ev: MyCSDEvent) {
    try {
      var regs = await db.listAll("event_registrations", { eventId: ev.id }, null);
      setRosterRegs(regs);
      setRosterEvent(ev);
    } catch (err) {
      console.error("[EVENTS] roster load error:", err);
    }
  }

  async function handleSetAttendance(regId: string, status: EventRegistrationStatus) {
    try {
      var targetReg = rosterRegs.find(function(r) { return r.id === regId; });
      var oldStatus = targetReg?.status;

      await db.update("event_registrations", regId, { status: status });
      setRosterRegs(rosterRegs.map(function(r) {
        return r.id === regId ? { ...r, status: status } : r;
      }));

      // Durable MyCSD Points logic: update student's profile mycsd_points in DB
      if (targetReg && rosterEvent && rosterEvent.points > 0) {
        var studentUserId = targetReg.userId;
        var pts = rosterEvent.points;
        if (oldStatus !== "attended" && status === "attended") {
          try {
            var studentProf = await db.getById("profiles", studentUserId);
            var currentPts = studentProf ? (studentProf.mycsdPoints || 0) : 0;
            await db.update("profiles", studentUserId, { mycsdPoints: currentPts + pts });
          } catch (pErr) {
            console.warn("[EVENTS] Failed to award MyCSD points to profile:", pErr);
          }
        } else if (oldStatus === "attended" && status !== "attended") {
          try {
            var studentProf2 = await db.getById("profiles", studentUserId);
            var currentPts2 = studentProf2 ? (studentProf2.mycsdPoints || 0) : 0;
            await db.update("profiles", studentUserId, { mycsdPoints: Math.max(0, currentPts2 - pts) });
          } catch (pErr2) {
            console.warn("[EVENTS] Failed to revoke MyCSD points from profile:", pErr2);
          }
        }
      }

      await loadAll();
    } catch (err) {
      console.error("[EVENTS] attendance error:", err);
    }
  }

  async function exportFromRow(ev: MyCSDEvent) {
    try {
      var regs = await db.listAll("event_registrations", { eventId: ev.id }, null);
      participantsCsv(ev, regs);
    } catch (err) {
      console.error("[EVENTS] export error:", err);
    }
  }

  function toggleCategory(cat: string) {
    setCategoryFilter(function(prev) {
      if (prev.indexOf(cat) !== -1) {
        return prev.filter(function(c) { return c !== cat; });
      }
      return prev.concat([cat]);
    });
  }

  /* --- Renders --- */

  function renderEventCard(ev: MyCSDEvent) {
    var deadlineOpen = new Date(ev.registrationDeadline).getTime() > now.getTime();
    var isOwner = ev.createdBy === userId;
    var myReg = myRegistration(ev.id);
    return (
      <Card key={ev.id} className="event-card ev-event-card-clickable" onClick={function() { setDetailEvent(ev); }}>
        {ev.imageUrl ? (
          <div className="ev-card-image-wrap">
            <img src={ev.imageUrl} alt={ev.name} className="ev-cover-img" />
          </div>
        ) : (
          <div className="ev-card-placeholder">
            <span className="ev-card-placeholder-label">{ev.category}</span>
          </div>
        )}

        <div className="ev-card-body">
          <div className="ev-card-badges-row">
            <Badge tone="neutral">{ev.category}</Badge>
            <Badge>{ev.points} MyCSD points</Badge>
          </div>
          <h3 className="ev-card-title">{ev.name}</h3>
          <p className="ev-card-organizer">by {ev.organizer}</p>
          <p className="ev-card-meta">
            <Icon name="ti-calendar" /> {formatWhen(ev.startsAt, ev.endsAt)}
          </p>
          <p className="ev-card-meta-tight">
            <Icon name="ti-map-pin" /> {ev.location}
          </p>
          <div className="ev-card-stats">
            {ev.fee && (
              <span className="ev-text-muted">
                <Icon name="ti-wallet" /> {ev.fee}
              </span>
            )}
            <span className="ev-text-muted">
              <Icon name="ti-users" /> {ev.registeredCount} registered
            </span>
            <span className={deadlineOpen ? "ev-deadline-open" : "ev-deadline-closed"}>
              <Icon name="ti-clock" /> {deadlineOpen ? "Closes " : "Closed "}{formatWhen(ev.registrationDeadline)}
            </span>
          </div>
          <div className="ev-card-status">
            {myReg ? (
              <Badge tone={statusTone(myReg.status)}>{statusLabel(myReg.status)}</Badge>
            ) : isOwner ? (
              <Badge tone="neutral">You organize this</Badge>
            ) : (
              <Badge tone="brand">Open for registration</Badge>
            )}
          </div>
        </div>
      </Card>
    );
  }

  function renderDetailModal() {
    if (!detailEvent) return null;
    var ev = eventById[detailEvent.id] || detailEvent;
    var isOwner = ev.createdBy === userId;
    var myReg = myRegistration(ev.id);
    var deadlineOpen = new Date(ev.registrationDeadline).getTime() > now.getTime();
    var eventEnded = new Date(ev.startsAt).getTime() <= now.getTime();
    var canRegister = !isOwner && !myReg && ev.status === "open" && deadlineOpen && !eventEnded;
    var canCancelReg = myReg && myReg.status === "registered" && deadlineOpen && ev.status === "open";

    return (
      <div className="modal-backdrop" onClick={function() { setDetailEvent(null); }}>
        <Card className="modal ev-detail-modal" onClick={function(e) { e.stopPropagation(); }}>
          {ev.imageUrl ? (
            <div className="ev-detail-image-banner">
              <div className="ev-detail-poster-frame">
                <img src={ev.imageUrl} alt={ev.name} className="ev-cover-img" />
              </div>
            </div>
          ) : (
            <div className="ev-card-placeholder-lg">
              <span className="ev-card-placeholder-label-lg">{ev.category}</span>
            </div>
          )}

          <div className="ev-detail-body">
            <div className="ev-detail-header-row">
              <div>
                <h3 className="ev-detail-title">{ev.name}</h3>
                <p className="ev-detail-organizer">Organized by <strong>{ev.organizer}</strong></p>
              </div>
              <button className="small-action ev-detail-close" type="button" onClick={function() { setDetailEvent(null); }} aria-label="Close">
                <Icon name="ti-x" />
              </button>
            </div>

            <div className="ev-detail-badges">
              <Badge tone="neutral">{ev.category}</Badge>
              <Badge>{ev.points} MyCSD points</Badge>
              {ev.fee && <Badge tone="neutral">{ev.fee}</Badge>}
              {ev.status === "cancelled" && <Badge tone="warning">Cancelled by organizer</Badge>}
            </div>

            {ev.description && (
              <div className="ev-detail-about">
                <h4 className="ev-detail-about-title">About this Event</h4>
                <p className="ev-detail-about-text">{ev.description}</p>
              </div>
            )}

            <div className="ev-detail-info-grid">
              <div>
                <p className="ev-detail-label">DATE & TIME</p>
                <p className="ev-detail-value"><Icon name="ti-calendar" /> {formatWhen(ev.startsAt, ev.endsAt)}</p>
                <p className="ev-detail-label">LOCATION</p>
                <p className="ev-detail-value-last"><Icon name="ti-map-pin" /> {ev.location}</p>
              </div>
              <div>
                <p className="ev-detail-label">REGISTRATION DEADLINE</p>
                <p className="ev-detail-value">
                  <Icon name="ti-clock" /> {formatWhen(ev.registrationDeadline)} ({deadlineOpen ? "Open" : "Closed"})
                </p>
                <p className="ev-detail-label">ATTENDEES</p>
                <p className="ev-detail-value-last"><Icon name="ti-users" /> {ev.registeredCount} registered</p>
              </div>
            </div>

            {eventEnded && ev.status === "open" && (
              <p className="ev-detail-ended-note">This event has already taken place.</p>
            )}

            {myReg && (
              <div className="ev-detail-reg-box">
                <div className="ev-detail-reg-header">
                  <h4 className="ev-detail-reg-title">Your Registration Details</h4>
                  <Badge tone={statusTone(myReg!.status)}>{statusLabel(myReg!.status)}</Badge>
                </div>
                {ev.formFields.map(function(f) {
                  return (
                    <p key={f.id} className="ev-detail-reg-field">
                      <span className="ev-detail-reg-label">{f.label}: </span>
                      {String(myReg!.answers[f.id] ?? "") || "—"}
                    </p>
                  );
                })}
              </div>
            )}

            <div className="ev-detail-actions">
              {canRegister && (
                <button className="btn btn-primary ev-btn-modal-primary" type="button" onClick={function() { setRegisterEvent(ev); setDetailEvent(null); }}>
                  <Icon name="ti-user-plus" /> Register Now
                </button>
              )}
              {canCancelReg && (
                <button
                  className="btn btn-ghost ev-btn-modal-ghost"
                  type="button"
                  onClick={function() { handleCancelRegistration(myReg!); }}
                >
                  <Icon name="ti-x" /> Cancel Registration
                </button>
              )}
              {isOwner && ev.status === "open" && (
                <>
                  {ev.registeredCount === 0 && (
                    <button className="btn btn-ghost ev-btn-modal-ghost" type="button" onClick={function() { setEditEvent(ev); setDetailEvent(null); }}>
                      <Icon name="ti-pencil" /> Edit Event
                    </button>
                  )}
                  <button className="btn btn-ghost ev-btn-modal-ghost" type="button" onClick={function() { setDetailEvent(null); openRoster(ev); }}>
                    <Icon name="ti-users" /> View Roster
                  </button>
                  <button className="btn btn-ghost ev-btn-modal-ghost" type="button" onClick={function() { handleCancelEvent(ev); }}>
                    <Icon name="ti-ban" /> Cancel Event
                  </button>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <AppShell>
      {/* Compact Minimal Header replacing giant PageHero & Metric Cards */}
      <div className="ev-page-header">
        <div>
          <h1 className="ev-page-title">
            <Icon name="ti-ticket" /> Events & Opportunities
          </h1>
          <p className="ev-page-subtitle">
            Discover events, register in one step, and track your MyCSD points.
          </p>
        </div>
        <div className="ev-page-badges">
          <Badge tone="brand">
            <Icon name="ti-trophy" /> {pointsTotal} MyCSD Points
          </Badge>
          <Badge tone="neutral">
            <Icon name="ti-checkup-list" /> {attendedRegs.length} Activities
          </Badge>
        </div>
      </div>

      {notice && (
        <div className="ev-notice">
          <span className="ev-notice-icon">
            <Icon name="ti-check" />
          </span>
          <span>{notice}</span>
          <button
            type="button"
            onClick={function() { setNotice(""); }}
            className="ev-notice-dismiss"
            aria-label="Dismiss"
          >
            <Icon name="ti-x" />
          </button>
        </div>
      )}

      {/* Search Bar + Icon-based Filter & Sort popover controls */}
      <div className="events-controls-row">
        <div className="events-search-input-wrap">
          <Icon name="ti-search" className="search-icon" />
          <input
            className="events-search-input"
            value={search}
            onChange={function(e) { setSearch(e.target.value); }}
            placeholder="Search events by title..."
          />
        </div>

        <div className="ev-popover-anchor">
          <button
            type="button"
            className={"icon-btn-toggle" + (showFilter || categoryFilter.length < EVENT_CATEGORIES.length || organizerFilter ? " active" : "")}
            onClick={function() { setShowFilter(function(v) { return !v; }); setShowSort(false); }}
            title="Filter events"
            aria-label="Filter events"
          >
            <Icon name="ti-filter" />
          </button>

          {showFilter && (
            <div className="popover-panel">
              <div className="ev-filter-header">
                <h4 className="ev-popover-title">Filter Events</h4>
                <button
                  type="button"
                  className="btn btn-xs btn-ghost ev-popover-reset"
                  onClick={function() { setCategoryFilter(EVENT_CATEGORIES); setOrganizerFilter(""); }}
                >
                  Reset
                </button>
              </div>

              <h5 className="ev-filter-label">Categories</h5>
              <div className="ev-category-chips">
                {EVENT_CATEGORIES.map(function(cat) {
                  var active = categoryFilter.indexOf(cat) !== -1;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={function() { toggleCategory(cat); }}
                      className={(active ? "btn btn-sm btn-primary" : "btn btn-sm btn-ghost") + " ev-category-chip"}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              <h5 className="ev-filter-label-organizer">Organizer</h5>
              <input
                className="ev-input ev-input-full"
                value={organizerFilter}
                onChange={function(e) { setOrganizerFilter(e.target.value); }}
                placeholder="Filter by organizer..."
              />
            </div>
          )}
        </div>

        <div className="ev-popover-anchor">
          <button
            type="button"
            className={"icon-btn-toggle" + (showSort ? " active" : "")}
            onClick={function() { setShowSort(function(v) { return !v; }); setShowFilter(false); }}
            title="Sort events"
            aria-label="Sort events"
          >
            <Icon name="ti-arrows-sort" />
          </button>

          {showSort && (
            <div className="popover-panel ev-sort-panel">
              <h4 className="ev-popover-title-spaced">Sort Events</h4>
              <div className="ev-sort-options">
                {[
                  { value: "earliest", label: "Earliest first" },
                  { value: "points", label: "Most MyCSD points" },
                  { value: "newest", label: "Most recently posted" },
                  { value: "closing", label: "Closing soonest" },
                ].map(function(opt) {
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className={"btn btn-sm " + (sortBy === opt.value ? "btn-primary" : "btn-ghost") + " ev-sort-option"}
                      onClick={function() { setSortBy(opt.value); setShowSort(false); }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="ev-popover-anchor">
          <button
            type="button"
            className={"icon-btn-toggle" + (regsCollapsed && myEventsCollapsed ? " active" : "")}
            onClick={function() {
              var next = !(regsCollapsed && myEventsCollapsed);
              setRegsCollapsed(next);
              setMyEventsCollapsed(next);
            }}
            title={regsCollapsed && myEventsCollapsed ? "Expand sidebars" : "Collapse sidebars"}
            aria-label="Toggle sidebars"
          >
            <Icon name={regsCollapsed && myEventsCollapsed ? "ti-layout-sidebar-left-expand" : "ti-layout-sidebar-right-collapse"} />
          </button>
        </div>
      </div>

      {loading ? (
        <p className="ev-loading">Loading events…</p>
      ) : (
        /* Simultaneous 3-Section Dashboard Layout */
        <div className={"events-dashboard-grid" + (regsCollapsed && myEventsCollapsed ? " sidebar-collapsed" : "")}>
          {/* Main Area: Browse Events */}
          <div className="ev-main-column">
            <Card>
              <div className="ev-section-header-wrap">
                <h3 className="ev-section-title">
                  <Icon name="ti-compass" /> Browse Events <span className="badge ev-badge-sm">{browseEvents.length}</span>
                </h3>
              </div>

              {browseEvents.length === 0 ? (
                <div>
                  <h4 className="ev-empty-title">No events match</h4>
                  <p className="ev-empty-text">
                    Try clearing filters, or post the first event yourself using the floating button at the bottom-right.
                  </p>
                </div>
              ) : (
                <div className="responsive-grid ev-browse-grid">
                  {browseEvents.map(renderEventCard)}
                </div>
              )}
            </Card>
          </div>

          {/* Right Sidebar: My Registrations & My Events */}
          <div className="ev-sidebar-column">
            {/* Section 2: My Registrations */}
            <Card className="ev-sidebar-card">
              <div
                className="ev-collapsible-header"
                onClick={function() { setRegsCollapsed(!regsCollapsed); }}
              >
                <h3 className="ev-sidebar-title">
                  <Icon name="ti-calendar-event" /> My Registrations <span className="badge ev-badge-sm">{myRegs.length}</span>
                </h3>
                <div className="ev-chevron-wrap">
                  <Icon name={regsCollapsed ? "ti-chevron-down" : "ti-chevron-up"} />
                </div>
              </div>

              {!regsCollapsed && (
                <div className="ev-sidebar-body">
                  <div className="ev-reg-filter-row">
                    <h4 className="ev-section-label">Upcoming</h4>
                    <select
                      className="ev-select-sm"
                      value={regFilter}
                      onChange={function(e) { setRegFilter(e.target.value); }}
                      aria-label="Filter registrations by status"
                    >
                      <option value="all">All statuses</option>
                      <option value="registered">Registered</option>
                      <option value="attended">Attended</option>
                      <option value="no_show">No-show</option>
                    </select>
                  </div>

                  {upcomingRegs.length === 0 ? (
                    <p className="ev-muted-sm-mb">No upcoming registrations.</p>
                  ) : (
                    <div className="ev-list-column-spaced">
                      {upcomingRegs.map(function(item) {
                        var ev = item.event;
                        var canCancel = item.reg.status === "registered" &&
                          new Date(ev.registrationDeadline).getTime() > now.getTime() &&
                          ev.status === "open";
                        return (
                          <div key={item.reg.id} className="ev-list-item">
                            <div className="ev-list-item-header">
                              <h4 className="ev-list-item-title">{ev.name}</h4>
                              <Badge tone={statusTone(item.reg.status)}>{statusLabel(item.reg.status)}</Badge>
                            </div>
                            <p className="ev-list-item-organizer">by {ev.organizer}</p>
                            <p className="ev-list-item-meta"><Icon name="ti-calendar" /> {formatWhen(ev.startsAt)}</p>
                            <div className="ev-list-item-actions">
                              <button className="btn btn-xs btn-ghost ev-btn-xs-outline" type="button" onClick={function() { setDetailEvent(ev); }}>
                                Details
                              </button>
                              {canCancel && (
                                <button
                                  className="btn btn-xs btn-ghost ev-btn-xs-outline"
                                  type="button"
                                  onClick={function() { handleCancelRegistration(item.reg); }}
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <h4 className="ev-section-label-past">Past</h4>
                  {pastRegs.length === 0 ? (
                    <p className="ev-muted-sm">No past registrations.</p>
                  ) : (
                    <div className="ev-list-column">
                      {pastRegs.map(function(item) {
                        var ev = item.event;
                        return (
                          <div key={item.reg.id} className="ev-list-item">
                            <div className="ev-list-item-header">
                              <h4 className="ev-list-item-title">{ev.name}</h4>
                              <Badge tone={statusTone(item.reg.status)}>{statusLabel(item.reg.status)}</Badge>
                            </div>
                            <p className="ev-list-item-meta-compact">{formatWhen(ev.startsAt)}</p>
                            <div className="ev-list-item-actions">
                              <button className="btn btn-xs btn-ghost ev-btn-xs-outline" type="button" onClick={function() { setDetailEvent(ev); }}>
                                Details
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Section 3: My Events */}
            <Card className="ev-sidebar-card">
              <div
                className="ev-collapsible-header"
                onClick={function() { setMyEventsCollapsed(!myEventsCollapsed); }}
              >
                <h3 className="ev-sidebar-title">
                  <Icon name="ti-user-check" /> My Events <span className="badge ev-badge-sm">{myEvents.length}</span>
                </h3>
                <div className="ev-chevron-wrap">
                  <Icon name={myEventsCollapsed ? "ti-chevron-down" : "ti-chevron-up"} />
                </div>
              </div>

              {!myEventsCollapsed && (
                <div className="ev-sidebar-body">
                  <h4 className="ev-section-label-organized">Upcoming Organized</h4>
                  {upcomingMyEvents.length === 0 ? (
                    <p className="ev-muted-sm-mb">You are not organizing any upcoming events.</p>
                  ) : (
                    <div className="ev-list-column-spaced">
                      {upcomingMyEvents.map(function(ev) {
                        return (
                          <div key={ev.id} className="ev-list-item">
                            <div className="ev-list-item-header">
                              <h4 className="ev-list-item-title">{ev.name}</h4>
                              <Badge>{ev.registeredCount} registered</Badge>
                            </div>
                            <p className="ev-list-item-meta"><Icon name="ti-calendar" /> {formatWhen(ev.startsAt)}</p>
                            <div className="ev-list-item-actions-wrap">
                              {ev.registeredCount === 0 && (
                                <button className="btn btn-xs btn-ghost ev-btn-xs-outline" type="button" onClick={function() { setEditEvent(ev); }}>
                                  <Icon name="ti-pencil" /> Edit
                                </button>
                              )}
                              <button className="btn btn-xs btn-ghost ev-btn-xs-outline" type="button" onClick={function() { openRoster(ev); }}>
                                <Icon name="ti-users" /> Roster
                              </button>
                              <button className="btn btn-xs btn-ghost ev-btn-xs-outline" type="button" onClick={function() { exportFromRow(ev); }}>
                                <Icon name="ti-download" /> CSV
                              </button>
                              <button className="btn btn-xs btn-ghost ev-btn-xs-outline" type="button" onClick={function() { handleCancelEvent(ev); }}>
                                <Icon name="ti-ban" /> Cancel
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <h4 className="ev-section-label-past-organized">Past / Cancelled</h4>
                  {pastMyEvents.length === 0 ? (
                    <p className="ev-muted-sm">Nothing here yet.</p>
                  ) : (
                    <div className="ev-list-column">
                      {pastMyEvents.map(function(ev) {
                        return (
                          <div key={ev.id} className="ev-list-item">
                            <div className="ev-list-item-header">
                              <h4 className="ev-list-item-title">{ev.name}</h4>
                              {ev.status === "cancelled" && <Badge tone="warning">Cancelled</Badge>}
                            </div>
                            <p className="ev-list-item-meta-compact">{formatWhen(ev.startsAt)} · {ev.registeredCount} registered</p>
                            <div className="ev-list-item-actions-row">
                              <button className="btn btn-xs btn-ghost ev-btn-xs-outline" type="button" onClick={function() { openRoster(ev); }}>
                                <Icon name="ti-users" /> Roster
                              </button>
                              <button className="btn btn-xs btn-ghost ev-btn-xs-outline" type="button" onClick={function() { exportFromRow(ev); }}>
                                <Icon name="ti-download" /> CSV
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Floating Action Button (FAB) for Post Event */}
      <button
        type="button"
        className="fab-button"
        onClick={function() { setShowCreate(true); }}
        title="Post Event"
        aria-label="Post Event"
      >
        <Icon name="ti-plus" />
      </button>

      {showCreate && (
        <EventCreateForm onSave={handleCreate} onClose={function() { setShowCreate(false); }} />
      )}
      {editEvent && (
        <EventCreateForm initial={editEvent} onSave={function(data) { handleUpdate(editEvent!.id, data); }} onClose={function() { setEditEvent(null); }} />
      )}
      {registerEvent && (
        <RegistrationForm
          event={registerEvent}
          prefill={{ "f-email": user?.email || "" }}
          onSubmit={function(answers) { handleRegister(registerEvent!, answers); }}
          onClose={function() { setRegisterEvent(null); }}
        />
      )}
      {rosterEvent && (
        <EventRosterModal
          event={rosterEvent}
          registrations={rosterRegs}
          onSetAttendance={handleSetAttendance}
          onClose={function() { setRosterEvent(null); }}
        />
      )}
      {renderDetailModal()}
    </AppShell>
  );
}
