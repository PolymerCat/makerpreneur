"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import Link from "next/link";
import { db } from "../_lib/db";
import type { Material } from "../_lib/types";
import { useCourse } from "../_lib/CourseProvider";
import { CoursePicker } from "../_components/CoursePicker";
import { CourseBar } from "../_components/CourseBar";
import { aiDetectMetadata, aiEmbedTexts, deleteStorageFiles } from "../actions";
import { chunkPages } from "../_lib/ai/chunk";

var STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  uploading: "Uploading",
  extracting: "Extracting",
  indexing: "Indexing",
  ready: "Ready",
  failed: "Failed"
};

var STATUS_CLASSES: Record<string, string> = {
  pending: "status-pending",
  uploading: "status-uploading",
  extracting: "status-extracting",
  indexing: "status-indexing",
  ready: "status-ready",
  failed: "status-failed"
};

var BATCH_SIZE = 50;

export default function MaterialsPage() {
  var { activeCourse } = useCourse();

  if (!activeCourse) {
    return <AppShell><CoursePicker /></AppShell>;
  }

  var courseId = activeCourse.id;

  var [materials, setMaterials] = React.useState<Material[]>([]);
  var [activeTab, setActiveTab] = React.useState("all");
  var [uploading, setUploading] = React.useState(false);
  var [chunkCounts, setChunkCounts] = React.useState<Record<string, number>>({});

  async function loadMaterials(): Promise<void> {
    var all = await db.listAll("materials", { courseId: courseId }, "createdAt");
    setMaterials(all);
    var counts: Record<string, number> = {};
    for (var i = 0; i < all.length; i++) {
      var chunks = await db.listAll("chunks", { materialId: all[i].id }, null);
      counts[all[i].id] = chunks.length;
    }
    setChunkCounts(counts);
  }

  React.useEffect(function() {
    (async function() {
      await loadMaterials();
    })();
  }, []);

  async function extractAndIndex(
    materialId: string,
    storagePath: string,
    fileName: string,
    fileType: string
  ): Promise<void> {
    try {
      await db.update("materials", materialId, { status: "extracting" });
      await loadMaterials();

      var extractResponse = await fetch("/study/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storagePath: storagePath })
      });

      if (!extractResponse.ok) {
        var extractError = await extractResponse.text();
        throw new Error("Extraction failed: " + extractError);
      }

      var extractResult = await extractResponse.json();
      var pages: { page: number; text: string }[] = extractResult.pages || [];

      if (pages.length === 0) {
        throw new Error("No text extracted from file");
      }

      var firstPage = pages[0].text.slice(0, 1200);
      var metadata = {
        title: fileName.replace(/\.[^/.]+$/, ""),
        year: new Date().getFullYear(),
        semester: "1",
        category: "regular",
        courseCode: ""
      };
      try {
        metadata = await aiDetectMetadata(firstPage, fileName);
      } catch (_err) {
      }

      await db.update("materials", materialId, {
        title: metadata.title,
        category: metadata.category,
        year: metadata.year,
        semester: metadata.semester,
        status: "indexing"
      });
      await loadMaterials();

      var chunks = chunkPages(pages, null, null);
      if (chunks.length === 0) {
        throw new Error("No chunks generated");
      }

      var chunkTexts: string[] = [];
      for (var i = 0; i < chunks.length; i++) {
        chunkTexts.push(chunks[i].text);
      }
      var embeddings: number[][] = [];
      for (var b = 0; b < chunkTexts.length; b = b + BATCH_SIZE) {
        var batch = chunkTexts.slice(b, b + BATCH_SIZE);
        var batchEmbeddings = await aiEmbedTexts(batch);
        for (var j = 0; j < batchEmbeddings.length; j++) {
          embeddings.push(batchEmbeddings[j]);
        }
      }
      for (var i = 0; i < chunks.length; i++) {
        await db.insert("chunks", {
          materialId: materialId,
          page: chunks[i].page,
          chunkIndex: chunks[i].chunkIndex,
          text: chunks[i].text,
          embedding: embeddings[i] || []
        });
      }
      await db.update("materials", materialId, { status: "ready" });
      await loadMaterials();
    } catch (err) {
      await db.update("materials", materialId, { status: "failed" });
      await loadMaterials();
      throw err;
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    var files = e.target.files;
    if (!files || files.length === 0) {
      return;
    }
    var file = files[0];
    var fileName = file.name;
    var fileType = file.type;
    setUploading(true);

    var insertMaterial: any = null;

    try {
      insertMaterial = await db.insert("materials", {
        courseId: courseId,
        title: fileName.replace(/\.[^/.]+$/, ""),
        fileUrl: "",
        fileType: fileType,
        status: "pending",
        createdAt: new Date().toISOString(),
        category: "regular",
        year: new Date().getFullYear(),
        semester: "1"
      });
      await loadMaterials();

      var arrayBuffer = await file.arrayBuffer();
      var storagePath = courseId + "/" + insertMaterial.id + "/" + fileName;

      await db.update("materials", insertMaterial.id, { status: "uploading" });
      await loadMaterials();

      try {
        await db.uploadFile("materials", storagePath, arrayBuffer);
      } catch (uploadErr) {
        throw new Error("Upload failed: " + String(uploadErr));
      }

      var publicUrl = db.getPublicUrl("materials", storagePath);
      await db.update("materials", insertMaterial.id, { fileUrl: publicUrl });

      await extractAndIndex(insertMaterial.id, storagePath, fileName, fileType);
    } catch (err) {
      console.error("Upload failed", err);
      if (insertMaterial) {
        await db.update("materials", insertMaterial.id, { status: "failed" });
        await loadMaterials();
      }
      setUploading(false);
      return;
    }

    setUploading(false);
  }

  async function handleIndex(materialId: string): Promise<void> {
    var material = await db.getById("materials", materialId);
    if (!material) {
      return;
    }

    var fileUrl: string = material.fileUrl || "";
    if (fileUrl === "") {
      alert("No file stored for this material. Re-upload it.");
      return;
    }

    var storagePath = fileUrl.split("/storage/v1/object/public/materials/")[1];
    if (!storagePath) {
      alert("Invalid storage URL. Re-upload the file.");
      return;
    }

    try {
      await extractAndIndex(materialId, storagePath, material.title, material.fileType);
    } catch (err) {
      console.error("Index failed", err);
      await db.update("materials", materialId, { status: "failed" });
      await loadMaterials();
    }
  }

  async function handleDelete(materialId: string): Promise<void> {
    if (!window.confirm("Delete this material and all associated data?")) {
      return;
    }
    var material = await db.getById("materials", materialId);
    var fileUrl: string = material?.fileUrl || "";

    if (fileUrl !== "") {
      var storagePath = fileUrl.split("/storage/v1/object/public/materials/")[1];
      if (storagePath) {
        try {
          await deleteStorageFiles([storagePath]);
        } catch (err) {
          console.error("Storage delete failed", err);
        }
      }
    }

    var chunks = await db.listAll("chunks", { materialId: materialId }, null);
    for (var i = 0; i < chunks.length; i++) {
      await db.delete("chunks", chunks[i].id);
    }
    await db.delete("materials", materialId);
    await loadMaterials();
  }

  var filtered: Material[] = [];
  if (activeTab === "all") {
    filtered = materials;
  } else if (activeTab === "regular") {
    filtered = materials.filter(function(m) { return m.category === "regular"; });
  } else if (activeTab === "exam_paper") {
    filtered = materials.filter(function(m) { return m.category === "exam_paper"; });
  }

  return (
    <AppShell>
      <PageHero
        eyebrow="Study"
        title="Materials"
        description="Upload PDFs — stored in Supabase Storage, indexed for AI search"
        icon="ti-file-text"
      />

      <CourseBar />

      <Card>
        <div className="upload-area">
          <input type="file" accept=".pdf,.docx,.pptx,.txt" onChange={handleFileChange} disabled={uploading} />
          {uploading ? <span className="upload-status">Processing...</span> : null}
        </div>
      </Card>

      <Card>
        <div className="tab-bar">
          <button className={"tab " + (activeTab === "all" ? "active" : "")} onClick={function() { setActiveTab("all"); }}>
            All
          </button>
          <button className={"tab " + (activeTab === "regular" ? "active" : "")} onClick={function() { setActiveTab("regular"); }}>
            Regular
          </button>
          <button className={"tab " + (activeTab === "exam_paper" ? "active" : "")} onClick={function() { setActiveTab("exam_paper"); }}>
            Exam Papers
          </button>
        </div>

        <div className="material-list">
          {filtered.length === 0 ? (
            <p className="empty-state">No materials yet. Upload a PDF to get started.</p>
          ) : null}
          {filtered.map(function(mat: Material) {
            var statusLabel = STATUS_LABELS[mat.status] || mat.status;
            var statusClass = STATUS_CLASSES[mat.status] || "";
            var fileName = mat.fileUrl
              ? mat.fileUrl.split("/").pop() || mat.title
              : mat.title;
            var isProcessing = mat.status === "uploading" || mat.status === "extracting" || mat.status === "indexing";
            return (
              <div key={mat.id} className="material-row">
                <div className="material-info">
                  <Link href={"/study/materials/" + mat.id}>
                    <strong>{mat.title}</strong>
                  </Link>
                  <span className="file-meta">{fileName}</span>
                  {mat.category === "exam_paper" ? (
                    <span className="category-badge">{mat.year} / Sem {mat.semester}</span>
                  ) : null}
                  {mat.fileUrl && mat.status === "ready" ? (
                    <a href={mat.fileUrl} target="_blank" className="download-link" rel="noreferrer">Download</a>
                  ) : null}
                </div>
                <div className="material-actions">
                  <span className={"status-badge " + statusClass}>{statusLabel}</span>
                  {!isProcessing && mat.status !== "ready" ? (
                    <button className="btn btn-sm btn-primary" onClick={function() { handleIndex(mat.id); }}>
                      Index
                    </button>
                  ) : null}
                  {mat.status === "failed" ? (
                    <button className="btn btn-sm" onClick={function() { handleIndex(mat.id); }}>
                      Retry
                    </button>
                  ) : null}
                  <button className="btn btn-sm btn-ghost" onClick={function() { handleDelete(mat.id); }}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </AppShell>
  );
}
