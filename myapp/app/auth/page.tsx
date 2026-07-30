"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { signUp, signIn } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";

type AuthMode = "signin" | "signup";

export default function AuthPage() {
  var router = useRouter();
  var [mode, setMode] = React.useState<AuthMode>("signin");
  var [email, setEmail] = React.useState("");
  var [password, setPassword] = React.useState("");
  var [error, setError] = React.useState("");
  var [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }

    setLoading(false);
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
              onChange={function(e) { setEmail(e.target.value); }}
              placeholder="Your email address"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={function(e) { setPassword(e.target.value); }}
              placeholder="Min 6 characters"
              required
              minLength={6}
            />
          </label>

          {error ? (
            <p style={{ color: "var(--warning)", fontSize: 13, margin: 0 }}>{error}</p>
          ) : null}

          <button className="secondary-button" type="submit" disabled={loading}>
            <Icon name={mode === "signin" ? "ti-login" : "ti-user-plus"} />
            {loading ? "Please wait..." : (mode === "signin" ? "Sign in" : "Create account")}
          </button>

          <button
            className="button-link button-link-ghost"
            type="button"
            onClick={function() {
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
