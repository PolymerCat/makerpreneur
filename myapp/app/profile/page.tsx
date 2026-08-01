"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-context";
import { getProfile, upsertProfile } from "@/lib/profile-store";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";

export default function ProfilePage() {
  const { supabase, user } = useSession();
  const [profile, setProfile] = useState(getProfile(user?.id ?? ""));
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [matricNumber, setMatricNumber] = useState(profile?.matric_number ?? "");
  const [preferredLanguage, setPreferredLanguage] = useState<"en" | "bm">(profile?.preferred_language ?? "en");
  const [supaRows, setSupaRows] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from("profiles").select("id").then(({ data }) => {
      setSupaRows(data?.length ?? 0);
    });
  }, [supabase]);

  function handleSave() {
    if (!user) return;
    const updated = upsertProfile(
      user.id,
      {
        full_name: fullName,
        matric_number: matricNumber,
        preferred_language: preferredLanguage,
        role: "student",
      },
      supabase,
    );
    setProfile(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <AppShell>
      <PageHero
        eyebrow="Profile"
        title={profile?.full_name || user?.email || "Profile"}
        description="Edit your profile. Changes are synced to the Supabase profiles table."
        icon="ti-user"
      />

      <section className="two-column">
        <Card>
          <div className="form-stack">
            <div>
              <label>Email</label>
              <p style={{ margin: "7px 0 0", fontSize: 14 }}>{user?.email ?? "—"}</p>
            </div>
            <div>
              <label>User ID</label>
              <code style={{ fontSize: 12, display: "block", marginTop: 7 }}>{user?.id ?? "—"}</code>
            </div>
            <div>
              <label htmlFor="fullName">Full name</label>
              <input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your display name" />
            </div>
            <div>
              <label htmlFor="matric">Matric number</label>
              <input id="matric" value={matricNumber} onChange={e => setMatricNumber(e.target.value)} placeholder="e.g. 17101234" />
            </div>
            <div>
              <label htmlFor="lang">Preferred language</label>
              <select
                id="lang"
                value={preferredLanguage}
                onChange={e => setPreferredLanguage(e.target.value as "en" | "bm")}
                style={{
                  width: "100%",
                  height: 44,
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius)",
                  padding: "0 12px",
                  fontSize: 16,
                  background: "var(--surface)",
                  marginTop: 7,
                }}
              >
                <option value="en">English</option>
                <option value="bm">Bahasa Melayu</option>
              </select>
            </div>
            <div>
              <label>Role</label>
              <p style={{ margin: "7px 0 0", fontSize: 14 }}>
                <Badge tone="brand">Student</Badge>
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              <button className="secondary-button" type="button" onClick={handleSave} style={{ border: 0, cursor: "pointer" }}>
                <Icon name="ti-device-floppy" /> Save
              </button>
              {saved && <Badge tone="success">Saved to database</Badge>}
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
              Table schema: <code>id (uuid)</code>, <code>full_name (text)</code>, <code>matric_number (text)</code>,{" "}
              <code>preferred_language (text)</code>, <code>role (text)</code>, <code>created_at</code>, <code>updated_at</code>.
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
              Data is persisted via Supabase Auth + the profiles table. RLS policies grant access based on <code>auth.uid() = id</code>.
            </p>
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
