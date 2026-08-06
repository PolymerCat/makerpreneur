"use client";

import { useEffect, useRef } from "react";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

/**
 * Lightweight modal on the native <dialog> element (no radix dependency).
 * Styled with the hub's existing .modal-backdrop / .modal classes.
 */
export function Dialog({ open, onClose, title, children, footer }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal-backdrop"
      style={{
        border: "none",
        background: "transparent",
        padding: 20,
        margin: 0,
        width: "100%",
        height: "100%",
        maxWidth: "100vw",
        maxHeight: "100vh",
        // .modal-backdrop sets display:grid which overrides the native
        // dialog's display:none when closed — force it here.
        display: open ? "grid" : "none",
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="card modal">
        {title && <h3 style={{ marginTop: 0 }}>{title}</h3>}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
        {footer && <div className="form-actions">{footer}</div>}
      </div>
    </dialog>
  );
}
