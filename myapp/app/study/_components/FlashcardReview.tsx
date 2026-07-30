"use client";

import React from "react";
import type { Card } from "../_lib/types";
import { sm2Update } from "../_lib/sm2";

function FlashcardReview(props: {
  cards: Card[];
  onUpdateCard: (cardId: string, updates: any) => void;
}): React.JSX.Element {
  var cards = props.cards;
  var onUpdateCard = props.onUpdateCard;

  var [currentIndex, setCurrentIndex] = React.useState(0);
  var [revealed, setRevealed] = React.useState(false);

  function revealAnswer(): void {
    setRevealed(true);
  }

  function rateCard(rating: number): void {
    if (currentIndex >= cards.length) {
      return;
    }
    var card = cards[currentIndex];
    var sm2Result = sm2Update(
      card.easiness,
      card.interval,
      card.repetitions,
      rating
    );
    onUpdateCard(card.id, {
      easiness: sm2Result.easiness,
      interval: sm2Result.interval,
      repetitions: sm2Result.repetitions,
      dueDate: sm2Result.dueDate
    });
    setRevealed(false);
    if (currentIndex + 1 >= cards.length) {
      setCurrentIndex(0);
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  }

  if (cards.length === 0) {
    return (
      <div className="flashcard-review">
        <p className="empty-state">No cards to review. Generate some flashcards first!</p>
      </div>
    );
  }

  var currentCard = cards[currentIndex];
  var progress = ((currentIndex + 1) / cards.length) * 100;

  return (
    <div className="flashcard-review">
      <div className="review-progress">
        <span>{currentIndex + 1} / {cards.length}</span>
        <progress value={progress} max={100}></progress>
      </div>
      <div className="flashcard">
        <div className="card-side">
          <p className="card-text">{currentCard.front}</p>
        </div>
        {revealed ? (
          <div className="card-side card-back">
            <p className="card-text">{currentCard.back}</p>
          </div>
        ) : null}
      </div>
      {revealed ? (
        <div className="rating-buttons">
          <button className="btn btn-again" onClick={function() { rateCard(0); }}>
            Again
          </button>
          <button className="btn btn-good" onClick={function() { rateCard(1); }}>
            Good
          </button>
          <button className="btn btn-easy" onClick={function() { rateCard(2); }}>
            Easy
          </button>
        </div>
      ) : (
        <button className="btn btn-primary" onClick={revealAnswer}>
          Reveal Answer
        </button>
      )}
    </div>
  );
}

export default FlashcardReview;
