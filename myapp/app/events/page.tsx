"use client";

import React, { useMemo } from "react";
import { db } from "@/app/study/_lib/db";
import { useSession } from "@/lib/auth-context";
import type { EventRegistration, EventRegistrationStatus, MyCSDEvent } from "@/lib/types";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { MetricCard } from "@/components/ui/MetricCard";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  EVENT_CATEGORIES,
  EventCreateForm,
  type EventInput,
} from "@/components/domain/EventCreateForm";
import { RegistrationForm } from "@/components/domain/RegistrationForm";
import { EventRosterModal, participantsCsv } from "@/components/domain/EventRosterModal";

type TabKey = "browse" | "mine" | "myevents";

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
  return startStr + " – " + endStr;
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
      flashNotice("You are registered for " + ev.name + ".");
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
      await db.update("event_registrations", regId, { status: status });
      setRosterRegs(rosterRegs.map(function(r) {
        return r.id === regId ? { ...r, status: status } : r;
      }));
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
      <Card key={ev.id} className="event-card" style={{ cursor: "pointer", padding: 0, overflow: "hidden" }} onClick={function() { setDetailEvent(ev); }}>
        {ev.imageUrl ? (
          <div style={{ width: "100%", aspectRatio: "210 / 297", maxHeight: 340, overflow: "hidden", background: "var(--line)", borderBottom: "1px solid var(--line)" }}>
            <img src={ev.imageUrl} alt={ev.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        ) : (
          <div style={{ width: "100%", height: 75, background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", borderBottom: "1px solid var(--line)" }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{ev.category}</span>
          </div>
        )}

        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <Badge tone="neutral">{ev.category}</Badge>
            <Badge>{ev.points} MyCSD points</Badge>
          </div>
          <h3 style={{ margin: "10px 0 2px", fontSize: 16, fontWeight: 700 }}>{ev.name}</h3>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>by {ev.organizer}</p>
          <p style={{ margin: "8px 0 0", fontSize: 13 }}>
            <Icon name="ti-calendar" /> {formatWhen(ev.startsAt, ev.endsAt)}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 13 }}>
            <Icon name="ti-map-pin" /> {ev.location}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8, alignItems: "center", fontSize: 13 }}>
            {ev.fee && (
              <span style={{ color: "var(--muted)" }}>
                <Icon name="ti-wallet" /> {ev.fee}
              </span>
            )}
            <span style={{ color: "var(--muted)" }}>
              <Icon name="ti-users" /> {ev.registeredCount} registered
            </span>
            <span style={{ color: deadlineOpen ? "var(--muted)" : "var(--warning)" }}>
              <Icon name="ti-clock" /> {deadlineOpen ? "Closes " : "Closed "}{formatWhen(ev.registrationDeadline)}
            </span>
          </div>
          <div style={{ marginTop: 10 }}>
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
        <Card className="modal" style={{ padding: 0, width: "min(880px, 94vw)", maxHeight: "90vh", overflowY: "auto" }} onClick={function(e) { e.stopPropagation(); }}>
          {ev.imageUrl ? (
            <div style={{ width: "100%", background: "var(--surface)", padding: "24px 0", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "center", alignItems: "center" }}>
              <div style={{ width: "min(320px, 80vw)", aspectRatio: "210 / 297", borderRadius: "var(--radius)", overflow: "hidden", border: "1px solid var(--line)", boxShadow: "0 8px 28px rgba(0,0,0,0.15)", background: "#fff" }}>
                <img src={ev.imageUrl} alt={ev.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            </div>
          ) : (
            <div style={{ width: "100%", height: 120, background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", borderBottom: "1px solid var(--line)" }}>
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{ev.category}</span>
            </div>
          )}

          <div style={{ padding: 28 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 24, fontWeight: 700, fontFamily: "'Outfit', sans-serif", lineHeight: 1.2 }}>{ev.name}</h3>
                <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 14 }}>Organized by <strong>{ev.organizer}</strong></p>
              </div>
              <button className="small-action" type="button" onClick={function() { setDetailEvent(null); }} aria-label="Close" style={{ cursor: "pointer", fontSize: 18, padding: 6 }}>
                <Icon name="ti-x" />
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
              <Badge tone="neutral">{ev.category}</Badge>
              <Badge>{ev.points} MyCSD points</Badge>
              {ev.fee && <Badge tone="neutral">{ev.fee}</Badge>}
              {ev.status === "cancelled" && <Badge tone="warning">Cancelled by organizer</Badge>}
            </div>

            {ev.description && (
              <div style={{ marginBottom: 24, background: "var(--surface)", padding: 18, borderRadius: "var(--radius)", border: "1px solid var(--line)" }}>
                <h4 style={{ margin: "0 0 8px", fontSize: 14, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--muted)" }}>About this Event</h4>
                <p style={{ margin: 0, fontSize: 15, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{ev.description}</p>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, background: "var(--surface)", padding: 20, borderRadius: "var(--radius)", border: "1px solid var(--line)", marginBottom: 20, fontSize: 15, lineHeight: 1.8 }}>
              <div>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>DATE & TIME</p>
                <p style={{ margin: "2px 0 10px", fontWeight: 700 }}><Icon name="ti-calendar" /> {formatWhen(ev.startsAt, ev.endsAt)}</p>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>LOCATION</p>
                <p style={{ margin: "2px 0 0", fontWeight: 700 }}><Icon name="ti-map-pin" /> {ev.location}</p>
              </div>
              <div>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>REGISTRATION DEADLINE</p>
                <p style={{ margin: "2px 0 10px", fontWeight: 700 }}>
                  <Icon name="ti-clock" /> {formatWhen(ev.registrationDeadline)} ({deadlineOpen ? "Open" : "Closed"})
                </p>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>ATTENDEES</p>
                <p style={{ margin: "2px 0 0", fontWeight: 700 }}><Icon name="ti-users" /> {ev.registeredCount} registered</p>
              </div>
            </div>

            {eventEnded && ev.status === "open" && (
              <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 8 }}>This event has already taken place.</p>
            )}

            {myReg && (
              <div style={{ marginBottom: 20, border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 18, background: "var(--surface)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Your Registration Details</h4>
                  <Badge tone={statusTone(myReg!.status)}>{statusLabel(myReg!.status)}</Badge>
                </div>
                {ev.formFields.map(function(f) {
                  return (
                    <p key={f.id} style={{ margin: "4px 0", fontSize: 14 }}>
                      <span style={{ color: "var(--muted)", fontWeight: 600 }}>{f.label}: </span>
                      {String(myReg!.answers[f.id] ?? "") || "—"}
                    </p>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
              {canRegister && (
                <button className="btn btn-primary" type="button" onClick={function() { setRegisterEvent(ev); }} style={{ cursor: "pointer", height: 44, padding: "0 24px", fontSize: 15 }}>
                  <Icon name="ti-user-plus" /> Register Now
                </button>
              )}
              {canCancelReg && (
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={function() { handleCancelRegistration(myReg!); }}
                  style={{ cursor: "pointer", height: 44, padding: "0 20px", fontSize: 14 }}
                >
                  <Icon name="ti-x" /> Cancel Registration
                </button>
              )}
              {isOwner && ev.status === "open" && (
                <>
                  {ev.registeredCount === 0 && (
                    <button className="btn btn-ghost" type="button" onClick={function() { setEditEvent(ev); setDetailEvent(null); }} style={{ cursor: "pointer", height: 44, padding: "0 20px", fontSize: 14 }}>
                      <Icon name="ti-pencil" /> Edit Event
                    </button>
                  )}
                  <button className="btn btn-ghost" type="button" onClick={function() { setDetailEvent(null); openRoster(ev); }} style={{ cursor: "pointer", height: 44, padding: "0 20px", fontSize: 14 }}>
                    <Icon name="ti-users" /> View Roster
                  </button>
                  <button className="btn btn-ghost" type="button" onClick={function() { handleCancelEvent(ev); }} style={{ cursor: "pointer", height: 44, padding: "0 20px", fontSize: 14 }}>
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontFamily: "'Outfit', sans-serif", fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="ti-ticket" /> Events & Opportunities
          </h1>
          <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 14, lineHeight: 1.5 }}>
            Discover events, register in one step, and track your MyCSD points.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Badge tone="brand">
            <Icon name="ti-trophy" /> {pointsTotal} MyCSD Points
          </Badge>
          <Badge tone="neutral">
            <Icon name="ti-checkup-list" /> {attendedRegs.length} Activities
          </Badge>
        </div>
      </div>

      {notice && (
        <p style={{ margin: "0 0 16px", color: "var(--success, #16a34a)", fontSize: 15 }}>
          <Icon name="ti-check" /> {notice}
        </p>
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

        <div style={{ position: "relative" }}>
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Filter Events</h4>
                <button
                  type="button"
                  className="btn btn-xs btn-ghost"
                  onClick={function() { setCategoryFilter(EVENT_CATEGORIES); setOrganizerFilter(""); }}
                  style={{ fontSize: 13 }}
                >
                  Reset
                </button>
              </div>

              <h5 style={{ margin: "10px 0 6px", fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>Categories</h5>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                {EVENT_CATEGORIES.map(function(cat) {
                  var active = categoryFilter.indexOf(cat) !== -1;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={function() { toggleCategory(cat); }}
                      className={active ? "btn btn-sm btn-primary" : "btn btn-sm btn-ghost"}
                      style={{ cursor: "pointer", padding: "4px 10px", fontSize: 13 }}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              <h5 style={{ margin: "14px 0 6px", fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>Organizer</h5>
              <input
                value={organizerFilter}
                onChange={function(e) { setOrganizerFilter(e.target.value); }}
                placeholder="Filter by organizer..."
                style={{ ...inputStyle, width: "100%", height: 38, fontSize: 14 }}
              />
            </div>
          )}
        </div>

        <div style={{ position: "relative" }}>
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
            <div className="popover-panel" style={{ width: 230 }}>
              <h4 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700 }}>Sort Events</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
                      className={"btn btn-sm " + (sortBy === opt.value ? "btn-primary" : "btn-ghost")}
                      onClick={function() { setSortBy(opt.value); setShowSort(false); }}
                      style={{ justifyContent: "flex-start", width: "100%", fontSize: 13 }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ position: "relative" }}>
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
        <p style={{ color: "var(--muted)", fontSize: 15 }}>Loading events…</p>
      ) : (
        /* Simultaneous 3-Section Dashboard Layout */
        <div className={"events-dashboard-grid" + (regsCollapsed && myEventsCollapsed ? " sidebar-collapsed" : "")}>
          {/* Main Area: Browse Events */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <Card>
              <div style={{ marginBottom: 18 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontFamily: "'Outfit', sans-serif", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name="ti-compass" /> Browse Events <span className="badge" style={{ fontSize: 12, padding: "2px 8px" }}>{browseEvents.length}</span>
                </h3>
              </div>

              {browseEvents.length === 0 ? (
                <div>
                  <h4 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700 }}>No events match</h4>
                  <p style={{ color: "var(--muted)", fontSize: 14, margin: 0, lineHeight: 1.5 }}>
                    Try clearing filters, or post the first event yourself using the floating button at the bottom-right.
                  </p>
                </div>
              ) : (
                <div className="responsive-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
                  {browseEvents.map(renderEventCard)}
                </div>
              )}
            </Card>
          </div>

          {/* Right Sidebar: My Registrations & My Events */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Section 2: My Registrations */}
            <Card style={{ transition: "all 0.2s ease" }}>
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
                onClick={function() { setRegsCollapsed(!regsCollapsed); }}
              >
                <h3 style={{ margin: 0, fontSize: 16, fontFamily: "'Outfit', sans-serif", fontWeight: 700, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                  <Icon name="ti-calendar-event" /> My Registrations <span className="badge" style={{ fontSize: 12, padding: "2px 8px" }}>{myRegs.length}</span>
                </h3>
                <div style={{ fontSize: 16, color: "var(--muted)", display: "flex", alignItems: "center" }}>
                  <Icon name={regsCollapsed ? "ti-chevron-down" : "ti-chevron-up"} />
                </div>
              </div>

              {!regsCollapsed && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <h4 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--muted)", margin: 0, fontWeight: 700 }}>Upcoming</h4>
                    <select
                      value={regFilter}
                      onChange={function(e) { setRegFilter(e.target.value); }}
                      style={{ height: 28, padding: "0 8px", fontSize: 12, border: "1px solid var(--line)", borderRadius: "var(--radius)", background: "var(--surface)" }}
                    >
                      <option value="all">All statuses</option>
                      <option value="registered">Registered</option>
                      <option value="attended">Attended</option>
                      <option value="no_show">No-show</option>
                    </select>
                  </div>

                  {upcomingRegs.length === 0 ? (
                    <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 14px" }}>No upcoming registrations.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
                      {upcomingRegs.map(function(item) {
                        var ev = item.event;
                        var canCancel = item.reg.status === "registered" &&
                          new Date(ev.registrationDeadline).getTime() > now.getTime() &&
                          ev.status === "open";
                        return (
                          <div key={item.reg.id} style={{ padding: 14, border: "1px solid var(--line)", borderRadius: "var(--radius)", background: "var(--surface)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{ev.name}</h4>
                              <Badge tone={statusTone(item.reg.status)}>{statusLabel(item.reg.status)}</Badge>
                            </div>
                            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>by {ev.organizer}</p>
                            <p style={{ margin: "6px 0 0", fontSize: 13 }}><Icon name="ti-calendar" /> {formatWhen(ev.startsAt)}</p>
                            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                              <button className="btn btn-xs btn-ghost" type="button" onClick={function() { setDetailEvent(ev); }} style={{ cursor: "pointer", fontSize: 12, padding: "2px 8px", border: "1px solid var(--line)", boxShadow: "none" }}>
                                Details
                              </button>
                              {canCancel && (
                                <button
                                  className="btn btn-xs btn-ghost"
                                  type="button"
                                  onClick={function() { handleCancelRegistration(item.reg); }}
                                  style={{ cursor: "pointer", fontSize: 12, padding: "2px 8px", border: "1px solid var(--line)", boxShadow: "none" }}
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

                  <h4 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--muted)", margin: "14px 0 8px", fontWeight: 700 }}>Past</h4>
                  {pastRegs.length === 0 ? (
                    <p style={{ color: "var(--muted)", fontSize: 14 }}>No past registrations.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {pastRegs.map(function(item) {
                        var ev = item.event;
                        return (
                          <div key={item.reg.id} style={{ padding: 14, border: "1px solid var(--line)", borderRadius: "var(--radius)", background: "var(--surface)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{ev.name}</h4>
                              <Badge tone={statusTone(item.reg.status)}>{statusLabel(item.reg.status)}</Badge>
                            </div>
                            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>{formatWhen(ev.startsAt)}</p>
                            <div style={{ marginTop: 10 }}>
                              <button className="btn btn-xs btn-ghost" type="button" onClick={function() { setDetailEvent(ev); }} style={{ cursor: "pointer", fontSize: 12, padding: "2px 8px", border: "1px solid var(--line)", boxShadow: "none" }}>
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
            <Card style={{ transition: "all 0.2s ease" }}>
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
                onClick={function() { setMyEventsCollapsed(!myEventsCollapsed); }}
              >
                <h3 style={{ margin: 0, fontSize: 16, fontFamily: "'Outfit', sans-serif", fontWeight: 700, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                  <Icon name="ti-user-check" /> My Events <span className="badge" style={{ fontSize: 12, padding: "2px 8px" }}>{myEvents.length}</span>
                </h3>
                <div style={{ fontSize: 16, color: "var(--muted)", display: "flex", alignItems: "center" }}>
                  <Icon name={myEventsCollapsed ? "ti-chevron-down" : "ti-chevron-up"} />
                </div>
              </div>

              {!myEventsCollapsed && (
                <div style={{ marginTop: 14 }}>
                  <h4 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--muted)", margin: "10px 0 8px", fontWeight: 700 }}>Upcoming Organized</h4>
                  {upcomingMyEvents.length === 0 ? (
                    <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 14px" }}>You are not organizing any upcoming events.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
                      {upcomingMyEvents.map(function(ev) {
                        return (
                          <div key={ev.id} style={{ padding: 14, border: "1px solid var(--line)", borderRadius: "var(--radius)", background: "var(--surface)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{ev.name}</h4>
                              <Badge>{ev.registeredCount} registered</Badge>
                            </div>
                            <p style={{ margin: "6px 0 0", fontSize: 13 }}><Icon name="ti-calendar" /> {formatWhen(ev.startsAt)}</p>
                            <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {ev.registeredCount === 0 && (
                                <button className="btn btn-xs btn-ghost" type="button" onClick={function() { setEditEvent(ev); }} style={{ cursor: "pointer", fontSize: 12, padding: "2px 8px", border: "1px solid var(--line)", boxShadow: "none" }}>
                                  <Icon name="ti-pencil" /> Edit
                                </button>
                              )}
                              <button className="btn btn-xs btn-ghost" type="button" onClick={function() { openRoster(ev); }} style={{ cursor: "pointer", fontSize: 12, padding: "2px 8px", border: "1px solid var(--line)", boxShadow: "none" }}>
                                <Icon name="ti-users" /> Roster
                              </button>
                              <button className="btn btn-xs btn-ghost" type="button" onClick={function() { exportFromRow(ev); }} style={{ cursor: "pointer", fontSize: 12, padding: "2px 8px", border: "1px solid var(--line)", boxShadow: "none" }}>
                                <Icon name="ti-download" /> CSV
                              </button>
                              <button className="btn btn-xs btn-ghost" type="button" onClick={function() { handleCancelEvent(ev); }} style={{ cursor: "pointer", fontSize: 12, padding: "2px 8px", border: "1px solid var(--line)", boxShadow: "none" }}>
                                <Icon name="ti-ban" /> Cancel
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <h4 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--muted)", margin: "14px 0 8px", fontWeight: 700 }}>Past / Cancelled</h4>
                  {pastMyEvents.length === 0 ? (
                    <p style={{ color: "var(--muted)", fontSize: 14 }}>Nothing here yet.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {pastMyEvents.map(function(ev) {
                        return (
                          <div key={ev.id} style={{ padding: 14, border: "1px solid var(--line)", borderRadius: "var(--radius)", background: "var(--surface)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{ev.name}</h4>
                              {ev.status === "cancelled" && <Badge tone="warning">Cancelled</Badge>}
                            </div>
                            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>{formatWhen(ev.startsAt)} · {ev.registeredCount} registered</p>
                            <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                              <button className="btn btn-xs btn-ghost" type="button" onClick={function() { openRoster(ev); }} style={{ cursor: "pointer", fontSize: 12, padding: "2px 8px", border: "1px solid var(--line)", boxShadow: "none" }}>
                                <Icon name="ti-users" /> Roster
                              </button>
                              <button className="btn btn-xs btn-ghost" type="button" onClick={function() { exportFromRow(ev); }} style={{ cursor: "pointer", fontSize: 12, padding: "2px 8px", border: "1px solid var(--line)", boxShadow: "none" }}>
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

const inputStyle: React.CSSProperties = {
  height: 40,
  minWidth: 180,
  border: "1px solid var(--line)",
  borderRadius: "var(--radius)",
  padding: "0 12px",
  fontSize: 14,
  background: "var(--surface)",
};

const selectStyle: React.CSSProperties = {
  height: 40,
  minWidth: 160,
  border: "1px solid var(--line)",
  borderRadius: "var(--radius)",
  padding: "0 12px",
  fontSize: 14,
  background: "var(--surface)",
};
