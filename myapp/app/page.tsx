"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-context";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/ui/SectionHeader";

type TableData = {
  name: string;
  rows: Record<string, unknown>[];
  error?: string;
};

type InsertForm = {
  table: string;
  data: string;
};

const TABLE_CANDIDATES = [
  "tasks", "events", "profiles", "feed_items", "people",
  "resources", "campus_services", "metrics", "nav_items",
  "posts", "users", "categories",
];

async function scanTables(supabase: SupabaseClient) {
  const results: TableData[] = [];
  for (const name of TABLE_CANDIDATES) {
    const { data, error } = await supabase.from(name).select("*").limit(3);
    if (error) {
      if (!error.message.includes("does not exist")) {
        results.push({ name, rows: [], error: error.message });
      }
    } else {
      results.push({ name, rows: (data ?? []) as Record<string, unknown>[] });
    }
  }
  return results;
}

export default function CommandPage() {
  const { supabase, user } = useSession();
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryTable, setQueryTable] = useState("");
  const [queryResult, setQueryResult] = useState<Record<string, unknown>[] | null>(null);
  const [queryError, setQueryError] = useState("");
  const [insertForm, setInsertForm] = useState<InsertForm>({ table: "", data: "{}" });
  const [insertResult, setInsertResult] = useState("");
  const [sqlRaw, setSqlRaw] = useState("");

  useEffect(() => {
    let cancelled = false;
    scanTables(supabase).then((results) => {
      if (!cancelled) {
        setTables(results);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [supabase]);

  async function runQuery() {
    setQueryError("");
    setQueryResult(null);
    if (!queryTable) return;
    const { data, error } = await supabase.from(queryTable).select("*").limit(20);
    if (error) {
      setQueryError(error.message);
    } else {
      setQueryResult(data as Record<string, unknown>[]);
    }
  }

  async function runInsert() {
    setInsertResult("");
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(insertForm.data);
    } catch {
      setInsertResult("Invalid JSON");
      return;
    }
    if (!insertForm.table) {
      setInsertResult("Table name is required");
      return;
    }
    const { data, error } = await supabase.from(insertForm.table).insert(parsed).select();
    if (error) {
      setInsertResult(`Error: ${error.message}`);
    } else {
      setInsertResult(`Inserted: ${JSON.stringify(data, null, 2)}`);
    }
  }

  async function runDelete(table: string, id: string | number) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) {
      alert(`Delete error: ${error.message}`);
    } else {
      alert(`Deleted from ${table} where id = ${id}`);
      runQuery();
    }
  }

  async function runSqlRaw() {
    setQueryError("");
    setQueryResult(null);
    if (!sqlRaw.trim()) return;
    const { data, error } = await supabase.rpc("exec_sql", { query: sqlRaw });
    if (error) {
      setQueryError(error.message);
    } else {
      setQueryResult(data as Record<string, unknown>[]);
    }
  }

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="brand-block" style={{ marginBottom: 8 }}>
        <span className="brand-mark">SH</span>
        <div>
          <strong>StudentHub USM</strong>
          <span>Supabase command center</span>
        </div>
      </div>

      <div className="page-hero" style={{ display: "flex", alignItems: "center", gap: 12, padding: 20, borderRadius: "var(--radius)", background: "linear-gradient(135deg, var(--brand), var(--brand-deep))", color: "#fff" }}>
        <span style={{ fontSize: 28 }}><Icon name="ti-terminal-2" /></span>
        <div>
          <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: "#d9d5ff" }}>Command</span>
          <h1 style={{ margin: "4px 0 0", fontSize: 24 }}>Supabase test console</h1>
        </div>
      </div>

      <section className="two-column">
        <Card>
          <SectionHeader title="Auth status" icon="ti-shield-lock" />
          {user ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              <p style={{ margin: 0 }}><strong>Email:</strong> {user.email}</p>
              <p style={{ margin: 0 }}><strong>ID:</strong> <code style={{ fontSize: 12 }}>{user.id}</code></p>
              <Badge tone="success">Authenticated</Badge>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              <p style={{ margin: 0, color: "var(--muted)" }}>Not signed in</p>
              <Badge tone="neutral">Anonymous</Badge>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <a className="button-link button-link-ghost" href="/auth" style={{ fontSize: 13 }}>
              <Icon name="ti-login" /> Sign in / Sign up
            </a>
            {user && (
              <button
                className="button-link button-link-ghost"
                type="button"
                onClick={() => supabase.auth.signOut()}
                style={{ fontSize: 13, border: 0, cursor: "pointer" }}
              >
                <Icon name="ti-logout" /> Sign out
              </button>
            )}
          </div>
        </Card>

        <Card>
          <SectionHeader title="Quick table scan" icon="ti-database-search" />
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "4px 0 0" }}>
            Auto-detected existing tables (scanned {TABLE_CANDIDATES.length} candidates):
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {loading ? (
              <span style={{ color: "var(--muted)", fontSize: 13 }}>Scanning...</span>
            ) : (
              tables.filter(t => t.rows.length > 0 || t.error).map(t => (
                <button
                  key={t.name}
                  type="button"
                  className="small-action"
                  onClick={() => { setQueryTable(t.name); runQuery(); }}
                  style={{ cursor: "pointer", border: 0, fontSize: 12 }}
                >
                  {t.name}
                  {t.error ? <Icon name="ti-alert-triangle" /> : <Badge tone="success">{t.rows.length}</Badge>}
                </button>
              ))
            )}
          </div>
          <button
            type="button"
            className="button-link button-link-ghost"
            onClick={async () => {
              setLoading(true);
              const results = await scanTables(supabase);
              setTables(results);
              setLoading(false);
            }}
            style={{ fontSize: 12, border: 0, cursor: "pointer", marginTop: 8 }}
          >
            <Icon name="ti-refresh" /> Rescan
          </button>
        </Card>
      </section>

      <Card>
        <SectionHeader title="Query any table" icon="ti-search" />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            value={queryTable}
            onChange={e => setQueryTable(e.target.value)}
            placeholder="Table name (e.g. tasks)"
            style={{ flex: 1 }}
          />
          <button className="secondary-button" type="button" onClick={runQuery} style={{ border: 0, cursor: "pointer", whiteSpace: "nowrap" }}>
            <Icon name="ti-play" /> Run
          </button>
        </div>
        {queryError && <p style={{ color: "var(--warning)", fontSize: 13, marginTop: 8 }}>{queryError}</p>}
        {queryResult !== null && (
          <div style={{ marginTop: 12, overflowX: "auto" }}>
            {queryResult.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 13 }}>No rows returned.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {Object.keys(queryResult[0]).map(col => (
                      <th key={col} style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--line)", fontWeight: 800, color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>{col}</th>
                    ))}
                    <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--line)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queryResult.map((row, i) => {
                    const idVal = row.id as string | number | undefined;
                    return (
                      <tr key={i}>
                        {Object.keys(queryResult[0]).map(col => (
                          <td key={col} style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {String(row[col] ?? "")}
                          </td>
                        ))}
                        <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)" }}>
                          {idVal !== undefined && (
                            <button
                              type="button"
                              className="small-action"
                              onClick={() => runDelete(queryTable, idVal)}
                              style={{ cursor: "pointer", border: 0, fontSize: 11 }}
                            >
                              <Icon name="ti-trash" /> Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Card>

      <Card>
        <SectionHeader title="Insert row" icon="ti-plus" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          <input
            value={insertForm.table}
            onChange={e => setInsertForm(f => ({ ...f, table: e.target.value }))}
            placeholder="Table name"
          />
          <textarea
            value={insertForm.data}
            onChange={e => setInsertForm(f => ({ ...f, data: e.target.value }))}
            placeholder='{ "title": "Test", "status": "active" }'
            rows={4}
            style={{ width: "100%", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 12, font: "inherit", fontSize: 13, resize: "vertical" }}
          />
          <button className="secondary-button" type="button" onClick={runInsert} style={{ border: 0, cursor: "pointer", alignSelf: "flex-start" }}>
            <Icon name="ti-send" /> Insert
          </button>
          {insertResult && (
            <pre style={{ fontSize: 12, background: "var(--surface-strong)", padding: 12, borderRadius: "var(--radius)", overflow: "auto", maxHeight: 200, margin: 0 }}>
              {insertResult}
            </pre>
          )}
        </div>
      </Card>

      <Card>
        <SectionHeader title="Raw SQL (via RPC)" icon="ti-code" />
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "4px 0 0" }}>
          Requires an <code style={{ fontSize: 12 }}>exec_sql</code> RPC function in Supabase.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          <textarea
            value={sqlRaw}
            onChange={e => setSqlRaw(e.target.value)}
            placeholder="SELECT * FROM tasks LIMIT 5"
            rows={3}
            style={{ width: "100%", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 12, font: "inherit", fontSize: 13, resize: "vertical" }}
          />
          <button className="secondary-button" type="button" onClick={runSqlRaw} style={{ border: 0, cursor: "pointer", alignSelf: "flex-start" }}>
            <Icon name="ti-play" /> Execute
          </button>
        </div>
      </Card>
    </main>
  );
}
