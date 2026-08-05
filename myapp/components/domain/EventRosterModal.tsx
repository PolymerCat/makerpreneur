"use client";

import type { EventRegistration, EventRegistrationStatus, MyCSDEvent } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { downloadCsv } from "@/lib/csv";

type EventRosterModalProps = {
  event: MyCSDEvent;
  registrations: EventRegistration[];
  onSetAttendance: (regId: string, status: EventRegistrationStatus) => void;
  onClose: () => void;
};

export function participantsCsv(event: MyCSDEvent, registrations: EventRegistration[]): void {
  var active = registrations.filter(function(r) { return r.status !== "cancelled"; });
  var headers = ["Submitted At", "Attendance", "Status"]
    .concat(event.formFields.map(function(f) { return f.label; }));
  var rows = active.map(function(r) {
    return [new Date(r.createdAt).toLocaleString(), r.status, r.status === "attended" ? "Attended" : r.status === "no_show" ? "No-show" : "Registered"]
      .concat(event.formFields.map(function(f) { return String(r.answers[f.id] ?? ""); }));
  });
  var safeName = event.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "event";
  var today = new Date().toISOString().slice(0, 10);
  downloadCsv(safeName + "-participants-" + today + ".csv", headers, rows);
}

function formatSubmitted(iso: string): string {
  return new Date(iso).toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EventRosterModal({ event, registrations, onSetAttendance, onClose }: EventRosterModalProps) {
  var active = registrations.filter(function(r) { return r.status !== "cancelled"; });
  var attendedCount = active.filter(function(r) { return r.status === "attended"; }).length;
  var noShowCount = active.filter(function(r) { return r.status === "no_show"; }).length;
  var registeredCount = active.filter(function(r) { return r.status === "registered"; }).length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <Card className="modal" style={{ padding: 22, maxWidth: 640, maxHeight: "80vh", overflowY: "auto" }} onClick={function(e) { e.stopPropagation(); }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="ti-users" /> Roster — {event.name}
          </h3>
          <button className="small-action" type="button" onClick={onClose} aria-label="Close" style={{ cursor: "pointer" }}>
            <Icon name="ti-x" />
          </button>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", margin: "8px 0 12px" }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            {active.length} registered · {attendedCount} attended · {noShowCount} no-show · {registeredCount} pending
          </span>
          <button
            className="btn btn-sm btn-ghost"
            type="button"
            onClick={function() {
              active.forEach(function(r) { onSetAttendance(r.id, "attended"); });
            }}
            style={{ cursor: "pointer" }}
          >
            <Icon name="ti-checkup-list" /> Mark all attended
          </button>
          <button
            className="btn btn-sm btn-ghost"
            type="button"
            onClick={function() { participantsCsv(event, registrations); }}
            style={{ cursor: "pointer" }}
          >
            <Icon name="ti-download" /> Export CSV
          </button>
        </div>

        {active.length === 0 && (
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>No registrations yet.</p>
        )}

        {active.map(function(r, idx) {
          return (
            <div
              key={r.id}
              style={{
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: 12,
                marginBottom: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 13 }}>#{idx + 1} · {formatSubmitted(r.createdAt)}</strong>
                  <div style={{ marginTop: 6, fontSize: 13 }}>
                    {event.formFields.map(function(f) {
                      return (
                        <div key={f.id} style={{ marginBottom: 2 }}>
                          <span style={{ color: "var(--muted)" }}>{f.label}: </span>
                          {String(r.answers[f.id] ?? "") || "—"}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <select
                  value={r.status}
                  onChange={function(e) { onSetAttendance(r.id, e.target.value as EventRegistrationStatus); }}
                  style={{
                    flexShrink: 0,
                    height: 34,
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius)",
                    padding: "0 8px",
                    fontSize: 13,
                    background: "var(--surface)",
                  }}
                >
                  <option value="registered">Registered</option>
                  <option value="attended">Attended</option>
                  <option value="no_show">No-show</option>
                </select>
              </div>
            </div>
          );
        })}

        {registrations.some(function(r) { return r.status === "cancelled"; }) && (
          <p style={{ marginTop: 12, color: "var(--muted)", fontSize: 12 }}>
            {registrations.filter(function(r) { return r.status === "cancelled"; }).length} cancelled registration(s) excluded from export.
          </p>
        )}
      </Card>
    </div>
  );
}
