"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useSession } from "@/lib/auth-context";
import { getSubjects, createSubject, updateSubject, deleteSubject } from "@/lib/subject-store";
import type { Subject } from "@/lib/types";

export function SubjectsSection() {
  const { supabase, user } = useSession();
  const [subjects, setSubjects] = useState<Subject[]>(() => getSubjects());
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Subject | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const refresh = useCallback(() => {
    setSubjects(getSubjects());
  }, []);

  function resetForm() {
    setCode("");
    setName("");
    setDescription("");
    setEditTarget(null);
    setShowForm(false);
  }

  function openEdit(s: Subject) {
    setEditTarget(s);
    setCode(s.subject_code);
    setName(s.subject_name);
    setDescription(s.description);
    setShowForm(true);
  }

  async function handleSave() {
    if (!code.trim() || !name.trim()) return;

    if (editTarget) {
      const updated = await updateSubject(editTarget.id, { subject_code: code, subject_name: name, description }, supabase, user?.id);
      if (updated) refresh();
    } else if (user) {
      await createSubject({ subject_code: code, subject_name: name, description, created_by: user.id }, supabase);
      refresh();
    }

    resetForm();
  }

  async function handleDelete(id: string) {
    await deleteSubject(id, supabase, user?.id);
    refresh();
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <SectionHeader title="Subjects" description="Manage your enrolled subjects." icon="ti-books" />
        {!showForm && (
          <button className="small-action" type="button" onClick={() => setShowForm(true)} style={{ cursor: "pointer" }}>
            <Icon name="ti-plus" /> Add subject
          </button>
        )}
      </div>

      {showForm && (
        <Card className="form-stack" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>
            <Icon name={editTarget ? "ti-edit" : "ti-plus"} /> {editTarget ? "Edit subject" : "New subject"}
          </h3>
          <div>
            <label htmlFor="subjCode">Subject code</label>
            <input id="subjCode" value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. MPB201" />
          </div>
          <div>
            <label htmlFor="subjName">Subject name</label>
            <input id="subjName" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Radiotherapy" />
          </div>
          <div>
            <label htmlFor="subjDesc">Description</label>
            <textarea
              id="subjDesc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              style={{
                width: "100%",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: 11,
                fontSize: 16,
                fontFamily: "inherit",
                marginTop: 7,
                resize: "vertical",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="secondary-button" type="button" onClick={handleSave} style={{ border: 0, cursor: "pointer" }}>
              <Icon name="ti-device-floppy" /> {editTarget ? "Update" : "Create"}
            </button>
            <button className="small-action" type="button" onClick={resetForm} style={{ cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </Card>
      )}

      <div className="stack">
        {subjects.length === 0 && !showForm && (
          <Card>
            <p style={{ textAlign: "center", margin: 0, color: "var(--muted)" }}>
              No subjects yet. Click &quot;Add subject&quot; to get started.
            </p>
          </Card>
        )}
        {subjects.map(s => (
          <Card className="row-card" key={s.id}>
            <div>
              <strong>{s.subject_name}</strong>
              <span>
                {s.subject_code}
                {s.description ? ` — ${s.description}` : ""}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Badge tone="brand">{new Date(s.created_at).toLocaleDateString()}</Badge>
              <button
                className="small-action"
                type="button"
                onClick={() => openEdit(s)}
                style={{ cursor: "pointer", minHeight: 34, padding: "0 10px" }}
                aria-label="Edit"
              >
                <Icon name="ti-pencil" />
              </button>
              <button
                className="small-action"
                type="button"
                onClick={() => handleDelete(s.id)}
                style={{ cursor: "pointer", minHeight: 34, padding: "0 10px", background: "var(--warning-soft)", color: "var(--warning)" }}
                aria-label="Delete"
              >
                <Icon name="ti-trash" />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
