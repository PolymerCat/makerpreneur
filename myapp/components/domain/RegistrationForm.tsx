"use client";

import { useState } from "react";
import type { FormField, MyCSDEvent } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";

type RegistrationFormProps = {
  event: MyCSDEvent;
  prefill?: Record<string, string>;
  onSubmit: (answers: Record<string, string>) => void;
  onClose: () => void;
};

export function RegistrationForm({ event, prefill, onSubmit, onClose }: RegistrationFormProps) {
  var [answers, setAnswers] = useState<Record<string, string>>({});
  var [error, setError] = useState("");

  function setAnswer(field: FormField, value: string) {
    setAnswers({ ...answers, [field.id]: value });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    var missing = event.formFields.filter(function(f) {
      return f.required && !String(answers[f.id] || "").trim();
    });
    if (missing.length > 0) {
      setError("Please fill in: " + missing.map(function(f) { return f.label; }).join(", ") + ".");
      return;
    }
    var cleaned: Record<string, string> = {};
    for (var i = 0; i < event.formFields.length; i++) {
      var f = event.formFields[i];
      cleaned[f.id] = String(answers[f.id] || "").trim();
    }
    onSubmit(cleaned);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <Card className="modal" style={{ padding: 22, maxWidth: 480 }} onClick={function(e) { e.stopPropagation(); }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="ti-user-check" /> Register
          </h3>
          <button className="small-action" type="button" onClick={onClose} aria-label="Close" style={{ cursor: "pointer" }}>
            <Icon name="ti-x" />
          </button>
        </div>
        <p style={{ margin: "0 0 12px", color: "var(--muted)", fontSize: 13 }}>{event.name}</p>

        <form className="form-stack" onSubmit={handleSubmit}>
          {event.formFields.map(function(f) {
            var initial = prefill ? prefill[f.id] : undefined;
            return (
              <label key={f.id}>
                {f.label}{f.required && " *"}
                <input
                  value={String(answers[f.id] ?? initial ?? "")}
                  onChange={(e) => setAnswer(f, e.target.value)}
                  placeholder={f.label}
                  autoFocus={f.id === event.formFields[0]?.id}
                />
              </label>
            );
          })}

          {error && <p style={{ color: "var(--warning)", fontSize: 13, margin: 0 }}>{error}</p>}

          <div className="form-actions">
            <button className="secondary-button" type="submit" style={{ border: 0, cursor: "pointer" }}>
              <Icon name="ti-device-floppy" /> Register
            </button>
            <button className="small-action" type="button" onClick={onClose} style={{ cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
