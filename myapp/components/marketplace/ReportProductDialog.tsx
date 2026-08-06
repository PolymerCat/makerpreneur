"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import {
  REPORT_REASON_MAX,
  REPORT_REASON_MIN,
  validateReportReason,
} from "@/app/marketplace/_lib/admin-reports";
import { useToast } from "./use-toast";

export function ReportProductDialog({
  onReport,
}: {
  onReport: (reason: string) => void | Promise<void>;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleReport = async () => {
    const validationError = validateReportReason(reason);
    if (validationError) {
      toast({
        variant: "destructive",
        title: "Add more detail",
        description: validationError,
      });
      return;
    }

    setSubmitting(true);
    try {
      await onReport(reason.trim());
      toast({
        title: "Report submitted",
        description: "Thanks — we'll review this listing shortly.",
      });
      setReason("");
      setOpen(false);
    } catch {
      // Parent shows error toast
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>
        Report listing
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Report this listing"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={submitting}
              onClick={handleReport}
            >
              {submitting ? "Submitting…" : "Submit report"}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: "var(--muted)" }}>
          Tell us what is wrong with this listing ({REPORT_REASON_MIN}–{REPORT_REASON_MAX}
          characters).
        </p>
        <Textarea
          value={reason}
          maxLength={REPORT_REASON_MAX}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Describe the issue…"
        />
      </Dialog>
    </>
  );
}
