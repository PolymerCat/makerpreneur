"use client";

import React from "react";
import { createBrowserClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { getProfile, upsertProfile } from "@/lib/profile-store";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";

export default function ProfilePage() {
  var supabase = createBrowserClient();
  var [session, setSession] = React.useState<{ email: string; id: string } | null>(null);
  var [profile, setProfile] = React.useState<{ id: string; full_name: string } | null>(null);
  var [fullName, setFullName] = React.useState("");
  var [supaRows, setSupaRows] = React.useState(0);
  var [saved, setSaved] = React.useState(false);

  React.useEffect(function() {
    getSession().then(function(s) {
      setSession(s);
      if (s) {
        var p = getProfile(s.id);
        setProfile(p ?? null);
        if (p) {
          setFullName(p.full_name);
        }
      }
    });
    supabase.from("profiles").select("id").then(function(result) {
      setSupaRows(result.data?.length ?? 0);
    });
  }, [supabase]);

  function handleSave() {
    if (!session) {
      return;
    }
    var updated = upsertProfile(session.id, fullName);
    setProfile(updated);
    setSaved(true);
    setTimeout(function() { setSaved(false); }, 2000);
  }

  return (
    <AppShell>
      <PageHero
        eyebrow="Profile"
        title={profile?.full_name || session?.email || "Profile"}
        description="Edit your profile. Data is stored locally and mapped to the Supabase profiles table schema."
        icon="ti-user"
      />

      <section className="two-column">
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "var(--muted)", marginBottom: 4 }}>Email</label>
              <p style={{ margin: 0, fontSize: 14 }}>{session?.email ?? "—"}</p>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "var(--muted)", marginBottom: 4 }}>User ID</label>
              <code style={{ fontSize: 12 }}>{session?.id ?? "—"}</code>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "var(--muted)", marginBottom: 4 }}>Full name</label>
              <input
                value={fullName}
                onChange={function(e) { setFullName(e.target.value); }}
                placeholder="Your display name"
                style={{ marginTop: 0 }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                className="secondary-button"
                type="button"
                onClick={handleSave}
                style={{ border: 0, cursor: "pointer" }}
              >
                <Icon name="ti-device-floppy" /> Save
              </button>
              {saved ? <Badge tone="success">Saved locally</Badge> : null}
            </div>
          </div>
        </Card>

        <Card>
          <h3 style={{ margin: 0, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="ti-database" /> Supabase profiles table
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Badge tone={supaRows > 0 ? "success" : "neutral"}>
                {supaRows} row{supaRows !== 1 ? "s" : ""}
              </Badge>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>public.profiles</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
              Table schema: <code>id (uuid)</code>, <code>full_name (text)</code>, <code>created_at</code>, <code>updated_at</code>.
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
              RLS requires <code>auth.uid() = id</code>. For prototype, data is stored locally with the same schema.
              Turn off RLS in Supabase dashboard to persist directly.
            </p>
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
