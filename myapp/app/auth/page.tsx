"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUp, signIn } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";

type AuthMode = "signin" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      if (mode === "signup") {
        signUp(email, password);
      } else {
        signIn(email, password);
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <main className="auth-page">
      <Card className="auth-card">
        <div className="brand-block">
          <span className="brand-mark">SH</span>
          <div>
            <strong>StudentHub USM</strong>
            <span>Campus workspace</span>
          </div>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Any email (prototype — no verification)"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              required
              minLength={6}
            />
          </label>

          {error && (
            <p style={{ color: "var(--warning)", fontSize: 13, margin: 0 }}>{error}</p>
          )}

          <button className="secondary-button" type="submit">
            <Icon name={mode === "signin" ? "ti-login" : "ti-user-plus"} />
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>

          <button
            className="button-link button-link-ghost"
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError("");
            }}
            style={{ border: 0, cursor: "pointer", textAlign: "center", width: "100%" }}
          >
            {mode === "signin"
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </form>
      </Card>
    </main>
  );
}
