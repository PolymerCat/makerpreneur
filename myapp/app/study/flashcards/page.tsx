"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import Link from "next/link";
import { db } from "../_lib/db";
import type { Material, Deck } from "../_lib/types";
import SourceSelector from "../_components/SourceSelector";
import { aiMakeFlashcards } from "../actions";
import { DEFAULT_EASINESS, DEFAULT_INTERVAL, DEFAULT_REPETITIONS } from "../_lib/sm2";
import { useCourse } from "../_lib/CourseProvider";
import { CoursePicker } from "../_components/CoursePicker";
import { CourseBar } from "../_components/CourseBar";

export default function FlashcardsPage() {
  var { activeCourse } = useCourse();

  if (!activeCourse) {
    return <AppShell><CoursePicker /></AppShell>;
  }

  var courseId = activeCourse.id;

  var [materials, setMaterials] = React.useState<Material[]>([]);
  var [decks, setDecks] = React.useState<Deck[]>([]);
  var [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  var [cardCount, setCardCount] = React.useState(10);
  var [deckName, setDeckName] = React.useState("");
  var [generating, setGenerating] = React.useState(false);
  var [language, setLanguage] = React.useState("en");
  var [cardData, setCardData] = React.useState<Record<string, {total: number, due: number, sourceName: string}>>({});

  React.useEffect(function() {
    (async function() {
      var allMats = await db.listAll("materials", { status: "ready", courseId: courseId }, "title");
      setMaterials(allMats);
      var allDecks = await db.listAll("decks", null, null);
      setDecks(allDecks);
      var cd: Record<string, {total: number, due: number, sourceName: string}> = {};
      for (var i = 0; i < allDecks.length; i++) {
        var d = allDecks[i];
        var allCards = await db.listAll("cards", { deckId: d.id }, null);
        var dueCards = allCards.filter(function(c: any) {
          return new Date(c.dueDate) <= new Date();
        });
        var mat = await db.getById("materials", d.materialId);
        cd[d.id] = { total: allCards.length, due: dueCards.length, sourceName: mat ? mat.title : "Unknown" };
      }
      setCardData(cd);
    })();
  }, []);

  async function handleGenerate(): Promise<void> {
    if (selectedIds.length === 0) {
      return;
    }
    setGenerating(true);
    try {
      var fullText = await db.materialText(selectedIds);
      var cards = await aiMakeFlashcards(fullText, language, cardCount);
      var deckTitle = deckName.trim() || ("Flashcards v" + (decks.length + 1));
      var deck = await db.insert("decks", {
        materialId: selectedIds[0],
        title: deckTitle
      });
      for (var i = 0; i < cards.length; i++) {
        await db.insert("cards", {
          deckId: deck.id,
          front: cards[i].front,
          back: cards[i].back,
          easiness: DEFAULT_EASINESS,
          interval: DEFAULT_INTERVAL,
          repetitions: DEFAULT_REPETITIONS,
          dueDate: new Date().toISOString()
        });
      }
      var allDecks = await db.listAll("decks", null, null);
      setDecks(allDecks);
      setDeckName("");
    } catch (err) {
      console.error("Generate flashcards failed", err);
    }
    setGenerating(false);
  }

  return (
    <AppShell>
      <PageHero
        eyebrow="Study"
        title="Flashcards"
        description="Create and review flashcards with spaced repetition"
        icon="ti-cards"
      />
      <CourseBar />

      <Card>
        <h3>Generate New Deck</h3>
        <SourceSelector
          materials={materials}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          label="Source materials"
        />
        <div className="generate-controls">
          <label>
            Deck name:
            <input
              type="text"
              value={deckName}
              onChange={function(e) { setDeckName(e.target.value); }}
              placeholder="My Flashcards"
            />
          </label>
          <label>
            Cards: {cardCount}
            <input
              type="range"
              min={5}
              max={30}
              value={cardCount}
              onChange={function(e) { setCardCount(parseInt(e.target.value, 10)); }}
            />
          </label>
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={selectedIds.length === 0 || generating}
          >
            {generating ? "Generating..." : "Generate"}
          </button>
        </div>
      </Card>

      <Card>
        <h3>Your Decks</h3>
        <div className="deck-grid">
          {decks.length === 0 ? (
            <p className="empty-state">No decks yet. Generate one above.</p>
          ) : null}
          {decks.map(function(deck: Deck) {
            var cd = cardData[deck.id] || { total: 0, due: 0, sourceName: "Unknown" };
            return (
              <div key={deck.id} className="deck-card">
                <h4>{deck.title}</h4>
                <p className="deck-meta">From: {cd.sourceName}</p>
                <p className="deck-meta">{cd.total} cards, {cd.due} due for review</p>
                <Link href={"/study/flashcards/" + deck.id} className="btn btn-primary">
                  Review
                </Link>
              </div>
            );
          })}
        </div>
      </Card>
    </AppShell>
  );
}
