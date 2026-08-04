"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { useSession } from "@/lib/auth-context";

export default function RegisterPage() {
  const router = useRouter();
  const { supabase } = useSession();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: fullName } },
      });
      if (error) throw error;

      if (data.session) {
        const params = new URLSearchParams(window.location.search);
        const next = params.get("next");
        router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
        router.refresh();
      } else {
        setInfo("Account created! Check your email to confirm your account before signing in.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
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
            <span>Create your account</span>
          </div>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            Full name
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Julita Aisyah"
              autoComplete="name"
              required
            />
          </label>
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
              placeholder="At least 6 characters"
              autoComplete="new-password"
              required
            />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              required
            />
          </label>

          {error && (
            <p style={{ color: "var(--warning)", fontSize: 13, margin: 0 }}>{error}</p>
          )}
          {info && (
            <p style={{ color: "var(--success)", fontSize: 13, margin: 0 }}>{info}</p>
          )}

          <button className="secondary-button" type="submit" disabled={busy} style={{ opacity: busy ? 0.6 : 1, border: 0, cursor: busy ? "not-allowed" : "pointer" }}>
            <Icon name="ti-user-plus" />
            {busy ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link href="/signin">Sign in</Link>
        </p>
      </Card>
    </main>
  );
}
