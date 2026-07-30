"use client";

import React from "react";
import type { Question } from "../_lib/types";

function getOptionExplanation(question: Question, opt: string, idx: number): string {
  if (!question.explanations) {
    return opt === question.answer ? "Correct choice based on the material." : "Incorrect choice based on the material.";
  }
  var exp: any = question.explanations;
  if (typeof exp === "string") {
    return exp;
  }
  if (Array.isArray(exp)) {
    if (exp[idx]) return String(exp[idx]);
  }
  if (typeof exp === "object" && exp !== null) {
    if (exp[opt]) return String(exp[opt]);

    var keys = Object.keys(exp);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].trim().toLowerCase() === opt.trim().toLowerCase()) {
        return String(exp[keys[i]]);
      }
    }

    var letter = String.fromCharCode(65 + idx);
    var num = String(idx + 1);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i].trim().toUpperCase();
      if (k === letter || k === "OPTION " + letter || k === "OPTION" + letter || k === num || k === "OPTION " + num) {
        return String(exp[keys[i]]);
      }
    }

    for (var i = 0; i < keys.length; i++) {
      if (opt.toLowerCase().includes(keys[i].trim().toLowerCase()) || keys[i].toLowerCase().includes(opt.trim().toLowerCase())) {
        return String(exp[keys[i]]);
      }
    }
  }

  return opt === question.answer ? "Correct choice based on the material." : "Incorrect choice based on the material.";
}

function QuizRunner(props: {
  questions: Question[];
  onSubmit: (answers: { questionId: string; answer: string }[]) => void;
  onGradeEssay: (questionId: string, answer: string) => Promise<{ score: number; feedback: string } | null>;
  results: Record<string, { correct: boolean; feedback?: string }> | null;
}): React.JSX.Element {
  var questions = props.questions;
  var onSubmit = props.onSubmit;
  var onGradeEssay = props.onGradeEssay;
  var results = props.results;

  var [answers, setAnswers] = React.useState<Record<string, string>>({});
  var [currentIndex, setCurrentIndex] = React.useState(0);
  var [submitted, setSubmitted] = React.useState(false);
  var [essayGrading, setEssayGrading] = React.useState(false);

  function handleAnswer(questionId: string, answer: string): void {
    var newAnswers = { ...answers };
    newAnswers[questionId] = answer;
    setAnswers(newAnswers);
  }

  function handleNext(): void {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
    }
  }

  function handlePrev(): void {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }

  async function handleSubmit(): Promise<void> {
    setEssayGrading(true);
    var answerList: { questionId: string; answer: string }[] = [];
    for (var i = 0; i < questions.length; i++) {
      var qId = questions[i].id;
      var ans = answers[qId] || "";
      answerList.push({ questionId: qId, answer: ans });

      if (questions[i].kind === "essay" && ans.trim() !== "") {
        if (onGradeEssay) {
          var gradeResult = await onGradeEssay(qId, ans);
          if (gradeResult !== null) {
            /* Grade is handled by parent via results */
          }
        }
      }
    }
    setEssayGrading(false);
    setSubmitted(true);
    onSubmit(answerList);
  }

  function navigateTo(index: number): void {
    setCurrentIndex(index);
  }

  if (questions.length === 0) {
    return (
      <div className="quiz-runner">
        <p className="empty-state">No questions available.</p>
      </div>
    );
  }

  if (submitted && results !== null) {
    var safeResults = results;
    var score = 0;
    var totalAnswered = 0;
    var resultKeys = Object.keys(safeResults);
    for (var i = 0; i < resultKeys.length; i++) {
      var key = resultKeys[i];
      if (safeResults[key].correct) {
        score = score + 1;
      }
      totalAnswered = totalAnswered + 1;
    }
    var scorePercent = totalAnswered > 0 ? Math.round((score / totalAnswered) * 100) : 0;

    return (
      <div className="quiz-results">
        <h3>Results: {score} / {totalAnswered} ({scorePercent}%)</h3>
        {questions.map(function(q) {
          var qResult = safeResults[q.id];
          if (!qResult) {
            return null;
          }
          return (
            <div key={q.id} className={"result-item " + (qResult.correct ? "correct" : "incorrect")}>
              <p><strong>{q.prompt}</strong></p>
              <p>Your answer: {answers[q.id] || "(empty)"}</p>
              {q.kind !== "essay" ? (
                <>
                  <p>Correct answer: {q.answer}</p>
                  <div className="option-explanations" style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <strong>Explanations:</strong>
                    {(q.options || (q.kind === "tf" ? ["True", "False"] : [])).map(function(opt: string, idx: number) {
                      var isOptCorrect = opt === q.answer;
                      var isOptSelected = answers[q.id] === opt;
                      var optExp = getOptionExplanation(q, opt, idx);
                      return (
                        <div key={idx} style={{
                          padding: "6px 10px",
                          borderRadius: "4px",
                          fontSize: "13px",
                          background: isOptCorrect ? "#ecfdf5" : isOptSelected ? "#fef2f2" : "var(--surface-2)",
                          borderLeft: "3px solid " + (isOptCorrect ? "#10b981" : isOptSelected ? "#ef4444" : "var(--border)"),
                          color: isOptCorrect ? "#065f46" : isOptSelected ? "#991b1b" : "var(--text)"
                        }}>
                          <strong>{opt} {isOptCorrect ? " (Correct)" : isOptSelected ? " (Your Selection)" : ""}</strong>: {optExp}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}
              {qResult.feedback ? (
                <p className="feedback">Feedback: {qResult.feedback}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  var question = questions[currentIndex];
  var progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="quiz-runner">
      <div className="quiz-progress">
        <span>Question {currentIndex + 1} of {questions.length}</span>
        <progress value={progress} max={100}></progress>
      </div>
      <div className="question-nav">
        {questions.map(function(q, idx) {
          var dotClass = "nav-dot";
          if (answers[q.id]) {
            dotClass = dotClass + " answered";
          }
          if (idx === currentIndex) {
            dotClass = dotClass + " current";
          }
          return (
            <button
              key={q.id}
              className={dotClass}
              onClick={function() { navigateTo(idx); }}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
      <div className="question-card">
        <span className="question-kind-badge">{question.kind.toUpperCase()}</span>
        <p className="question-prompt">{question.prompt}</p>
        {question.kind === "mcq" ? (
          <div className="mcq-options">
            {(question.options || []).map(function(opt: string, idx: number) {
              var isSelected = answers[question.id] === opt;
              var hasAnswered = !!answers[question.id];
              var isCorrectOption = opt === question.answer;
              
              var className = "mcq-option";
              if (hasAnswered) {
                if (isCorrectOption) {
                  className += " is-correct";
                } else if (isSelected) {
                  className += " is-incorrect";
                }
              } else if (isSelected) {
                className += " selected";
              }

              return (
                <label key={idx} className={className}>
                  <span className="option-text">{opt}</span>
                  <input
                    type="radio"
                    name={"q_" + question.id}
                    checked={isSelected}
                    disabled={hasAnswered}
                    onChange={function() {
                      if (!hasAnswered) {
                        handleAnswer(question.id, opt);
                      }
                    }}
                  />
                </label>
              );
            })}
          </div>
        ) : question.kind === "tf" ? (
          <div className="tf-options">
            {["True", "False"].map(function(opt: string, idx: number) {
              var isSelected = answers[question.id] === opt;
              var hasAnswered = !!answers[question.id];
              var isCorrectOption = opt === question.answer;
              
              var className = "tf-option";
              if (hasAnswered) {
                if (isCorrectOption) {
                  className += " is-correct";
                } else if (isSelected) {
                  className += " is-incorrect";
                }
              } else if (isSelected) {
                className += " selected";
              }

              return (
                <label key={idx} className={className}>
                  <span className="option-text">{opt}</span>
                  <input
                    type="radio"
                    name={"q_" + question.id}
                    checked={isSelected}
                    disabled={hasAnswered}
                    onChange={function() {
                      if (!hasAnswered) {
                        handleAnswer(question.id, opt);
                      }
                    }}
                  />
                </label>
              );
            })}
          </div>
        ) : question.kind === "essay" ? (
          <div className="essay-input">
            <textarea
              value={answers[question.id] || ""}
              onChange={function(e) { handleAnswer(question.id, e.target.value); }}
              placeholder="Write your answer here..."
              rows={6}
            />
          </div>
        ) : null}

        {!!answers[question.id] && (question.kind === "mcq" || question.kind === "tf") && (
          <div className="instant-feedback">
            <div className={"feedback-header " + (answers[question.id] === question.answer ? "correct" : "incorrect")}>
              {answers[question.id] === question.answer ? "✓ Correct!" : "✗ Incorrect"}
            </div>
            <div className="option-explanations">
              <h4>Option Explanations:</h4>
              {(question.options || (question.kind === "tf" ? ["True", "False"] : [])).map(function(opt: string, idx: number) {
                var isOptCorrect = opt === question.answer;
                var isOptSelected = answers[question.id] === opt;
                var optExp = getOptionExplanation(question, opt, idx);
                return (
                  <div key={idx} className={"explanation-item " + (isOptCorrect ? "correct-opt" : isOptSelected ? "selected-opt" : "")}>
                    <strong>{opt} {isOptCorrect ? " (Correct)" : isOptSelected ? " (Your Selection)" : ""}</strong>: {optExp}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="quiz-nav-buttons">
        <button className="btn" onClick={handlePrev} disabled={currentIndex === 0}>
          Previous
        </button>
        <button
          className="btn btn-primary"
          onClick={currentIndex + 1 < questions.length ? handleNext : handleSubmit}
        >
          {currentIndex + 1 < questions.length ? "Next" : (essayGrading ? "Grading..." : "Submit")}
        </button>
      </div>
    </div>
  );
}

export default QuizRunner;
