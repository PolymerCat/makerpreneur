"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-context";
import { db } from "@/app/study/_lib/db";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EMERGENCY_CONTACTS, SOS_HOLD_SECONDS, SOS_PROCEDURES, SOS_RECIPIENTS } from "@/lib/sos-data";

type SosAlert = {
  id: string;
  userId: string;
  recipientUserId: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  note: string | null;
  status: string;
  createdAt: string;
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString([], {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function mapsLink(alert: SosAlert) {
  if (alert.latitude === null || alert.longitude === null) {
    return null;
  }
  return "https://www.google.com/maps?q=" + alert.latitude + "," + alert.longitude;
}

export function SosPage() {
  var { user } = useSession();
  var userId = user?.id || "";
  var isRecipient = SOS_RECIPIENTS.some(function (r) { return r.id === userId; });

  var [incoming, setIncoming] = useState<SosAlert[]>([]);
  var [sent, setSent] = useState<SosAlert[]>([]);
  var [loaded, setLoaded] = useState(false);

  var loading = !userId || !loaded;

  useEffect(function () {
    if (!userId) {
      return;
    }
    var requests: Promise<unknown>[] = [];
    if (isRecipient) {
      requests.push(db.listSosAlerts({ recipientUserId: userId }).then(setIncoming));
    }
    requests.push(db.listSosAlerts({ userId: userId }).then(setSent));
    Promise.all(requests)
      .catch(function (err) {
        console.error("[SOS] load error:", err);
      })
      .then(function () {
        setLoaded(true);
      });
  }, [userId, isRecipient]);

  function acknowledge(id: string) {
    db.acknowledgeSosAlert(id)
      .then(function () {
        setIncoming(function (list) {
          return list.map(function (a) {
            return a.id === id ? { ...a, status: "acknowledged" } : a;
          });
        });
      })
      .catch(function (err) {
        console.error("[SOS] acknowledge error:", err);
      });
  }

  function renderAlertRow(alert: SosAlert) {
    var loc = mapsLink(alert);
    return (
      <div className="card row-card sos-alert" key={alert.id}>
        <div style={{ width: "100%", minWidth: 0 }}>
          <div className="sos-alert-meta">
            <span className={`badge ${alert.status === "acknowledged" ? "badge-success" : "badge-danger"}`}>
              {alert.status === "acknowledged" ? "Acknowledged" : "Active"}
            </span>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>{formatTime(alert.createdAt)}</span>
          </div>
          <span style={{ display: "block", marginTop: 6, color: "var(--muted)", fontSize: 13 }}>
            {alert.latitude !== null && alert.longitude !== null
              ? "Location: " + alert.latitude.toFixed(5) + ", " + alert.longitude.toFixed(5) +
                (alert.accuracy ? " (±" + Math.round(alert.accuracy) + " m)" : "")
              : "No location shared"}
            {alert.note ? " · " + alert.note : ""}
          </span>
          <div className="sos-alert-actions">
            {loc && (
              <a href={loc} target="_blank" rel="noopener noreferrer" className="small-action">
                <Icon name="ti-map-2" /> View on map
              </a>
            )}
            {isRecipient && alert.status !== "acknowledged" && (
              <button className="small-action" type="button" onClick={() => acknowledge(alert.id)}>
                <Icon name="ti-check" /> Acknowledge
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      {/* How it works */}
      <Card>
        <SectionHeader title="How SOS works" icon="ti-info-circle" />
        <div className="sos-steps">
          <div className="sos-step">
            <span className="sos-step-num">1</span>
            <p>
              <strong>Tap the red SOS button</strong> in the top bar — it is on every page so you
              can reach it from anywhere on campus.
            </p>
          </div>
          <div className="sos-step">
            <span className="sos-step-num">2</span>
            <p>
              <strong>Hold it for {SOS_HOLD_SECONDS} seconds</strong> to confirm. This stops
              accidental taps. Your current location is shared with security, together with the time.
            </p>
          </div>
          <div className="sos-step">
            <span className="sos-step-num">3</span>
            <p>
              <strong>Security receives your alert</strong> and your location. Stay where you are
              if safe, and call 999 if you need the emergency services right now.
            </p>
          </div>
        </div>
      </Card>

      {/* Emergency directory */}
      <div>
        <SectionHeader title="Emergency directory" icon="ti-phone" />
        <div className="stack">
          {EMERGENCY_CONTACTS.map(function (c) {
            return (
              <a key={c.name} className="card row-card sos-contact" href={"tel:" + c.phone}>
                <span className="sos-av" style={{ background: c.color }}>
                  <Icon name={c.icon} />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong>{c.name}</strong>
                  <span>{c.detail}</span>
                </div>
                <span className="sos-contact-phone">
                  <Icon name="ti-phone" /> {c.phone}
                </span>
              </a>
            );
          })}
        </div>
      </div>

      {/* Incoming alerts (security user only) */}
      {isRecipient && (
        <div>
          <SectionHeader title="Incoming alerts" icon="ti-shield-check" />
          {loading ? (
            <Card><p className="sos-empty">Loading alerts…</p></Card>
          ) : incoming.length === 0 ? (
            <Card><p className="sos-empty">No incoming alerts right now.</p></Card>
          ) : (
            <div className="stack">
              {incoming.map(renderAlertRow)}
            </div>
          )}
        </div>
      )}

      {/* My alert history */}
      <div>
        <SectionHeader title="My sent alerts" icon="ti-history" />
        {loading ? (
          <Card><p className="sos-empty">Loading alerts…</p></Card>
        ) : sent.length === 0 ? (
          <Card><p className="sos-empty">You have not sent any SOS alerts yet.</p></Card>
        ) : (
          <div className="stack">
            {sent.map(renderAlertRow)}
          </div>
        )}
      </div>

      {/* Procedures */}
      <div>
        <SectionHeader title="What to do in an emergency" icon="ti-list-details" />
        <div className="stack">
          {SOS_PROCEDURES.map(function (p) {
            return (
              <Card className="sos-procedure" key={p.title}>
                <div className="sos-procedure-head">
                  <span className="sos-av" style={{ background: "var(--danger)" }}>
                    <Icon name={p.icon} />
                  </span>
                  <strong>{p.title}</strong>
                </div>
                <ol className="sos-procedure-steps">
                  {p.steps.map(function (step, idx) {
                    return <li key={idx}>{step}</li>;
                  })}
                </ol>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
