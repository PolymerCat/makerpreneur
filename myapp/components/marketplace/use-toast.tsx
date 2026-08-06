"use client";

import { useState, useCallback } from "react";

export type ToastInput = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
};

/**
 * Minimal toast replacement (no shadcn/radix). Renders one stacked notice at
 * the bottom-right; auto-dismisses after 4s.
 */
export function useToast() {
  const [toasts, setToasts] = useState<(ToastInput & { id: number })[]>([]);

  const toast = useCallback((input: ToastInput) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...input, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const render = (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 340,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="card"
          style={{
            padding: "10px 14px",
            border: `2px solid ${t.variant === "destructive" ? "var(--danger)" : t.variant === "success" ? "var(--success)" : "var(--line)"}`,
            background: t.variant === "destructive" ? "var(--danger-soft)" : t.variant === "success" ? "var(--success-soft)" : "var(--surface)",
          }}
        >
          {t.title && <strong style={{ fontSize: 14 }}>{t.title}</strong>}
          {t.description && (
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--muted)" }}>{t.description}</p>
          )}
        </div>
      ))}
    </div>
  );

  return { toast, render };
}
