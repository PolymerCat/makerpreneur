import type { SupabaseClient } from "@supabase/supabase-js";
import type { Subject } from "./types";

const SUBJECTS_KEY = "sh_subjects";

const DEFAULT_SUBJECTS: Subject[] = [
  {
    id: "sub-1",
    subject_code: "CST434",
    subject_name: "Advanced Artificial Intelligence",
    description: "14 Lecture PDFs Indexed",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "sub-2",
    subject_code: "CST345",
    subject_name: "Distributed Systems",
    description: "6 Lecture PDFs Indexed",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function storage(): Subject[] {
  if (typeof window === "undefined") return DEFAULT_SUBJECTS;
  const raw = localStorage.getItem(SUBJECTS_KEY);
  if (!raw) {
    localStorage.setItem(SUBJECTS_KEY, JSON.stringify(DEFAULT_SUBJECTS));
    return DEFAULT_SUBJECTS;
  }
  return JSON.parse(raw);
}

export function getSubjects(): Subject[] {
  return storage();
}

export function createSubject(
  data: { subject_code: string; subject_name: string; description: string; created_by?: string },
  supabase?: SupabaseClient,
): Subject {
  const subjects = storage();
  const now = new Date().toISOString();
  const newSubject: Subject = {
    id: "sub-" + Math.random().toString(36).substr(2, 9),
    subject_code: data.subject_code,
    subject_name: data.subject_name,
    description: data.description,
    created_by: data.created_by,
    created_at: now,
    updated_at: now,
  };

  subjects.push(newSubject);
  localStorage.setItem(SUBJECTS_KEY, JSON.stringify(subjects));

  if (supabase && data.created_by) {
    supabase
      .from("subjects")
      .insert({
        id: newSubject.id,
        subject_code: newSubject.subject_code,
        subject_name: newSubject.subject_name,
        description: newSubject.description,
        created_by: data.created_by,
        created_at: now,
        updated_at: now,
      })
      .then(({ error }) => {
        if (error) console.warn("Supabase insert failed (RLS may be on):", error.message);
      });
  }

  return newSubject;
}

export function updateSubject(
  id: string,
  data: { subject_code: string; subject_name: string; description: string },
  supabase?: SupabaseClient,
  userId?: string,
): Subject {
  const subjects = storage();
  const idx = subjects.findIndex(s => s.id === id);
  if (idx === -1) throw new Error("Subject not found");

  const now = new Date().toISOString();
  const updated: Subject = {
    ...subjects[idx],
    ...data,
    updated_at: now,
  };

  subjects[idx] = updated;
  localStorage.setItem(SUBJECTS_KEY, JSON.stringify(subjects));

  if (supabase) {
    supabase
      .from("subjects")
      .update({
        subject_code: updated.subject_code,
        subject_name: updated.subject_name,
        description: updated.description,
        updated_at: now,
      })
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.warn("Supabase update failed (RLS may be on):", error.message);
      });
  }

  return updated;
}

export function deleteSubject(id: string, supabase?: SupabaseClient, userId?: string): void {
  const subjects = storage();
  const filtered = subjects.filter(s => s.id !== id);
  localStorage.setItem(SUBJECTS_KEY, JSON.stringify(filtered));

  if (supabase) {
    supabase
      .from("subjects")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.warn("Supabase delete failed (RLS may be on):", error.message);
      });
  }
}
