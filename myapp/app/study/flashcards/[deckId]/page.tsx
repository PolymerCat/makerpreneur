"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { db } from "../../_lib/db";
import type { Deck, Card as CardType } from "../../_lib/types";
import FlashcardReview from "../../_components/FlashcardReview";
import Link from "next/link";
import { CourseBar } from "../../_components/CourseBar";

export default function DeckReviewPage(props: { params: Promise<{ deckId: string }> }) {
  var params = React.use(props.params);
  var deckId = params.deckId;
  var [deck, setDeck] = React.useState<Deck | null>(null);
  var [cards, setCards] = React.useState<CardType[]>([]);
  var [focusMode, setFocusMode] = React.useState(false);
  var [loading, setLoading] = React.useState(true);

  async function loadData(): Promise<void> {
    if (!deckId) {
      setLoading(false);
      return;
    }
    try {
      var d = await db.getById("decks", deckId);
      setDeck(d);
      var allCards = await db.listAll("cards", { deckId: deckId }, null);
      var now = new Date();
      var dueCards = allCards.filter(function(c: CardType) {
        return new Date(c.dueDate) <= now;
      });
      if (dueCards.length === 0) {
        dueCards = allCards;
      }
      setCards(dueCards);
    } catch (err) {
      console.error("Error loading flashcard deck:", err);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(function() {
    if (!deckId) {
      setLoading(false);
      return;
    }
    (async function() {
      await loadData();
    })();
  }, [deckId]);

  async function handleUpdateCard(cardId: string, updates: any): Promise<void> {
    await db.update("cards", cardId, updates);
  }

  if (loading) {
    return (
      <AppShell>
        <p>Loading...</p>
      </AppShell>
    );
  }

  if (!deck) {
    return (
      <AppShell>
        <div className="p-6 text-center">
          <p className="text-muted-foreground mb-4">Deck not found or could not be loaded.</p>
          <Link href="/study/flashcards" className="btn btn-secondary">Back to Flashcards</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHero
        eyebrow="Flashcards"
        title={deck.title}
        description={cards.length + " cards due for review"}
        icon="ti-cards"
      />

      <CourseBar />

      <div className="flashcard-review-slot">
        <FlashcardReview
          cards={cards}
          onUpdateCard={handleUpdateCard}
          focusMode={focusMode}
          onEnterFocusMode={function() { setFocusMode(true); }}
          onExitFocusMode={function() { setFocusMode(false); }}
        />
      </div>
    </AppShell>
  );
}
