"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { useSession } from "@/lib/auth-context";

export default function SignInPage() {
  const router = useRouter();
  const { supabase } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const params = new URLSearchParams(window.location.search);
      const next = params.get("next");
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <Card className="auth-card">
        <div className="brand-block" style={{ marginBottom: "24px" }}>
          <img src="/logo-crest.webp" alt="USM Crest Logo" className="brand-mark" style={{ objectFit: "contain", padding: "2px", background: "#fff" }} />
          <div>
            <strong>StudentHub USM</strong>
            <span>Campus workspace</span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0", borderBottom: "2px solid var(--line)", marginBottom: "20px" }}>
          <img src="/logo-apex.webp" alt="USM APEX Branding" style={{ height: "48px", objectFit: "contain" }} />
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@student.usm.my"
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </label>

          {error && (
            <p style={{ color: "var(--warning)", fontSize: 13, margin: 0 }}>{error}</p>
          )}

          <button className="secondary-button" type="submit" disabled={busy} style={{ opacity: busy ? 0.6 : 1, border: 0, cursor: busy ? "not-allowed" : "pointer" }}>
            <Icon name="ti-login" />
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          Don&apos;t have an account? <Link href="/register">Create one</Link>
        </p>
      </Card>
    </main>
  );
}
