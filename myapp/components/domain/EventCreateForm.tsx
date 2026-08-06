"use client";

import { useState } from "react";
import type { FormField, MyCSDEvent } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { db } from "@/app/study/_lib/db";

export const EVENT_CATEGORIES = [
  "Career",
  "Technology",
  "Volunteer",
  "Academic",
  "Social",
  "Sports",
  "Other",
];

export const DEFAULT_FORM_FIELDS: FormField[] = [
  { id: "f-name", label: "Name", required: true },
  { id: "f-matric", label: "Matric no.", required: true },
  { id: "f-phone", label: "Phone", required: false },
  { id: "f-email", label: "Email", required: true },
  { id: "f-school", label: "School", required: false },
];

export type EventInput = {
  name: string;
  organizer: string;
  category: string;
  startsAt: string;
  endsAt?: string | null;
  imageUrl?: string | null;
  location: string;
  points: number;
  fee: string;
  registrationDeadline: string;
  description: string;
  formFields: FormField[];
};

function generateA4Image(
  imgSrc: string,
  containerW: number,
  containerH: number,
  panX: number,
  panY: number,
  zoom: number
): Promise<Blob> {
  return new Promise(function(resolve, reject) {
    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function() {
      var canvas = document.createElement("canvas");
      var targetW = 1050;
      var targetH = 1485; // 1050 * (297 / 210) = 1485 (Exact A4 1:1.4142 ratio)
      canvas.width = targetW;
      canvas.height = targetH;
      var ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No canvas context"));

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetW, targetH);

      var imgW = img.naturalWidth || img.width;
      var imgH = img.naturalHeight || img.height;

      var baseScale = Math.max(containerW / imgW, containerH / imgH);
      var drawW = imgW * baseScale * zoom;
      var drawH = imgH * baseScale * zoom;
      var drawX = (containerW - drawW) / 2 + panX;
      var drawY = (containerH - drawH) / 2 + panY;

      var scaleFactor = targetW / containerW;

      ctx.drawImage(
        img,
        drawX * scaleFactor,
        drawY * scaleFactor,
        drawW * scaleFactor,
        drawH * scaleFactor
      );

      canvas.toBlob(function(blob) {
        if (blob) resolve(blob);
        else reject(new Error("Failed to export A4 image blob"));
      }, "image/jpeg", 0.92);
    };
    img.onerror = function(err) {
      reject(err);
    };
    img.src = imgSrc;
  });
}

type EventCreateFormProps = {
  initial?: MyCSDEvent | null;
  onSave: (data: EventInput) => void;
  onClose: () => void;
};

function toDateInput(iso: string): string {
  var d = new Date(iso);
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function toTimeInput(iso: string): string {
  var d = new Date(iso);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

let fieldSeq = 0;

export function EventCreateForm({ initial, onSave, onClose }: EventCreateFormProps) {
  var base = initial ?? null;
  var lockedFields = !!base && base.registeredCount > 0;

  var [name, setName] = useState(base?.name ?? "");
  var [organizer, setOrganizer] = useState(base?.organizer ?? "");
  var [category, setCategory] = useState(base?.category ?? EVENT_CATEGORIES[0]);
  var [date, setDate] = useState(base ? toDateInput(base.startsAt) : "");
  var [start, setStart] = useState(base ? toTimeInput(base.startsAt) : "09:00");
  var [end, setEnd] = useState(base && base.endsAt ? toTimeInput(base.endsAt) : "12:00");
  var [imageUrl, setImageUrl] = useState(base?.imageUrl ?? "");
  var [location, setLocation] = useState(base?.location ?? "");
  var [points, setPoints] = useState(base ? String(base.points) : "0");
  var [fee, setFee] = useState(base?.fee ?? "");
  var [deadlineDate, setDeadlineDate] = useState(base ? toDateInput(base.registrationDeadline) : "");
  var [description, setDescription] = useState(base?.description ?? "");
  var [fields, setFields] = useState<FormField[]>(
    base ? (base.formFields.length > 0 ? base.formFields : DEFAULT_FORM_FIELDS) : DEFAULT_FORM_FIELDS
  );
  var [error, setError] = useState("");

  function updateField(id: string, patch: Partial<FormField>) {
    setFields(fields.map(function(f) {
      return f.id === id ? { ...f, ...patch } : f;
    }));
  }

  function addField() {
    fieldSeq++;
    setFields(fields.concat([{ id: "f-" + Date.now() + "-" + fieldSeq, label: "", required: false }]));
  }

  function removeField(id: string) {
    setFields(fields.filter(function(f) { return f.id !== id; }));
  }

  var [rawImageSrc, setRawImageSrc] = useState("");
  var [rawFile, setRawFile] = useState<File | null>(null);
  var [panX, setPanX] = useState(0);
  var [panY, setPanY] = useState(0);
  var [zoom, setZoom] = useState(1);
  var [isDragging, setIsDragging] = useState(false);
  var [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  var [uploadingImage, setUploadingImage] = useState(false);

  function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    var file = e.target.files?.[0];
    if (!file) return;
    setRawFile(file);
    setPanX(0);
    setPanY(0);
    setZoom(1);
    var url = URL.createObjectURL(file);
    setRawImageSrc(url);
  }

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging) return;
    setPanX(e.clientX - dragStart.x);
    setPanY(e.clientY - dragStart.y);
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    var delta = e.deltaY < 0 ? 0.1 : -0.1;
    var nextZoom = Math.min(Math.max(0.7, zoom + delta), 3.5);
    setZoom(Number(nextZoom.toFixed(2)));
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - panX, y: e.touches[0].clientY - panY });
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (isDragging && e.touches.length === 1) {
      setPanX(e.touches[0].clientX - dragStart.x);
      setPanY(e.touches[0].clientY - dragStart.y);
    }
  }

  function handleTouchEnd() {
    setIsDragging(false);
  }

  async function handleApplyA4Upload() {
    if (!rawImageSrc || !rawFile) return;
    setUploadingImage(true);
    setError("");
    try {
      var blob = await generateA4Image(rawImageSrc, 280, 396, panX, panY, zoom);
      var pathName = "poster-a4-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7) + ".jpg";
      var publicUrl = "";
      try {
        var uploadedPath = await db.uploadFile("events", pathName, blob, "image/jpeg");
        publicUrl = db.getPublicUrl("events", uploadedPath);
      } catch (err) {
        var fallbackPath = await db.uploadFile("repository-papers", pathName, blob, "image/jpeg");
        publicUrl = db.getPublicUrl("repository-papers", fallbackPath);
      }
      setImageUrl(publicUrl);
      setRawImageSrc("");
      setRawFile(null);
    } catch (err: any) {
      console.error("Failed to process and upload A4 poster", err);
      setError("Failed to process image: " + (err?.message || "Unknown error"));
    } finally {
      setUploadingImage(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    var trimmedFields = fields.map(function(f) {
      return { id: f.id, label: f.label.trim(), required: f.required };
    });
    if (trimmedFields.length === 0) {
      setError("Add at least one registration field.");
      return;
    }
    if (trimmedFields.some(function(f) { return !f.label; })) {
      setError("Every registration field needs a label.");
      return;
    }
    if (!name.trim() || !organizer.trim() || !location.trim() || !date || !deadlineDate) {
      setError("Name, organizer, location, event date and registration deadline are required.");
      return;
    }
    var pointsNum = parseInt(points, 10);
    if (isNaN(pointsNum) || pointsNum < 0) {
      setError("MyCSD points must be a number 0 or greater.");
      return;
    }
    var startsAt = new Date(date + "T" + start).toISOString();
    var endsAt = end ? new Date(date + "T" + end).toISOString() : null;
    var deadline = new Date(deadlineDate + "T23:59:59").toISOString();
    if (new Date(deadline).getTime() > new Date(startsAt).getTime()) {
      setError("Registration deadline must be on or before the event start.");
      return;
    }
    if (endsAt && new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
      setError("End time must be after start time.");
      return;
    }
    onSave({
      name: name.trim(),
      organizer: organizer.trim(),
      category: category,
      startsAt: startsAt,
      endsAt: endsAt,
      imageUrl: imageUrl.trim() || null,
      location: location.trim(),
      points: pointsNum,
      fee: fee.trim(),
      registrationDeadline: deadline,
      description: description.trim(),
      formFields: trimmedFields,
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <Card
        className="modal"
        style={{
          padding: "28px 36px",
          width: "min(880px, 94vw)",
          maxWidth: 880,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={function(e) { e.stopPropagation(); }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, borderBottom: "2px solid var(--line)", paddingBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontFamily: "'Outfit', sans-serif", fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name={base ? "ti-edit" : "ti-calendar-plus"} />
              {base ? "Edit Event Details" : "Post a New Event"}
            </h2>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
              Fill in the details below to publish an event on the MyCSD campus board.
            </p>
          </div>
          <button className="small-action" type="button" onClick={onClose} aria-label="Close" style={{ cursor: "pointer", padding: "8px 12px" }}>
            <Icon name="ti-x" />
          </button>
        </div>

        <form className="form-stack" onSubmit={handleSubmit} style={{ gap: 18 }}>
          {/* Section 1: Basic Information */}
          <div>
            <h4 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: "var(--text)", borderBottom: "1px solid var(--line)", paddingBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="ti-info-circle" /> 1. Basic Information
            </h4>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                Event Name *
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. AI & Robotics Hands-on Workshop" required autoFocus style={{ marginTop: 6, height: 42, fontSize: 14 }} />
              </label>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                Organizer *
                <input value={organizer} onChange={(e) => setOrganizer(e.target.value)} placeholder="e.g. USM Robotics Club" required style={{ marginTop: 6, height: 42, fontSize: 14 }} />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                Category *
                <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...selectStyle, marginTop: 6, height: 42, fontSize: 14 }}>
                  {EVENT_CATEGORIES.map(function(c) { return <option key={c} value={c}>{c}</option>; })}
                </select>
              </label>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                Location / Venue *
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Dewan Utama Pelajar / Online Zoom" required style={{ marginTop: 6, height: 42, fontSize: 14 }} />
              </label>
            </div>

            {/* Poster Image File Upload & A4 Panning Frame */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
                Poster Image <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400 }}>(A4 Format: 210 × 297 mm)</span>
              </label>

              {uploadingImage ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "32px 16px", border: "2px dashed var(--line)", borderRadius: "var(--radius)", background: "var(--surface)" }}>
                  <Icon name="ti-loader" className="spinning" />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Processing & Uploading A4 Poster…</span>
                </div>
              ) : rawImageSrc ? (
                /* Main & Only Component: Interactive A4 Image Box */
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: 18, border: "2px solid var(--brand)", borderRadius: "var(--radius)", background: "var(--surface)" }}>
                  {/* A4 Mouse Drag Viewport */}
                  <div
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onWheel={handleWheel}
                    style={{
                      width: 280,
                      height: 396,
                      position: "relative",
                      overflow: "hidden",
                      borderRadius: "var(--radius)",
                      border: "2px solid var(--brand)",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                      background: "#ffffff",
                      cursor: isDragging ? "grabbing" : "grab",
                      userSelect: "none",
                      touchAction: "none",
                    }}
                  >
                    <img
                      src={rawImageSrc}
                      alt="A4 Crop Preview"
                      draggable={false}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transform: "translate(" + panX + "px, " + panY + "px) scale(" + zoom + ")",
                        transformOrigin: "center center",
                        transition: isDragging ? "none" : "transform 0.05s ease-out",
                        pointerEvents: "none",
                      }}
                    />
                    <div style={{ position: "absolute", bottom: 6, left: 6, right: 6, background: "rgba(0,0,0,0.75)", color: "#fff", padding: "4px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, textAlign: "center", pointerEvents: "none" }}>
                      Drag to pan · Scroll to zoom
                    </div>
                  </div>

                  {/* Compact Zoom Controls Bar */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--line)", padding: "4px 10px", borderRadius: "var(--radius)" }}>
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost"
                      onClick={function() { setZoom(Math.max(0.7, Number((zoom - 0.1).toFixed(2)))); }}
                      style={{ padding: "2px 8px", cursor: "pointer" }}
                      title="Zoom Out"
                    >
                      <Icon name="ti-minus" />
                    </button>
                    <span style={{ fontSize: 12, fontWeight: 700, minWidth: 44, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost"
                      onClick={function() { setZoom(Math.min(3.5, Number((zoom + 0.1).toFixed(2)))); }}
                      style={{ padding: "2px 8px", cursor: "pointer" }}
                      title="Zoom In"
                    >
                      <Icon name="ti-plus" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost"
                      onClick={function() { setPanX(0); setPanY(0); setZoom(1); }}
                      style={{ padding: "2px 8px", cursor: "pointer", fontSize: 11 }}
                      title="Reset"
                    >
                      Reset
                    </button>
                  </div>

                  {/* Clean Action Buttons */}
                  <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 360 }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleApplyA4Upload}
                      style={{ flex: 1, height: 42, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                    >
                      <Icon name="ti-check" /> Confirm & Upload A4
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={function() { setRawImageSrc(""); setRawFile(null); }}
                      style={{ height: 42, fontSize: 13, cursor: "pointer", padding: "0 14px" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : imageUrl ? (
                /* Uploaded A4 Poster Display */
                <div style={{ display: "flex", alignItems: "center", gap: 16, border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 12, background: "var(--surface)" }}>
                  <div
                    style={{
                      width: 90,
                      height: 127,
                      overflow: "hidden",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--line)",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                      flexShrink: 0,
                    }}
                  >
                    <img src={imageUrl} alt="A4 Poster" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>A4 Poster Uploaded</p>
                    <p style={{ margin: "4px 0 10px", fontSize: 12, color: "var(--muted)" }}>Formatted to 210 × 297 mm A4 Portrait</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <label className="btn btn-xs btn-ghost" style={{ cursor: "pointer", fontSize: 12, padding: "4px 10px", border: "1px solid var(--line)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Icon name="ti-replace" /> Change Poster
                        <input type="file" accept="image/*" onChange={handleImageFileChange} style={{ display: "none" }} />
                      </label>
                      <button
                        type="button"
                        onClick={function() { setImageUrl(""); }}
                        className="btn btn-xs btn-ghost"
                        style={{ cursor: "pointer", fontSize: 12, padding: "4px 10px", border: "1px solid var(--line)", color: "var(--danger, #ef4444)" }}
                      >
                        <Icon name="ti-trash" /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Dropzone to select file */
                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "24px 16px",
                    border: "2px dashed var(--line)",
                    borderRadius: "var(--radius)",
                    background: "var(--surface)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(99, 102, 241, 0.1)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "var(--brand, #6366f1)" }}>
                    <Icon name="ti-upload" />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Click to upload poster image</span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>Image will open in A4 Pan & Fit cropper</span>
                  <input type="file" accept="image/*" onChange={handleImageFileChange} style={{ display: "none" }} />
                </label>
              )}
            </div>
          </div>

          {/* Section 2: Date, Time & Points */}
          <div>
            <h4 style={{ margin: "10px 0 14px", fontSize: 15, fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: "var(--text)", borderBottom: "1px solid var(--line)", paddingBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="ti-calendar" /> 2. Schedule & Requirements
            </h4>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                Event Date *
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required style={{ marginTop: 6, height: 42, fontSize: 14 }} />
              </label>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                Registration Deadline Date *
                <input type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} required style={{ marginTop: 6, height: 42, fontSize: 14 }} />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                Start Time *
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required style={{ marginTop: 6, width: "100%", height: 42, border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "0 12px", fontSize: 14, background: "var(--surface)" }} />
              </label>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                End Time
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={{ marginTop: 6, width: "100%", height: 42, border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "0 12px", fontSize: 14, background: "var(--surface)" }} />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                MyCSD Points *
                <input type="number" min="0" value={points} onChange={(e) => setPoints(e.target.value)} required style={{ marginTop: 6, height: 42, fontSize: 14 }} />
              </label>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                Event Fee (display text)
                <input value={fee} onChange={(e) => setFee(e.target.value)} placeholder="e.g. Free / RM 10" style={{ marginTop: 6, height: 42, fontSize: 14 }} />
              </label>
            </div>
          </div>

          {/* Section 3: Description */}
          <div>
            <h4 style={{ margin: "10px 0 14px", fontSize: 15, fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: "var(--text)", borderBottom: "1px solid var(--line)", paddingBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="ti-notes" /> 3. Event Description
            </h4>
            <label style={{ fontSize: 13, fontWeight: 600 }}>
              Description & Prerequisites
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what students will learn, agenda, and what they should bring to the event..."
                rows={4}
                style={{ ...textareaStyle, marginTop: 6, fontSize: 14, padding: 12 }}
              />
            </label>
          </div>

          {/* Section 4: Registration Fields */}
          <div>
            <h4 style={{ margin: "10px 0 6px", fontSize: 15, fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: "var(--text)", borderBottom: "1px solid var(--line)", paddingBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="ti-list-check" /> 4. Custom Registration Fields
            </h4>
            <p style={{ margin: "0 0 12px", color: "var(--muted)", fontSize: 13 }}>
              {lockedFields
                ? "Locked because students have already registered."
                : "Customize what information you require from students when they register."}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {fields.map(function(f, idx) {
                return (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 0" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--muted)", width: 22, textAlign: "right" }}>{idx + 1}.</span>
                    <input
                      value={f.label}
                      onChange={(e) => updateField(f.id, { label: e.target.value })}
                      placeholder="Field label (e.g. Matric No., T-Shirt Size, Dietary Requirements)"
                      disabled={lockedFields}
                      style={{ flex: 1, height: 40, padding: "0 14px", border: "1px solid var(--line)", borderRadius: "var(--radius)", fontSize: 14, background: "var(--surface)" }}
                    />
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer", userSelect: "none", flexShrink: 0, paddingRight: 4 }}>
                      <input
                        type="checkbox"
                        checked={f.required}
                        onChange={(e) => updateField(f.id, { required: e.target.checked })}
                        disabled={lockedFields}
                        style={{ width: 18, height: 18, cursor: "pointer" }}
                      />
                      Required
                    </label>
                    {!lockedFields && (
                      <button
                        type="button"
                        onClick={() => removeField(f.id)}
                        aria-label="Remove field"
                        title="Remove field"
                        style={{ cursor: "pointer", background: "none", border: 0, padding: 8, color: "var(--muted)", borderRadius: "var(--radius)" }}
                      >
                        <Icon name="ti-trash" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {!lockedFields && (
              <button className="btn btn-ghost btn-sm" type="button" onClick={addField} style={{ cursor: "pointer", marginTop: 12, fontSize: 14, padding: "6px 14px" }}>
                <Icon name="ti-plus" /> Add Field
              </button>
            )}
          </div>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: "var(--radius)", background: "rgba(239, 68, 68, 0.1)", border: "1px solid var(--warning)" }}>
              <p style={{ color: "var(--warning)", fontSize: 14, margin: 0, fontWeight: 600 }}>{error}</p>
            </div>
          )}

          <div className="form-actions" style={{ marginTop: 10, paddingTop: 14, borderTop: "2px solid var(--line)", justifyContent: "flex-end", gap: 12 }}>
            <button className="small-action" type="button" onClick={onClose} style={{ cursor: "pointer", height: 44, padding: "0 20px", fontSize: 14 }}>
              Cancel
            </button>
            <button className="secondary-button" type="submit" style={{ border: 0, cursor: "pointer", height: 44, padding: "0 28px", fontSize: 15, fontWeight: 700 }}>
              <Icon name="ti-device-floppy" /> {base ? "Update Event" : "Post Event Now"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  marginTop: 7,
  border: "1px solid var(--line)",
  borderRadius: "var(--radius)",
  padding: "0 12px",
  fontSize: 16,
  background: "var(--surface)",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 7,
  border: "1px solid var(--line)",
  borderRadius: "var(--radius)",
  padding: 11,
  fontFamily: "inherit",
  fontSize: 16,
  resize: "vertical",
};
