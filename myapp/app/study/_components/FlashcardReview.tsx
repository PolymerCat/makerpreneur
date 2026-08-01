"use client";

import React from "react";
import type { Card } from "../_lib/types";
import { sm2Update } from "../_lib/sm2";

function FlashcardReview(props: {
  cards: Card[];
  onUpdateCard: (cardId: string, updates: any) => void;
  focusMode?: boolean;
  onExitFocusMode?: () => void;
}): React.JSX.Element {
  var cards = props.cards;
  var onUpdateCard = props.onUpdateCard;
  var focusMode = props.focusMode || false;
  var onExitFocusMode = props.onExitFocusMode;

  var [currentIndex, setCurrentIndex] = React.useState(0);
  var [revealed, setRevealed] = React.useState(false);

  function toggleFlip(): void {
    setRevealed(function(prev) {
      return !prev;
    });
  }

  function handleNext(): void {
    if (currentIndex + 1 < cards.length) {
      setCurrentIndex(currentIndex + 1);
      setRevealed(false);
    }
  }

  function handlePrev(): void {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setRevealed(false);
    }
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

  // Keyboard controls
  React.useEffect(function() {
    function handleKeyDown(e: KeyboardEvent) {
      if (cards.length === 0) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        toggleFlip();
      } else if (e.code === "ArrowLeft") {
        handlePrev();
      } else if (e.code === "ArrowRight") {
        handleNext();
      } else if (e.code === "Escape" && focusMode && onExitFocusMode) {
        onExitFocusMode();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return function() {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [cards, currentIndex, focusMode, onExitFocusMode]);

  // Reset index if cards change and index is out of bounds
  React.useEffect(function() {
    if (currentIndex >= cards.length && cards.length > 0) {
      setCurrentIndex(0);
    }
  }, [cards.length, currentIndex]);

  if (cards.length === 0 || !cards[currentIndex]) {
    return (
      <div className="flashcard-review">
        <p className="empty-state">No cards to review. Generate some flashcards first!</p>
      </div>
    );
  }

  var currentCard = cards[currentIndex];
  var progress = ((currentIndex + 1) / cards.length) * 100;

  // 3D Flashcard element
  var flashcardElement = (
    <div className={"flashcard-3d-wrap" + (revealed ? " is-flipped" : "")} onClick={toggleFlip}>
      <div className="flashcard-3d-inner">
        <div className="flashcard-front">
          <p className="card-text">{currentCard?.front || ""}</p>
        </div>
        <div className="flashcard-back">
          <p className="card-text">{currentCard?.back || ""}</p>
        </div>
      </div>
    </div>
  );

  if (focusMode) {
    return (
      <div className="focus-overlay" onClick={onExitFocusMode}>
        <div className="focus-header" onClick={function(e) { e.stopPropagation(); }}>
          <h3>Focus Review</h3>
          <button type="button" className="btn btn-sm btn-ghost" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)" }} onClick={onExitFocusMode}>
            Exit Focus Mode (Esc)
          </button>
        </div>

        <div className="focus-content-wrap" onClick={function(e) { e.stopPropagation(); }}>
          <button
            type="button"
            className="focus-nav-btn"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            title="Previous (Left Arrow)"
          >
            <i className="ti ti-chevron-left"></i>
          </button>

          {flashcardElement}

          <button
            type="button"
            className="focus-nav-btn"
            onClick={handleNext}
            disabled={currentIndex + 1 >= cards.length}
            title="Next (Right Arrow)"
          >
            <i className="ti ti-chevron-right"></i>
          </button>
        </div>

        <div className="focus-footer" onClick={function(e) { e.stopPropagation(); }}>
          {revealed ? (
            <div className="rating-buttons">
              <button type="button" className="btn btn-again" onClick={function() { rateCard(0); }}>
                Again
              </button>
              <button type="button" className="btn btn-good" onClick={function() { rateCard(1); }}>
                Good
              </button>
              <button type="button" className="btn btn-easy" onClick={function() { rateCard(2); }}>
                Easy
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-primary" onClick={toggleFlip}>
              Reveal Answer (Space)
            </button>
          )}

          <div className="focus-progress">
            <span>{currentIndex + 1} of {cards.length} cards</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flashcard-review">
      <div className="review-progress">
        <span>{currentIndex + 1} / {cards.length}</span>
        <progress value={progress} max={100}></progress>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px" }}>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={handlePrev}
          disabled={currentIndex === 0}
        >
          <i className="ti ti-chevron-left"></i>
        </button>

        {flashcardElement}

        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={handleNext}
          disabled={currentIndex + 1 >= cards.length}
        >
          <i className="ti ti-chevron-right"></i>
        </button>
      </div>

      {revealed ? (
        <div className="rating-buttons">
          <button type="button" className="btn btn-again" onClick={function() { rateCard(0); }}>
            Again
          </button>
          <button type="button" className="btn btn-good" onClick={function() { rateCard(1); }}>
            Good
          </button>
          <button type="button" className="btn btn-easy" onClick={function() { rateCard(2); }}>
            Easy
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-primary" style={{ marginTop: "20px" }} onClick={toggleFlip}>
          Reveal Answer
        </button>
      )}
    </div>
  );
}

export default FlashcardReview;
