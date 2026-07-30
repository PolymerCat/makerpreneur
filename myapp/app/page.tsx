"use client";

import React from "react";
import { createBrowserClient } from "@/lib/supabase";
import { getSession, signOut as supabaseSignOut } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";

type TableData = {
  name: string;
  rows: Record<string, unknown>[];
  error?: string;
};

var TABLE_CANDIDATES = [
  "tasks", "events", "profiles", "feed_items", "people",
  "resources", "campus_services", "metrics", "nav_items",
  "posts", "users", "categories"
];

async function scanTables(supabase: ReturnType<typeof createBrowserClient>) {
  var results: TableData[] = [];
  for (var i = 0; i < TABLE_CANDIDATES.length; i++) {
    var name = TABLE_CANDIDATES[i];
    var result = await supabase.from(name).select("*").limit(3);
    if (result.error) {
      if (!result.error.message.includes("does not exist")) {
        results.push({ name: name, rows: [], error: result.error.message });
      }
    } else {
      results.push({ name: name, rows: (result.data ?? []) as Record<string, unknown>[] });
    }
  }
  return results;
}

export default function CommandPage() {
  var supabase = createBrowserClient();
  var [user, setUser] = React.useState<{ email: string; id: string } | null>(null);
  var [tables, setTables] = React.useState<TableData[]>([]);
  var [loading, setLoading] = React.useState(true);
  var [queryTable, setQueryTable] = React.useState("");
  var [queryResult, setQueryResult] = React.useState<Record<string, unknown>[] | null>(null);
  var [queryError, setQueryError] = React.useState("");
  var [insertForm, setInsertForm] = React.useState({ table: "", data: "{}" });
  var [insertResult, setInsertResult] = React.useState("");
  var [sqlRaw, setSqlRaw] = React.useState("");

  React.useEffect(function() {
    var cancelled = false;
    getSession().then(function(session) {
      if (!cancelled) {
        setUser(session);
      }
    });
    scanTables(supabase).then(function(results) {
      if (!cancelled) {
        setTables(results);
        setLoading(false);
      }
    });
    return function() { cancelled = true; };
  }, [supabase]);

  async function runQuery() {
    setQueryError("");
    setQueryResult(null);
    if (!queryTable) {
      return;
    }
    var result = await supabase.from(queryTable).select("*").limit(20);
    if (result.error) {
      setQueryError(result.error.message);
    } else {
      setQueryResult(result.data as Record<string, unknown>[]);
    }
  }

  async function runInsert() {
    setInsertResult("");
    var parsed: Record<string, unknown>;
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
    var result = await supabase.from(insertForm.table).insert(parsed).select();
    if (result.error) {
      setInsertResult("Error: " + result.error.message);
    } else {
      setInsertResult("Inserted: " + JSON.stringify(result.data, null, 2));
    }
  }

  async function runDelete(table: string, id: string | number | undefined) {
    var result = await supabase.from(table).delete().eq("id", id);
    if (result.error) {
      alert("Delete error: " + result.error.message);
    } else {
      alert("Deleted from " + table + " where id = " + id);
      runQuery();
    }
  }

  async function runSqlRaw() {
    setQueryError("");
    setQueryResult(null);
    if (!sqlRaw.trim()) {
      return;
    }
    var result = await supabase.rpc("exec_sql", { query: sqlRaw });
    if (result.error) {
      setQueryError(result.error.message);
    } else {
      setQueryResult(result.data as Record<string, unknown>[]);
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
          <h3 style={{ margin: 0, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="ti-shield-lock" /> Auth status
          </h3>
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
            {user ? (
              <button
                className="button-link button-link-ghost"
                type="button"
                onClick={async function() {
                  await supabaseSignOut();
                  setUser(null);
                }}
                style={{ fontSize: 13, border: 0, cursor: "pointer" }}
              >
                <Icon name="ti-logout" /> Sign out
              </button>
            ) : null}
          </div>
        </Card>

        <Card>
          <h3 style={{ margin: 0, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="ti-database-search" /> Quick table scan
          </h3>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "4px 0 0" }}>
            Auto-detected existing tables (scanned {TABLE_CANDIDATES.length} candidates):
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {loading ? (
              <span style={{ color: "var(--muted)", fontSize: 13 }}>Scanning...</span>
            ) : (
              tables.filter(function(t) { return t.rows.length > 0 || t.error; }).map(function(t) {
                return (
                  <button
                    key={t.name}
                    type="button"
                    className="small-action"
                    onClick={function() { setQueryTable(t.name); runQuery(); }}
                    style={{ cursor: "pointer", border: 0, fontSize: 12 }}
                  >
                    {t.name}
                    {t.error ? <Icon name="ti-alert-triangle" /> : <Badge tone="success">{t.rows.length}</Badge>}
                  </button>
                );
              })
            )}
          </div>
          <button
            type="button"
            className="button-link button-link-ghost"
            onClick={async function() {
              setLoading(true);
              var results = await scanTables(supabase);
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
        <h3 style={{ margin: 0, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="ti-search" /> Query any table
        </h3>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            value={queryTable}
            onChange={function(e) { setQueryTable(e.target.value); }}
            placeholder="Table name (e.g. tasks)"
            style={{ flex: 1 }}
          />
          <button className="secondary-button" type="button" onClick={runQuery} style={{ border: 0, cursor: "pointer", whiteSpace: "nowrap" }}>
            <Icon name="ti-play" /> Run
          </button>
        </div>
        {queryError ? <p style={{ color: "var(--warning)", fontSize: 13, marginTop: 8 }}>{queryError}</p> : null}
        {queryResult !== null ? (
          <div style={{ marginTop: 12, overflowX: "auto" }}>
            {queryResult.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 13 }}>No rows returned.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {Object.keys((queryResult as Record<string, unknown>[])[0]).map(function(col) {
                      return (
                        <th key={col} style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--line)", fontWeight: 800, color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>{col}</th>
                      );
                    })}
                    <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--line)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queryResult.map(function(row, i) {
                    var idVal = row.id as string | number | undefined;
                    return (
                      <tr key={i}>
                        {Object.keys((queryResult as Record<string, unknown>[])[0]).map(function(col) {
                          return (
                            <td key={col} style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {String(row[col] ?? "")}
                            </td>
                          );
                        })}
                        <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)" }}>
                          {idVal !== undefined ? (
                            <button
                              type="button"
                              className="small-action"
                              onClick={function() { runDelete(queryTable, idVal); }}
                              style={{ cursor: "pointer", border: 0, fontSize: 11 }}
                            >
                              <Icon name="ti-trash" /> Delete
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ) : null}
      </Card>

      <Card>
        <h3 style={{ margin: 0, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="ti-plus" /> Insert row
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          <input
            value={insertForm.table}
            onChange={function(e) { setInsertForm(function(f) { return { table: e.target.value, data: f.data }; }); }}
            placeholder="Table name"
          />
          <textarea
            value={insertForm.data}
            onChange={function(e) { setInsertForm(function(f) { return { table: f.table, data: e.target.value }; }); }}
            placeholder='{ "title": "Test", "status": "active" }'
            rows={4}
            style={{ width: "100%", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 12, font: "inherit", fontSize: 13, resize: "vertical" }}
          />
          <button className="secondary-button" type="button" onClick={runInsert} style={{ border: 0, cursor: "pointer", alignSelf: "flex-start" }}>
            <Icon name="ti-send" /> Insert
          </button>
          {insertResult ? (
            <pre style={{ fontSize: 12, background: "var(--surface-strong)", padding: 12, borderRadius: "var(--radius)", overflow: "auto", maxHeight: 200, margin: 0 }}>
              {insertResult}
            </pre>
          ) : null}
        </div>
      </Card>

      <Card>
        <h3 style={{ margin: 0, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="ti-code" /> Raw SQL (via RPC)
        </h3>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "4px 0 0" }}>
          Requires an <code style={{ fontSize: 12 }}>exec_sql</code> RPC function in Supabase.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          <textarea
            value={sqlRaw}
            onChange={function(e) { setSqlRaw(e.target.value); }}
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
