"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { useSession } from "@/lib/auth-context";
import { db } from "@/app/study/_lib/db";
import { EMERGENCY_CONTACTS, SOS_HOLD_SECONDS, SOS_RECIPIENTS } from "@/lib/sos-data";

type SosDialogProps = {
  open: boolean;
  onClose: () => void;
};

type Coords = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

function getPosition(): Promise<Coords | null> {
  return new Promise(function (resolve) {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      function () {
        resolve(null);
      },
      { timeout: 8000, maximumAge: 30000 }
    );
  });
}

const TICK_MS = 50;

export function SosDialog({ open, onClose }: SosDialogProps) {
  var { user } = useSession();
  var [recipientId, setRecipientId] = useState(SOS_RECIPIENTS[0]?.id || "");
  var [note, setNote] = useState("");
  var [phase, setPhase] = useState<"confirm" | "sending" | "sent" | "error">("confirm");
  var [holdProgress, setHoldProgress] = useState(0);
  var [errorMsg, setErrorMsg] = useState("");
  var [sentAt, setSentAt] = useState("");
  var [locationLabel, setLocationLabel] = useState("");

  var holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  var holdTicks = useRef(0);
  var sentRef = useRef(false);

  var recipient = SOS_RECIPIENTS.find(function (r) { return r.id === recipientId; }) || SOS_RECIPIENTS[0];
  var recipientName = recipient?.name || "Campus Security";

  useEffect(function () {
    return function () {
      if (holdTimer.current) {
        clearInterval(holdTimer.current);
      }
    };
  }, []);

  function stopHold() {
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
  }

  function cancelHold() {
    stopHold();
    setHoldProgress(0);
  }

  function startHold() {
    if (phase !== "confirm" || !user) {
      return;
    }
    sentRef.current = false;
    holdTicks.current = 0;
    holdTimer.current = setInterval(function () {
      holdTicks.current += 1;
      var elapsed = (holdTicks.current * TICK_MS) / 1000;
      var pct = Math.min(100, (elapsed / SOS_HOLD_SECONDS) * 100);
      setHoldProgress(pct);
      if (pct >= 100 && !sentRef.current) {
        sentRef.current = true;
        stopHold();
        doSend();
      }
    }, TICK_MS);
  }

  async function doSend() {
    if (!user) {
      return;
    }
    setPhase("sending");
    var coords = await getPosition();
    setLocationLabel(
      coords
        ? "Location shared · accurate to ±" + Math.round(coords.accuracy) + " m"
        : "Sent without location (access denied)"
    );
    try {
      await db.sendSosAlert({
        userId: user.id,
        recipientUserId: recipientId || (SOS_RECIPIENTS[0] ? SOS_RECIPIENTS[0].id : ""),
        latitude: coords ? coords.latitude : null,
        longitude: coords ? coords.longitude : null,
        accuracy: coords ? coords.accuracy : null,
        note: note,
      });
      setSentAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setPhase("sent");
    } catch (err) {
      var msg = err instanceof Error
        ? err.message
        : "Failed to send the alert. Call 999 directly instead.";
      setErrorMsg(msg);
      setPhase("error");
    }
  }

  function renderBody() {
    if (phase === "sent") {
      return (
        <div className="sos-result sos-result-ok">
          <Icon name="ti-shield-check" />
          <strong>Alert sent to {recipientName}</strong>
          <span>Sent at {sentAt} · {locationLabel}</span>
          <p className="sos-explain" style={{ margin: "14px 0 0" }}>
            Stay where you are if it is safe to do so. Security has been notified and has your
            location. If you need help right now, call:
          </p>
          <div className="sos-call-row">
            <a className="button-link button-link-primary" href="tel:999" style={{ justifyContent: "center" }}>
              <Icon name="ti-phone-call" /> Call 999
            </a>
            <a className="button-link" href={"tel:" + (recipient?.phone || "999")} style={{ justifyContent: "center" }}>
              <Icon name="ti-phone" /> Call {recipientName}
            </a>
          </div>
        </div>
      );
    }

    if (phase === "error") {
      return (
        <div className="sos-result sos-result-err">
          <Icon name="ti-alert-triangle" />
          <strong>Could not send the alert</strong>
          <span>{errorMsg}</span>
          <div className="sos-call-row">
            <a className="button-link button-link-primary" href="tel:999" style={{ justifyContent: "center" }}>
              <Icon name="ti-phone-call" /> Call 999 now
            </a>
          </div>
        </div>
      );
    }

    return (
      <>
        <p className="sos-explain">
          This sends an SOS alert to <strong>{recipientName}</strong> with your current location
          and a timestamp. Only use it for a genuine emergency.
        </p>

        <ul className="sos-what">
          <li><Icon name="ti-map-pin" /> Your location is shared with security</li>
          <li><Icon name="ti-clock" /> Recorded with the exact date and time</li>
          <li><Icon name="ti-urgent" /> Sent straight to the campus response team</li>
        </ul>

        <div className="form-group">
          <label htmlFor="sos-recipient">Alert recipient</label>
          <select id="sos-recipient" value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
            {SOS_RECIPIENTS.map(function (r) {
              return <option key={r.id} value={r.id}>{r.name} · {r.phone}</option>;
            })}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="sos-note">Optional note</label>
          <textarea
            id="sos-note"
            style={{ minHeight: 70, paddingTop: 10 }}
            placeholder="e.g. 'At the library bus stop, feeling unwell'"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <button
          className="sos-hold"
          type="button"
          disabled={phase === "sending"}
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
        >
          <span className="sos-hold-fill" style={{ width: holdProgress + "%" }} aria-hidden="true" />
          <span className="sos-hold-label">
            <Icon name="ti-urgent" />
            {phase === "sending"
              ? "Sending alert…"
              : holdProgress > 0 && holdProgress < 100
                ? "Keep holding… " + Math.max(1, Math.ceil((SOS_HOLD_SECONDS * (100 - holdProgress)) / 100)) + "s"
                : "Hold " + SOS_HOLD_SECONDS + "s to send SOS"}
          </span>
        </button>
        <p className="sos-hint">
          Press and hold the red button for {SOS_HOLD_SECONDS} seconds to send. Release to cancel.
        </p>

        <div className="sos-quick">
          <span>Need to talk to someone now?</span>
          {EMERGENCY_CONTACTS.map(function (c) {
            return (
              <a key={c.name} href={"tel:" + c.phone}>
                <Icon name={c.icon} /> {c.name} · {c.phone}
              </a>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Send an SOS alert"
      footer={
        phase === "confirm" ? (
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
        ) : undefined
      }
    >
      {renderBody()}
    </Dialog>
  );
}
