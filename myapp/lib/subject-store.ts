import type { SupabaseClient } from "@supabase/supabase-js";
import type { Subject } from "./types";

const SUBJECTS_KEY = "sh_subjects";

function storage(): Subject[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(SUBJECTS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function getSubjects(): Subject[] {
  return storage();
}

export function getSubject(id: string): Subject | undefined {
  return storage().find(s => s.id === id);
}

export async function createSubject(
  data: { subject_code: string; subject_name: string; description: string; created_by: string },
  supabase?: SupabaseClient,
): Promise<Subject> {
  const subjects: Subject[] = storage();
  const now = new Date().toISOString();
  const subject: Subject = {
    id: crypto.randomUUID(),
    ...data,
    created_at: now,
    updated_at: now,
  };

  subjects.push(subject);
  localStorage.setItem(SUBJECTS_KEY, JSON.stringify(subjects));

  if (supabase) {
    supabase
      .from("subjects")
      .insert({
        id: subject.id,
        subject_code: subject.subject_code,
        subject_name: subject.subject_name,
        description: subject.description,
        created_by: subject.created_by,
      })
      .then(({ error }) => {
        if (error) console.warn("Supabase sync failed (RLS may be on):", error.message);
      });
  }

  return subject;
}

export async function updateSubject(
  id: string,
  data: { subject_code?: string; subject_name?: string; description?: string },
  supabase?: SupabaseClient,
  userId?: string,
): Promise<Subject | null> {
  const subjects: Subject[] = storage();
  const idx = subjects.findIndex(s => s.id === id);
  if (idx === -1) return null;

  const now = new Date().toISOString();
  subjects[idx] = { ...subjects[idx], ...data, updated_at: now };
  localStorage.setItem(SUBJECTS_KEY, JSON.stringify(subjects));

  if (supabase) {
    let req = supabase.from("subjects").update({ ...data, updated_at: now }).eq("id", id);
    if (userId) req = req.eq("created_by", userId);
    req.then(({ error }) => {
      if (error) console.warn("Supabase sync failed:", error.message);
    });
  }

  return subjects[idx];
}

export async function deleteSubject(id: string, supabase?: SupabaseClient, userId?: string): Promise<void> {
  const subjects: Subject[] = storage();
  const filtered = subjects.filter(s => s.id !== id);
  localStorage.setItem(SUBJECTS_KEY, JSON.stringify(filtered));

  if (supabase) {
    let req = supabase.from("subjects").delete().eq("id", id);
    if (userId) req = req.eq("created_by", userId);
    req.then(({ error }) => {
      if (error) console.warn("Supabase sync failed:", error.message);
    });
  }
}
