"use client";

import type { ReactNode } from "react";

type Column = {
  key: string;
  label: string;
  render?: (row: any) => ReactNode;
};

type TableProps = {
  columns: Column[];
  rows: any[];
  emptyLabel?: string;
};

/** Plain <table> with hub card styling (no shadcn dep). */
export function Table({ columns, rows, emptyLabel = "No rows." }: TableProps) {
  return (
    <div className="card" style={{ overflowX: "auto", padding: 0 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ textAlign: "left", padding: "10px 14px", borderBottom: "2px solid var(--line)" }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>
                {emptyLabel}
              </td>
            </tr>
          )}
          {rows.map((row, idx) => (
            <tr key={idx}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{ padding: "10px 14px", borderBottom: "1px solid var(--surface-strong)" }}
                >
                  {col.render ? col.render(row) : String(row[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
