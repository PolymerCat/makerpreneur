"use client";

import type { TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string | null;
};

export function Textarea({ label, error, id, className = "", ...rest }: TextareaProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
  return (
    <div className="form-group">
      {label && <label htmlFor={inputId}>{label}</label>}
      <textarea
        id={inputId}
        className={className}
        style={{ minHeight: 120, paddingTop: 10 }}
        {...rest}
      />
      {error && <small style={{ color: "var(--danger)" }}>{error}</small>}
    </div>
  );
}
