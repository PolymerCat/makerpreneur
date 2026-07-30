import type { SupabaseClient } from "@supabase/supabase-js";

const PROFILES_KEY = "sh_profiles";

export type Profile = {
  id: string;
  full_name: string;
  matric_number: string;
  preferred_language: "en" | "bm";
  role: "student" | "admin";
  created_at: string;
  updated_at: string;
};

function storage(): Profile[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(PROFILES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function getProfiles(): Profile[] {
  return storage();
}

export function getProfile(userId: string): Profile | undefined {
  return storage().find(p => p.id === userId);
}

export function upsertProfile(
  userId: string,
  data: Partial<Omit<Profile, "id" | "created_at">>,
  supabase?: SupabaseClient,
): Profile {
  const profiles: Profile[] = storage();
  const now = new Date().toISOString();
  const idx = profiles.findIndex(p => p.id === userId);

  let updated: Profile;
  if (idx >= 0) {
    updated = { ...profiles[idx], ...data, updated_at: now };
    profiles[idx] = updated;
  } else {
    updated = {
      id: userId,
      full_name: data.full_name ?? "",
      matric_number: data.matric_number ?? "",
      preferred_language: data.preferred_language ?? "en",
      role: data.role ?? "student",
      created_at: now,
      updated_at: now,
    };
    profiles.push(updated);
  }

  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));

  if (supabase) {
    supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          full_name: updated.full_name,
          matric_number: updated.matric_number || null,
          preferred_language: updated.preferred_language,
          role: updated.role,
          updated_at: now,
        },
        { onConflict: "id" },
      )
      .then(({ error }) => {
        if (error) console.warn("Supabase sync failed (RLS may be on):", error.message);
      });
  }

  return updated;
}
