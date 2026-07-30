"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import { db } from "../../_lib/db";
import type { Material, Chunk } from "../../_lib/types";
import MaterialChat from "../../_components/MaterialChat";
import { aiEmbedQuery, aiChat } from "../../actions";

async function retrieveChunks(
  question: string,
  materialId: string,
  topK: number
): Promise<string[]> {
  var embedding = await aiEmbedQuery(question);
  var results = await db.vectorSearch(materialId, embedding, topK);
  var chunkTexts: string[] = [];
  for (var i = 0; i < results.length; i++) {
    chunkTexts.push(results[i].text);
  }
  return chunkTexts;
}

export default function MaterialDetailPage(props: { params: Promise<{ id: string }> }) {
  var params = React.use(props.params);
  var materialId = params.id;
  var [material, setMaterial] = React.useState<Material | null>(null);
  var [chunks, setChunks] = React.useState<Chunk[]>([]);
  var [tab, setTab] = React.useState("chunks");

  React.useEffect(function() {
    if (!materialId) {
      return;
    }
    (async function() {
      var mat = await db.getById("materials", materialId);
      setMaterial(mat);
      var chunkList = await db.listAll("chunks", { materialId: materialId }, null);
      chunkList.sort(function(a: Chunk, b: Chunk) {
        if (a.page !== b.page) {
          return a.page - b.page;
        }
        return a.chunkIndex - b.chunkIndex;
      });
      setChunks(chunkList);
    })();
  }, [materialId]);

  async function handleSendMessage(question: string, _materialId: string): Promise<string> {
    var chunkTexts = await retrieveChunks(question, materialId, 8);
    return await aiChat(chunkTexts, question, "", "en");
  }

  if (!material) {
    return (
      <AppShell>
        <PageHero eyebrow="Study" title="Material" description="Loading..." icon="ti-file-text" />
        <p>Loading...</p>
      </AppShell>
    );
  }

  var materials = [material];

  return (
    <AppShell>
      <PageHero
        eyebrow={material.category === "exam_paper" ? "Exam Paper" : "Material"}
        title={material.title}
        description={"Status: " + material.status}
        icon="ti-file-text"
      />

      {material.fileUrl ? (
        <a
          href={material.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start" }}
        >
          <i className="ti ti-download"></i> Download original file
        </a>
      ) : null}

      <div className="material-tabs">
        <button className={"tab " + (tab === "chunks" ? "active" : "")} onClick={function() { setTab("chunks"); }}>
          Chunks ({chunks.length})
        </button>
        <button className={"tab " + (tab === "chat" ? "active" : "")} onClick={function() { setTab("chat"); }}>
          Chat
        </button>
      </div>

      <Card>
        {tab === "chunks" ? (
          <div className="chunk-list">
            {chunks.length === 0 ? (
              <p className="empty-state">No chunks yet. Index this material first.</p>
            ) : null}
            {chunks.map(function(chunk: Chunk) {
              return (
                <div key={chunk.id} className="chunk-item">
                  <span className="chunk-meta">Page {chunk.page}, Chunk {chunk.chunkIndex}</span>
                  <p className="chunk-text">{chunk.text}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <MaterialChat
            materials={materials}
            onSendMessage={handleSendMessage}
          />
        )}
      </Card>
    </AppShell>
  );
}
