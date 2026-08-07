"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

type StageData = {
  num: string;
  title: string;
  desc: string;
  subs: string[];
};

var STAGE_DATA: StageData[] = [
  {
    num: "STEP 1",
    title: "Create your account",
    desc: "Sign up with your student email. No phone, no fuss.",
    subs: [
      "Click the Sign up tab",
      "Enter your student email address",
      "Pick a password & click Create Account",
    ],
  },
  {
    num: "STEP 2",
    title: "Check your inbox",
    desc: "We'll send you a confirmation link. One click, done.",
    subs: [
      "Open your USM email inbox",
      "Find the Confirm email message",
      "Click the link to verify your account",
    ],
  },
  {
    num: "STEP 3",
    title: "Explore the tools",
    desc: "Upload materials, chat with AI, quiz yourself, generate study plans & explore campus events.",
    subs: [
      "Upload lecture notes & course materials",
      "Ask the smart AI chatbot questions",
      "Practice with flashcards & past year quizzes",
      "Schedule classes & track MyCSD points",
    ],
  },
  {
    num: "STEP 4",
    title: "Start studying smarter",
    desc: "Everything in one place. No tab switching, no lost notes.",
    subs: [
      "Your campus subject dashboard is ready",
      "Track event registrations & MyCSD milestones",
      "Access student marketplace & transit updates",
    ],
  },
];

var STAGE_DURATION = 6500;

type WelcomeOverlayProps = {
  onSkip?: () => void;
};

export function WelcomeOverlay(props: WelcomeOverlayProps) {
  var onSkip = props.onSkip;

  var [currentStage, setCurrentStage] = useState<number>(0);
  var [typedSubs, setTypedSubs] = useState<string[]>([]);
  var [activeSubIdx, setActiveSubIdx] = useState<number>(-1);
  var [typedEmail, setTypedEmail] = useState<string>("");
  var [isBtnPressed, setIsBtnPressed] = useState<boolean>(false);
  var [isPlaying, setIsPlaying] = useState<boolean>(true);

  // Stage 2 phone state
  var [showNotification, setShowNotification] = useState<boolean>(false);
  var [isTapActive, setIsTapActive] = useState<boolean>(false);
  var [isEmailVerified, setIsEmailVerified] = useState<boolean>(false);

  var targetEmail = "faiq@student.usm.my";

  // Stage transition & loop
  useEffect(function() {
    var isCancelled = false;
    var timeouts: NodeJS.Timeout[] = [];

    function delay(fn: () => void, ms: number) {
      var t = setTimeout(function() {
        if (!isCancelled) fn();
      }, ms);
      timeouts.push(t);
    }

    var data = STAGE_DATA[currentStage];
    setTypedSubs(data.subs.map(function() { return ""; }));
    setActiveSubIdx(-1);
    setTypedEmail("");
    setIsBtnPressed(false);
    setShowNotification(false);
    setIsTapActive(false);
    setIsEmailVerified(false);

    // 1. Typewriter animation for bullet points, line by line
    var subIdx = 0;
    var charIdx = 0;

    function typeNextChar() {
      if (subIdx < data.subs.length) {
        setActiveSubIdx(subIdx);
        var targetText = data.subs[subIdx];
        if (charIdx <= targetText.length) {
          var currentTextSlice = targetText.slice(0, charIdx);
          setTypedSubs(function(prev) {
            var nextArr = prev.slice();
            nextArr[subIdx] = currentTextSlice;
            return nextArr;
          });
          charIdx++;
          delay(typeNextChar, 30);
        } else {
          // Move to next bullet line
          subIdx++;
          charIdx = 0;
          delay(typeNextChar, 220);
        }
      } else {
        setActiveSubIdx(-1);
      }
    }

    delay(typeNextChar, 250);

    // 2. Stage-specific visual actions
    if (currentStage === 0) {
      // Type email in auth input
      delay(function() {
        var emailIdx = 0;
        function typeEmailStep() {
          if (emailIdx <= targetEmail.length) {
            setTypedEmail(targetEmail.slice(0, emailIdx));
            emailIdx++;
            delay(typeEmailStep, 60);
          } else {
            // Button press
            delay(function() {
              setIsBtnPressed(true);
              delay(function() {
                setIsBtnPressed(false);
              }, 350);
            }, 650);
          }
        }
        typeEmailStep();
      }, 500);
    }

    if (currentStage === 1) {
      // Mobile Push Notification & Email Link Verification animation
      delay(function() {
        setShowNotification(true);

        delay(function() {
          setIsTapActive(true);

          delay(function() {
            setIsEmailVerified(true);
          }, 1000);
        }, 1200);
      }, 600);
    }

    // 3. Auto-advance continuous loop timer
    if (isPlaying) {
      delay(function() {
        setCurrentStage(function(prev) {
          return (prev + 1) % STAGE_DATA.length;
        });
      }, STAGE_DURATION);
    }

    return function cleanup() {
      isCancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, [currentStage, isPlaying]);

  function handleReplay() {
    setCurrentStage(0);
  }

  var currentData = STAGE_DATA[currentStage];

  return (
    <div className="welcome-demo-overlay">
      {/* Ambient Floating Blobs */}
      <div className="bg-blob bg-blob1" />
      <div className="bg-blob bg-blob2" />

      {/* Top Header Controls */}
      <div className="overlay-header-bar">
        <div className="header-brand">
          <img src="/logo-crest.webp" alt="USM Crest" className="overlay-crest" />
          <strong>StudentHub USM</strong>
        </div>

        <div className="header-controls">
          <Link href="/signin" className="overlay-ctrl-btn primary-signin">
            <Icon name="ti-login" />
            <span>Sign in</span>
          </Link>
          {onSkip && (
            <button className="overlay-ctrl-btn primary-skip" onClick={onSkip} type="button">
              <span>Skip to Dashboard</span>
              <Icon name="ti-arrow-right" />
            </button>
          )}
        </div>
      </div>

      <div className="welcome-page-wrap">
        {/* 2-Column Hero Container */}
        <div className="demo-hero-container">
          {/* LEFT COLUMN: NARRATION */}
          <div className="narration-col">
            <div className="step-number-badge">{currentData.num}</div>
            <h1 className="step-title-text">{currentData.title}</h1>

            <div className="sub-steps-list">
              {currentData.subs.map(function(fullText, idx) {
                var typedText = typedSubs[idx] !== undefined ? typedSubs[idx] : "";
                var isStarted = idx <= activeSubIdx || (activeSubIdx === -1 && typedText.length > 0);
                var isCurrentlyTyping = activeSubIdx === idx;
                return (
                  <div className={"sub-step-row " + (isStarted ? "show" : "")} key={fullText}>
                    <span className="num-circle">{idx + 1}</span>
                    <span className="txt-content">
                      {typedText}
                      {isCurrentlyTyping && <span className="auth-cursor" />}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN: VISUAL STAGE DEMOS */}
          <div className="visual-col">
            {/* Stage 0: Auth Card */}
            <div className={"demo-stage-box " + (currentStage === 0 ? "active" : "")}>
              <div className="visual-stage-label">Sign up form</div>
              <div className="welcome-auth-card">
                <div className="auth-tabs">
                  <div className="auth-tab">Sign in</div>
                  <div className="auth-tab active">Sign up</div>
                </div>

                <div className="auth-form-group">
                  <label>Email</label>
                  <div className={"auth-input-mock " + (typedEmail ? "highlight" : "")}>
                    <span>{typedEmail}</span>
                    {!typedEmail && <span className="placeholder-text">faiq@student.usm.my</span>}
                  </div>
                </div>

                <div className="auth-form-group">
                  <label>Password</label>
                  <div className="auth-input-mock">
                    <span className="dots-text">{typedEmail ? "••••••••" : ""}</span>
                    {!typedEmail && <span className="placeholder-text">••••••••</span>}
                  </div>
                </div>

                <button
                  className={"welcome-auth-btn " + (isBtnPressed ? "press" : "")}
                  type="button"
                >
                  <span>Create Account</span>
                </button>
              </div>
            </div>

            {/* Stage 1: Mobile Phone Push Notification & Email Link Verification */}
            <div className={"demo-stage-box " + (currentStage === 1 ? "active" : "")}>
              <div className="visual-stage-label">Your inbox & verification</div>
              <div className="phone-mockup-frame">
                <div className="phone-notch" />
                <div className="phone-screen">
                  <div className="phone-status-bar">
                    <span>09:41</span>
                    <div className="status-icons">
                      <Icon name="ti-wifi" />
                      <Icon name="ti-battery-4" />
                    </div>
                  </div>

                  {!isTapActive ? (
                    <div className="phone-lockscreen">
                      <div className="phone-clock">
                        <h2>09:41</h2>
                        <p>Friday, August 7</p>
                      </div>

                      {/* Push Notification Banner */}
                      <div className={"phone-push-notification " + (showNotification ? "swoop-in" : "")}>
                        <div className="push-head">
                          <img src="/logo-crest.webp" alt="USM Crest" className="push-app-icon" />
                          <strong>StudentHub USM</strong>
                          <span>now</span>
                        </div>
                        <div className="push-body">
                          <strong>Confirm your email address</strong>
                          <p>Welcome to USM! Tap to verify your account faiq@student.usm.my</p>
                        </div>
                        {showNotification && !isTapActive && (
                          <div className="animated-tap-hand">
                            <Icon name="ti-pointer" />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="phone-mail-app">
                      <div className="mail-header">
                        <Icon name="ti-arrow-left" />
                        <span>USM Inbox</span>
                        <Icon name="ti-dots-vertical" />
                      </div>

                      <div className="mail-card-content">
                        <div className="sender-pill">
                          <div className="usm-circle">USM</div>
                          <div>
                            <strong>StudentHub Authentication</strong>
                            <p>To: faiq@student.usm.my</p>
                          </div>
                        </div>

                        <div className="mail-body-text">
                          <p>Hi Faiq,</p>
                          <p>Click the link below to confirm your USM student account and unlock your workspace.</p>
                        </div>

                        <div className="mail-cta-wrapper">
                          <div className={"phone-confirm-btn " + (isEmailVerified ? "verified" : "")}>
                            {isEmailVerified ? (
                              <>
                                <Icon name="ti-circle-check-filled" />
                                <span>Account Verified!</span>
                              </>
                            ) : (
                              <>
                                <Icon name="ti-sparkles" />
                                <span>Confirm Email Address</span>
                              </>
                            )}
                          </div>
                        </div>

                        {isEmailVerified && (
                          <div className="phone-success-toast">
                            <Icon name="ti-circle-check" />
                            <span>Verification Successful! Access Granted.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stage 2: Feature Tools Grid */}
            <div className={"demo-stage-box " + (currentStage === 2 ? "active" : "")}>
              <div className="visual-stage-label">Study tools & Campus hub</div>
              <div className="welcome-features-grid">
                <div className="welcome-feature-card">
                  <span className="fi-icon"><Icon name="ti-file-text" /></span>
                  <h3>Materials</h3>
                  <p>Upload & index lecture slides</p>
                </div>
                <div className="welcome-feature-card">
                  <span className="fi-icon"><Icon name="ti-messages" /></span>
                  <h3>AI Chat</h3>
                  <p>Chat with your materials</p>
                </div>
                <div className="welcome-feature-card">
                  <span className="fi-icon"><Icon name="ti-cards" /></span>
                  <h3>Flashcards</h3>
                  <p>Review decks & memory recall</p>
                </div>
                <div className="welcome-feature-card">
                  <span className="fi-icon"><Icon name="ti-help-circle" /></span>
                  <h3>Quizzes</h3>
                  <p>Practice tests & exam prep</p>
                </div>
                <div className="welcome-feature-card">
                  <span className="fi-icon"><Icon name="ti-books" /></span>
                  <h3>Past Papers</h3>
                  <p>Past year papers archive</p>
                </div>
                <div className="welcome-feature-card">
                  <span className="fi-icon"><Icon name="ti-calendar" /></span>
                  <h3>Planner</h3>
                  <p>Plan weekly schedule</p>
                </div>
                <div className="welcome-feature-card">
                  <span className="fi-icon"><Icon name="ti-trophy" /></span>
                  <h3>MyCSD</h3>
                  <p>Event tracking & point rewards</p>
                </div>
                <div className="welcome-feature-card">
                  <span className="fi-icon"><Icon name="ti-shopping-bag" /></span>
                  <h3>Marketplace</h3>
                  <p>Books, ride sharing & transit</p>
                </div>
                <div className="welcome-feature-card">
                  <span className="fi-icon"><Icon name="ti-droplet" /></span>
                  <h3>Water Station</h3>
                  <p>Find nearest water station</p>
                </div>
              </div>
            </div>

            {/* Stage 3: REAL Live Mini-Dashboard UI */}
            <div className={"demo-stage-box " + (currentStage === 3 ? "active" : "")}>
              <div className="visual-stage-label">Your live dashboard</div>
              <div className="rich-dashboard-preview">
                {/* Header Bar */}
                <div className="dash-preview-topbar">
                  <div className="dash-brand">
                    <img src="/logo-crest.webp" alt="USM Crest" className="dash-logo" />
                    <strong>StudentHub USM</strong>
                  </div>
                  <div className="user-greeting-pill">
                    <span className="user-avatar">F</span>
                    <span>Good morning, Faiq</span>
                  </div>
                </div>

                {/* Metrics Pill Grid */}
                <div className="dash-metrics-row">
                  <div className="metric-pill brand-pill">
                    <Icon name="ti-trophy" />
                    <div>
                      <strong>340 Pts</strong>
                      <span>MyCSD</span>
                    </div>
                  </div>
                  <div className="metric-pill success-pill">
                    <Icon name="ti-confetti" />
                    <div>
                      <strong>3 Events</strong>
                      <span>Attended</span>
                    </div>
                  </div>
                  <div className="metric-pill warning-pill">
                    <Icon name="ti-school" />
                    <div>
                      <strong>4 Courses</strong>
                      <span>Active</span>
                    </div>
                  </div>
                </div>

                {/* Main Schedule & Assignment Grid */}
                <div className="dash-widgets-grid">
                  {/* Today Timetable */}
                  <div className="widget-card">
                    <div className="widget-head">
                      <strong>Today Schedule</strong>
                      <span className="widget-badge active">Friday</span>
                    </div>
                    <div className="schedule-row active">
                      <span className="time-col">09:00 AM</span>
                      <div className="info-col">
                        <strong>CAT201 Data Structures</strong>
                        <span>DKG 31 • Dr. Farhan</span>
                      </div>
                      <span className="status-tag active">In Progress</span>
                    </div>
                    <div className="schedule-row">
                      <span className="time-col">02:00 PM</span>
                      <div className="info-col">
                        <strong>CMT322 Web Engineering</strong>
                        <span>Lab 4 • Prof. Aisyah</span>
                      </div>
                      <span className="status-tag upcoming">Upcoming</span>
                    </div>
                  </div>

                  {/* Assignment Checklist */}
                  <div className="widget-card">
                    <div className="widget-head">
                      <strong>Deadlines</strong>
                      <Icon name="ti-bell" />
                    </div>
                    <div className="task-row checked">
                      <Icon name="ti-checkbox" />
                      <span>CAT201 Assignment 2</span>
                      <span className="done-badge">Done</span>
                    </div>
                    <div className="task-row pending">
                      <Icon name="ti-square" />
                      <span>CMT322 Milestone Slides</span>
                      <span className="urgent-badge">Due Today</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Pulsing CTA */}
        <div className={"welcome-bottom-cta " + (currentStage === 3 ? "visible" : "")}>
          <Link href="/register" className="cta-link-btn">
            <span>Get started free →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
