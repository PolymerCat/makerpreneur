"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { useSession } from "@/lib/auth-context";
import { db } from "@/app/study/_lib/db";

var BUCKET = "repository-papers";
var MAX_BYTES = 50 * 1024 * 1024;
var ACCEPTED_EXTS = [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".doc", ".docx", ".txt"];

function displayName(user: any): string {
  if (!user) return "Anonymous";
  var meta = user.user_metadata || {};
  if (meta.full_name) return meta.full_name;
  if (user.email) return user.email.split("@")[0];
  return "Anonymous";
}

function formatDate(iso: string): string {
  if (!iso) return "";
  var d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) +
    " at " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function fileSizeLabel(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function RepositoryPage() {
  var { user } = useSession();
  var userId = user?.id || "";

  var [faculties, setFaculties] = React.useState<any[]>([]);
  var [courses, setCourses] = React.useState<any[]>([]);
  var [papers, setPapers] = React.useState<any[]>([]);
  var [loading, setLoading] = React.useState(true);

  var [activeFaculty, setActiveFaculty] = React.useState<any | null>(null);
  var [activeCourse, setActiveCourse] = React.useState<any | null>(null);
  var [query, setQuery] = React.useState("");

  var [uploadOpen, setUploadOpen] = React.useState(false);
  var [preview, setPreview] = React.useState<any | null>(null);

  async function loadAll() {
    try {
      var f = await db.listAll("faculties", null, "name");
      var c = await db.listAll("repository_courses", null, null);
      var p = await db.listRepositoryPapers();
      setFaculties(f);
      setCourses(c);
      setPapers(p);
    } catch (err) {
      console.error("Failed to load repository", err);
    }
    setLoading(false);
  }

  React.useEffect(function() {
    loadAll();
  }, []);

  function papersForCourse(courseId: string) {
    return papers.filter(function(p) { return p.courseId === courseId; });
  }

  function countForCourse(courseId: string): number {
    return papersForCourse(courseId).length;
  }

  function coursesForFaculty(facultyId: string) {
    return courses.filter(function(c) { return c.facultyId === facultyId; });
  }

  function countForFaculty(facultyId: string): number {
    var total = 0;
    var cs = coursesForFaculty(facultyId);
    for (var i = 0; i < cs.length; i++) {
      total += countForCourse(cs[i].id);
    }
    return total;
  }

  var searchResults: any[] = [];
  if (query.trim()) {
    var q = query.trim().toLowerCase();
    searchResults = papers.filter(function(p) {
      return (p.title || "").toLowerCase().indexOf(q) !== -1 ||
        (p.courseCode || "").toLowerCase().indexOf(q) !== -1 ||
        (p.courseName || "").toLowerCase().indexOf(q) !== -1 ||
        (p.uploadedByName || "").toLowerCase().indexOf(q) !== -1 ||
        String(p.year).indexOf(q) !== -1 ||
        (p.tags || []).some(function(t: string) { return t.toLowerCase().indexOf(q) !== -1; });
    });
  }

  function goHome() {
    setActiveFaculty(null);
    setActiveCourse(null);
    setQuery("");
  }

  function openFaculty(f: any) {
    setActiveFaculty(f);
    setActiveCourse(null);
    setQuery("");
  }

  function openCourse(c: any) {
    setActiveCourse(c);
    setQuery("");
  }

  async function handleDeleteFaculty(f: any) {
    if (!window.confirm('Delete "' + f.name + '"? All its courses and papers will be removed.')) return;
    await db.delete("faculties", f.id);
    await loadAll();
  }

  async function handleDeleteCourse(c: any) {
    if (!window.confirm('Delete "' + c.courseCode + " - " + c.courseName + '"? All its papers will be removed.')) return;
    await db.delete("repository_courses", c.id);
    await loadAll();
  }

  async function handleDeletePaper(p: any) {
    if (!window.confirm('Delete "' + p.title + '"?')) return;
    try {
      var path = (p.fileUrl || "").split("/storage/v1/object/public/" + BUCKET + "/")[1];
      if (path) {
        await db.deleteStorageObject(BUCKET, path);
      }
    } catch (err) {
      console.error("Failed to delete storage file", err);
    }
    await db.delete("repository_papers", p.id);
    await loadAll();
  }

  function renderPaperRow(p: any) {
    var isOwner = p.uploadedBy === userId;
    var isImage = (p.fileType || "").indexOf("image/") === 0;
    return (
      <div key={p.id} className="repo-paper-row">
        <div className="repo-paper-main">
          <strong>{p.title}</strong>
          <div className="repo-paper-meta">
            <span>{p.courseCode} · {p.courseName}</span>
            <span>{p.year} · Sem {p.semester}</span>
            {(p.tags || []).map(function(t: string, i: number) {
              return <span key={i} className="repo-tag">{t}</span>;
            })}
          </div>
          <div className="repo-paper-meta">
            <Icon name="ti-user" />
            <span>Uploaded by {p.uploadedByName || "Anonymous"} · {formatDate(p.createdAt)}</span>
            {p.fileSize ? <span> · {fileSizeLabel(p.fileSize)}</span> : null}
          </div>
        </div>
        <div className="repo-paper-actions">
          <button className="btn btn-sm" onClick={function() { setPreview(p); }}>
            <Icon name={isImage ? "ti-photo" : "ti-file-text"} />
            View
          </button>
          <a href={p.fileUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-secondary">
            <Icon name="ti-download" />
            Download
          </a>
          {isOwner ? (
            <button className="btn btn-sm btn-ghost" onClick={function() { handleDeletePaper(p); }}>
              <Icon name="ti-trash" />
              Delete
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  function renderPaperList(items: any[]) {
    if (items.length === 0) {
      return <p>No papers found.</p>;
    }
    var sorted = items.slice().sort(function(a, b) {
      if (a.year !== b.year) return b.year - a.year;
      return String(a.semester) < String(b.semester) ? 1 : -1;
    });
    return <div className="repo-paper-list">{sorted.map(renderPaperRow)}</div>;
  }

  return (
    <AppShell>
      <PageHero
        eyebrow="Repository"
        title="Exam Paper Repository"
        description="Browse past year papers shared by students, or contribute your own."
        icon="ti-files"
      />

      <div className="repo-toolbar">
        <input
          className="input"
          placeholder="Search by title, course code, faculty, year, tag..."
          value={query}
          onChange={function(e) { setQuery(e.target.value); }}
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary" onClick={function() { setUploadOpen(true); }}>
          <Icon name="ti-upload" />
          Upload Paper
        </button>
      </div>

      {query.trim() ? (
        <div>
          <div className="repo-breadcrumb">
            <button className="breadcrumb-link" onClick={goHome}>Repository</button>
            <span> / </span>
            <span>Search results ({searchResults.length})</span>
          </div>
          <Card>
            {renderPaperList(searchResults)}
          </Card>
        </div>
      ) : activeCourse ? (
        <div>
          <div className="repo-breadcrumb">
            <button className="breadcrumb-link" onClick={goHome}>Repository</button>
            <span> / </span>
            <button className="breadcrumb-link" onClick={function() { setActiveCourse(null); }}>{activeFaculty?.name}</button>
            <span> / </span>
            <span>{activeCourse.courseCode} - {activeCourse.courseName}</span>
          </div>
          <Card>
            {renderPaperList(papersForCourse(activeCourse.id))}
          </Card>
        </div>
      ) : activeFaculty ? (
        <div>
          <div className="repo-breadcrumb">
            <button className="breadcrumb-link" onClick={goHome}>Repository</button>
            <span> / </span>
            <span>{activeFaculty.name}</span>
          </div>
          <div className="feature-grid">
            {coursesForFaculty(activeFaculty.id).map(function(c) {
              return (
                <div key={c.id} className="feature-card" style={{ cursor: "pointer" }} onClick={function() { openCourse(c); }}>
                  <i className="ti ti-school"></i>
                  <h3>{c.courseCode}</h3>
                  <p>{c.courseName} · {countForCourse(c.id)} paper{countForCourse(c.id) === 1 ? "" : "s"}</p>
                  {c.createdBy === userId ? (
                    <button className="btn btn-sm btn-ghost" style={{ marginTop: 10 }} onClick={function(e) { e.stopPropagation(); handleDeleteCourse(c); }}>
                      <Icon name="ti-trash" />
                      Delete
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <div className="repo-breadcrumb">
            <button className="breadcrumb-link" onClick={goHome}>Repository</button>
            <span> / </span>
            <span>All faculties</span>
          </div>
          {loading ? (
            <p>Loading repository...</p>
          ) : faculties.length === 0 ? (
            <Card>
              <p>No faculties yet. Upload a paper to create one.</p>
            </Card>
          ) : (
            <div className="feature-grid">
              {faculties.map(function(f) {
                return (
                  <div key={f.id} className="feature-card" style={{ cursor: "pointer" }} onClick={function() { openFaculty(f); }}>
                    <i className="ti ti-building-skyscraper"></i>
                    <h3>{f.name}</h3>
                    <p>{countForFaculty(f.id)} paper{countForFaculty(f.id) === 1 ? "" : "s"} · {coursesForFaculty(f.id).length} course{coursesForFaculty(f.id).length === 1 ? "" : "s"}</p>
                    {f.createdBy === userId ? (
                      <button className="btn btn-sm btn-ghost" style={{ marginTop: 10 }} onClick={function(e) { e.stopPropagation(); handleDeleteFaculty(f); }}>
                        <Icon name="ti-trash" />
                        Delete
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {uploadOpen ? (
        <UploadModal
          user={user}
          faculties={faculties}
          courses={courses}
          onClose={function() { setUploadOpen(false); }}
          onSaved={function() {
            setUploadOpen(false);
            loadAll();
          }}
        />
      ) : null}

      {preview ? (
        <PreviewModal
          paper={preview}
          onClose={function() { setPreview(null); }}
        />
      ) : null}
    </AppShell>
  );
}

function UploadModal(props: {
  user: any;
  faculties: any[];
  courses: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  var [file, setFile] = React.useState<File | null>(null);
  var [uploading, setUploading] = React.useState(false);
  var [saving, setSaving] = React.useState(false);
  var [storageUrl, setStorageUrl] = React.useState("");
  var [error, setError] = React.useState("");

  var [facultyId, setFacultyId] = React.useState("");
  var [addingFaculty, setAddingFaculty] = React.useState(false);
  var [newFacultyName, setNewFacultyName] = React.useState("");

  var [courseId, setCourseId] = React.useState("");
  var [addingCourse, setAddingCourse] = React.useState(false);
  var [newCourseCode, setNewCourseCode] = React.useState("");
  var [newCourseName, setNewCourseName] = React.useState("");

  var [title, setTitle] = React.useState("");
  var [year, setYear] = React.useState(new Date().getFullYear());
  var [tags, setTags] = React.useState("");

  function validateFile(f: File): string {
    var ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (ACCEPTED_EXTS.indexOf(ext) === -1) {
      return "Unsupported file type. Allowed: " + ACCEPTED_EXTS.join(", ");
    }
    if (f.size > MAX_BYTES) {
      return "File is larger than 50 MB.";
    }
    return "";
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var v = validateFile(f);
    if (v) {
      setError(v);
      return;
    }
    setError("");
    setFile(f);
    setTitle(f.name.replace(/\.[^/.]+$/, ""));

    setUploading(true);
    try {
      var userId = props.user?.id || "anon";
      var path = userId + "/" + Date.now() + "-" + f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      await db.uploadFile(BUCKET, path, f, f.type || "application/octet-stream");
      setStorageUrl(db.getPublicUrl(BUCKET, path));
    } catch (err) {
      setError("Upload failed: " + String(err));
    }
    setUploading(false);
  }

  function handleFacultyChange(v: string) {
    setFacultyId(v);
    setCourseId("");
    setAddingCourse(false);
    setAddingFaculty(v === "__new__");
  }

  function handleCourseChange(v: string) {
    setCourseId(v);
    setAddingCourse(v === "__new__");
  }

  async function handleSave() {
    setError("");
    setSaving(true);
    try {
      var fid = facultyId;
      if (addingFaculty || !fid) {
        if (!newFacultyName.trim()) {
          setError("Enter a faculty/school name.");
          setSaving(false);
          return;
        }
        var fac = await db.insert("faculties", { name: newFacultyName.trim() });
        fid = fac.id;
      }

      var cid = courseId;
      if (addingCourse || !cid) {
        if (!newCourseCode.trim()) {
          setError("Enter a course code.");
          setSaving(false);
          return;
        }
        var courseCode = newCourseCode.trim().toUpperCase();
        var course = await db.insert("repository_courses", {
          facultyId: fid,
          courseCode: courseCode,
          courseName: newCourseName.trim() || courseCode
        });
        cid = course.id;
      }

      if (!storageUrl) {
        setError("File not uploaded yet.");
        setSaving(false);
        return;
      }

      var tagList = tags.split(",").map(function(t) { return t.trim(); }).filter(function(t) { return t.length > 0; });

      await db.insert("repository_papers", {
        courseId: cid,
        title: title.trim() || "Untitled Paper",
        year: Number(year) || new Date().getFullYear(),
        fileUrl: storageUrl,
        fileType: file?.type || "",
        fileSize: file?.size || 0,
        tags: tagList,
        uploadedByName: displayName(props.user)
      });

      props.onSaved();
    } catch (err) {
      setError("Save failed: " + String(err));
    }
    setSaving(false);
  }

  var courseOptions = props.courses.filter(function(c) {
    return c.facultyId === facultyId && c.id !== "__new__";
  });

  return (
    <div className="modal-backdrop" onClick={function() { if (!uploading && !saving) props.onClose(); }}>
      <Card className="modal" style={{ padding: 22 }} onClick={function(e) { e.stopPropagation(); }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="ti-upload" />
            Upload Paper
          </h3>
          <button className="small-action" type="button" onClick={props.onClose} aria-label="Close" style={{ cursor: "pointer" }}>
            <Icon name="ti-x" />
          </button>
        </div>

        {error ? <p className="repo-error">{error}</p> : null}

        <label className="repo-file-zone">
          <input type="file" accept={ACCEPTED_EXTS.join(",")} onChange={handleFileChange} disabled={uploading} />
          {file ? (
            <span>
              <strong>{file.name}</strong>
              <small>{fileSizeLabel(file.size)}</small>
            </span>
          ) : (
            <span>
              <Icon name="ti-file-upload" />
              Choose a PDF, image, or document
            </span>
          )}
          {uploading ? <small className="repo-hint">Uploading to storage...</small> : null}
        </label>

        {storageUrl ? (
          <div className="form-stack" style={{ marginTop: 16 }}>
            <label>
              Faculty / School
              <select value={addingFaculty ? "__new__" : facultyId} onChange={function(e) { handleFacultyChange(e.target.value); }}>
                <option value="">Select faculty...</option>
                {props.faculties.map(function(f) {
                  return <option key={f.id} value={f.id}>{f.name}</option>;
                })}
                <option value="__new__">+ Add new faculty...</option>
              </select>
            </label>

            {addingFaculty ? (
              <label>
                New faculty name
                <input value={newFacultyName} onChange={function(e) { setNewFacultyName(e.target.value); }} placeholder="e.g. School of Electrical & Electronic" />
              </label>
            ) : null}

            {addingFaculty || facultyId ? (
              <>
                {facultyId && !addingFaculty ? (
                  <label>
                    Course
                    <select value={addingCourse ? "__new__" : courseId} onChange={function(e) { handleCourseChange(e.target.value); }}>
                      <option value="">Select course...</option>
                      {courseOptions.map(function(c) {
                        return <option key={c.id} value={c.id}>{c.courseCode} - {c.courseName}</option>;
                      })}
                      <option value="__new__">+ Add new course...</option>
                    </select>
                  </label>
                ) : null}

                {addingCourse || addingFaculty ? (
                  <div className="form-row">
                    <label>
                      Course code
                      <input value={newCourseCode} onChange={function(e) { setNewCourseCode(e.target.value); }} placeholder="e.g. CST434" />
                    </label>
                    <label>
                      Course name (optional)
                      <input value={newCourseName} onChange={function(e) { setNewCourseName(e.target.value); }} placeholder="e.g. Antennas & Propagation" />
                    </label>
                  </div>
                ) : null}
              </>
            ) : null}

            <label>
              Title
              <input value={title} onChange={function(e) { setTitle(e.target.value); }} />
            </label>

            <div className="form-row">
              <label>
                Year
                <input type="number" value={year} onChange={function(e) { setYear(Number(e.target.value)); }} min={1990} max={2100} />
              </label>
              <label>
                Tags (comma separated)
                <input value={tags} onChange={function(e) { setTags(e.target.value); }} placeholder="e.g. finals, exam" />
              </label>
            </div>

            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || uploading}>
                {saving ? "Saving..." : "Save Paper"}
              </button>
              <button className="btn" onClick={props.onClose} disabled={saving || uploading}>Cancel</button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function PreviewModal(props: { paper: any; onClose: () => void }) {
  var p = props.paper;
  var isImage = (p.fileType || "").indexOf("image/") === 0;
  var isPdf = p.fileType === "application/pdf";

  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <Card className="repo-preview-modal" style={{ padding: 22 }} onClick={function(e) { e.stopPropagation(); }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>{p.title}</h3>
          <button className="small-action" type="button" onClick={props.onClose} aria-label="Close" style={{ cursor: "pointer" }}>
            <Icon name="ti-x" />
          </button>
        </div>

        <div className="repo-preview-meta">
          <span><Icon name="ti-school" /> {p.courseCode} - {p.courseName}</span>
          <span>{p.year} · Sem {p.semester}</span>
          <span><Icon name="ti-user" /> Uploaded by {p.uploadedByName || "Anonymous"} · {formatDate(p.createdAt)}</span>
          {(p.tags || []).map(function(t: string, i: number) {
            return <span key={i} className="repo-tag">{t}</span>;
          })}
        </div>

        <div className="repo-preview-body">
          {isImage ? (
            <img src={p.fileUrl} alt={p.title} style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 8 }} />
          ) : isPdf ? (
            <iframe src={p.fileUrl} title={p.title} style={{ width: "100%", height: "70vh", border: "1px solid var(--line)", borderRadius: 8 }} />
          ) : (
            <p>This file type cannot be previewed in the browser.</p>
          )}
        </div>

        <div className="form-actions" style={{ marginTop: 12 }}>
          <a href={p.fileUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
            <Icon name="ti-download" />
            Download
          </a>
        </div>
      </Card>
    </div>
  );
}
