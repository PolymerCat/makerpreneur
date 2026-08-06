"use client";

import type { SelectHTMLAttributes } from "react";

type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  label?: string;
  error?: string | null;
  options: SelectOption[];
  placeholder?: string;
};

export function Select({ label, error, id, options, placeholder, className = "", ...rest }: SelectProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
  return (
    <div className="form-group">
      {label && <label htmlFor={inputId}>{label}</label>}
      <select id={inputId} className={className} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <small style={{ color: "var(--danger)" }}>{error}</small>}
    </div>
  );
}
