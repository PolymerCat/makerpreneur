"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useSession } from "@/lib/auth-context";
import { SosDialog } from "./SosDialog";

export function SosButton() {
  var { user } = useSession();
  var [open, setOpen] = useState(false);
  var [openSeq, setOpenSeq] = useState(0);

  if (!user) {
    return null;
  }

  function openDialog() {
    setOpen(true);
    setOpenSeq(function (n) { return n + 1; });
  }

  return (
    <>
      <button
        className="sos-nav-button"
        type="button"
        onClick={openDialog}
        aria-label="Send SOS alert"
        title="Send an SOS alert with your location"
      >
        <span className="sos-nav-icon" aria-hidden="true">
          <Icon name="ti-urgent" />
        </span>
        <span className="sos-nav-text">
          <strong>SOS alert</strong>
          <small>Send your location to security</small>
        </span>
        <span className="sos-dot" aria-hidden="true" />
      </button>
      <SosDialog key={openSeq} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
