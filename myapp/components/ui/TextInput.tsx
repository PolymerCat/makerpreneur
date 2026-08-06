"use client";

import type { InputHTMLAttributes } from "react";

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string | null;
};

export function TextInput({ label, error, id, className = "", ...rest }: TextInputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
  return (
    <div className="form-group">
      {label && <label htmlFor={inputId}>{label}</label>}
      <input id={inputId} className={className} {...rest} />
      {error && <small style={{ color: "var(--danger)" }}>{error}</small>}
    </div>
  );
}
