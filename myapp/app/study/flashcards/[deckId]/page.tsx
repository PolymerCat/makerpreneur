"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import Link from "next/link";
import { db } from "../../_lib/db";
import type { Deck, Card as CardType } from "../../_lib/types";
import FlashcardReview from "../../_components/FlashcardReview";

export default function DeckReviewPage(props: { params: { deckId: string } }) {
  var deckId = props.params.deckId;
  var [deck, setDeck] = React.useState<Deck | null>(null);
  var [cards, setCards] = React.useState<CardType[]>([]);
  var [focusMode, setFocusMode] = React.useState(false);

  async function loadData(): Promise<void> {
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
  }

  React.useEffect(function() {
    (async function() {
      await loadData();
    })();
  }, [deckId]);

  async function handleUpdateCard(cardId: string, updates: any): Promise<void> {
    await db.update("cards", cardId, updates);
    await loadData();
  }

  async function handleResetAll(): Promise<void> {
    if (!window.confirm("Reset all cards in this deck?")) {
      return;
    }
    for (var i = 0; i < cards.length; i++) {
      await db.update("cards", cards[i].id, {
        easiness: 2.5,
        interval: 0,
        repetitions: 0,
        dueDate: new Date().toISOString()
      });
    }
    await loadData();
  }

  if (!deck) {
    return (
      <AppShell>
        <p>Loading...</p>
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

      <div className="review-controls">
        <Link href="/study/flashcards" className="btn btn-sm">
          <i className="ti ti-arrow-left"></i>
          {" Back to Decks"}
        </Link>
        <button className="btn btn-sm" onClick={function() { setFocusMode(!focusMode); }}>
          {focusMode ? "Exit Focus Mode" : "Focus Mode"}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={handleResetAll}>
          Reset All
        </button>
      </div>

      <Card>
        <FlashcardReview
          cards={cards}
          onUpdateCard={handleUpdateCard}
        />
      </Card>
    </AppShell>
  );
}
