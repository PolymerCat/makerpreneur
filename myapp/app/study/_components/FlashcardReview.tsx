"use client";

import React from "react";
import type { Card } from "../_lib/types";
import { sm2Update } from "../_lib/sm2";

function FlashcardReview(props: {
  cards: Card[];
  onUpdateCard: (cardId: string, updates: any) => void;
  focusMode?: boolean;
  onEnterFocusMode?: () => void;
  onExitFocusMode?: () => void;
}): React.JSX.Element {
  var cards = props.cards;
  var onUpdateCard = props.onUpdateCard;
  var focusMode = props.focusMode || false;
  var onEnterFocusMode = props.onEnterFocusMode;
  var onExitFocusMode = props.onExitFocusMode;

  var [queue, setQueue] = React.useState<Card[]>([]);
  var [viewIndex, setViewIndex] = React.useState(0);
  var [revealed, setRevealed] = React.useState(false);

  React.useEffect(function() {
    setQueue(cards);
    setViewIndex(0);
    setRevealed(false);
  }, [cards]);

  var currentCard = queue.length > 0 ? queue[Math.min(viewIndex, queue.length - 1)] : null;

  function toggleFlip(): void {
    setRevealed(function(prev) {
      return !prev;
    });
  }

  function handleNext(): void {
    if (viewIndex < queue.length - 1) {
      setViewIndex(viewIndex + 1);
      setRevealed(false);
    }
  }

  function handlePrev(): void {
    if (viewIndex > 0) {
      setViewIndex(viewIndex - 1);
      setRevealed(false);
    }
  }

  function rateCard(rating: number): void {
    if (!currentCard) {
      return;
    }
    var card = currentCard;
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
    setQueue(function(prev) {
      return prev.filter(function(c) {
        return c.id !== card.id;
      });
    });
    setRevealed(false);
  }

  React.useEffect(function() {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        toggleFlip();
      } else if (e.code === "ArrowLeft") {
        handlePrev();
      } else if (e.code === "ArrowRight") {
        handleNext();
      } else if (e.code === "Digit1") {
        rateCard(0);
      } else if (e.code === "Digit2") {
        rateCard(1);
      } else if (e.code === "Digit3") {
        rateCard(2);
      } else if (e.code === "Escape" && focusMode && onExitFocusMode) {
        onExitFocusMode();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return function() {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [queue, viewIndex, focusMode, onExitFocusMode]);

  if (!currentCard) {
    return (
      <div className="flashcard-review">
        <p className="empty-state">No more cards to review right now.</p>
      </div>
    );
  }

  var flashcardElement = (
    <div
      key={currentCard.id}
      className={"flashcard-3d-wrap" + (revealed ? " is-flipped" : "")}
      onClick={toggleFlip}
    >
      <div className="flashcard-3d-inner">
        <div className="flashcard-front">
          <p className="card-text">{currentCard.front || ""}</p>
        </div>
        <div className="flashcard-back">
          <p className="card-text">{currentCard.back || ""}</p>
        </div>
      </div>
      {!focusMode && onEnterFocusMode ? (
        <button
          type="button"
          className="flashcard-fullscreen-btn"
          title="Focus Mode"
          aria-label="Enter Focus Mode"
          onClick={function(e) {
            e.stopPropagation();
            if (onEnterFocusMode) {
              onEnterFocusMode();
            }
          }}
        >
          <i className="ti ti-arrows-maximize"></i>
        </button>
      ) : null}
    </div>
  );

  var ratingButtons = (
    <div className="rating-buttons">
      <button type="button" className="btn btn-again" onClick={function() { rateCard(0); }}>
        Again (1)
      </button>
      <button type="button" className="btn btn-good" onClick={function() { rateCard(1); }}>
        Good (2)
      </button>
      <button type="button" className="btn btn-easy" onClick={function() { rateCard(2); }}>
        Easy (3)
      </button>
    </div>
  );

  var prevButton = (
    <button
      type="button"
      className={focusMode ? "focus-nav-btn" : "btn btn-sm btn-secondary"}
      onClick={handlePrev}
      disabled={viewIndex === 0}
      title="Previous (Left Arrow)"
    >
      <i className="ti ti-chevron-left"></i>
    </button>
  );

  var nextButton = (
    <button
      type="button"
      className={focusMode ? "focus-nav-btn" : "btn btn-sm btn-secondary"}
      onClick={handleNext}
      disabled={viewIndex >= queue.length - 1}
      title="Next (Right Arrow)"
    >
      <i className="ti ti-chevron-right"></i>
    </button>
  );

  if (focusMode) {
    return (
      <div className="focus-overlay" onClick={onExitFocusMode}>
        <div className="focus-header" onClick={function(e) { e.stopPropagation(); }}>
          <h3>Focus Review</h3>
          <button
            type="button"
            className="focus-exit-btn"
            onClick={onExitFocusMode}
            title="Exit Focus Mode (Esc)"
            aria-label="Exit Focus Mode"
          >
            <i className="ti ti-x"></i>
          </button>
        </div>

        <div className="focus-content-wrap" onClick={function(e) { e.stopPropagation(); }}>
          {prevButton}
          {flashcardElement}
          {nextButton}
        </div>

        <div className="focus-footer" onClick={function(e) { e.stopPropagation(); }}>
          {revealed ? ratingButtons : (
            <button type="button" className="btn btn-primary" onClick={toggleFlip}>
              Reveal Answer (Space)
            </button>
          )}

          <div className="focus-progress">
            <span>{viewIndex + 1} of {queue.length} cards</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flashcard-review">
      <div className="review-progress">
        <span>{viewIndex + 1} of {queue.length} cards</span>
      </div>

      <div className="review-nav-row">
        {prevButton}
        {flashcardElement}
        {nextButton}
      </div>

      {revealed ? ratingButtons : (
        <button type="button" className="btn btn-primary" style={{ marginTop: "20px" }} onClick={toggleFlip}>
          Reveal Answer
        </button>
      )}
    </div>
  );
}

export default FlashcardReview;
