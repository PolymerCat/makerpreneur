"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  animate,
  type Variants,
} from "framer-motion";
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

var FEATURES = [
  { icon: "ti-file-text", label: "Materials", desc: "Upload & index lecture slides" },
  { icon: "ti-messages", label: "AI Chat", desc: "Chat with your materials" },
  { icon: "ti-cards", label: "Flashcards", desc: "Review decks & memory recall" },
  { icon: "ti-help-circle", label: "Quizzes", desc: "Practice tests & exam prep" },
  { icon: "ti-books", label: "Past Papers", desc: "Past year papers archive" },
  { icon: "ti-calendar", label: "Planner", desc: "Plan weekly schedule" },
  { icon: "ti-trophy", label: "MyCSD", desc: "Event tracking & point rewards" },
  { icon: "ti-shopping-bag", label: "Marketplace", desc: "Books, ride sharing & transit" },
  { icon: "ti-droplet", label: "Water Station", desc: "Find nearest water station" },
];

var STAGE_DURATION = 6500;
var EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
var CONFETTI_COLORS = ["#6b21a8", "#2563eb", "#e11d48", "#ca8a04", "#059669", "#7c3aed"];

var featureVariants: Variants = {
  hidden: { opacity: 0, scale: 0.5, rotate: -8, y: 26 },
  show: function(i: number) {
    return {
      opacity: 1,
      scale: 1,
      rotate: 0,
      y: 0,
      transition: { delay: 0.08 * i, type: "spring", stiffness: 260, damping: 18 },
    };
  },
};

function useCountUp(target: number, active: boolean, delay: number) {
  var [val, setVal] = useState(0);
  useEffect(function() {
    if (!active) {
      setVal(0);
      return;
    }
    var controls = animate(0, target, {
      duration: 1.3,
      delay: delay,
      ease: "easeOut",
      onUpdate: function(v) { setVal(Math.round(v)); },
    });
    return function() { controls.stop(); };
  }, [active, target, delay]);
  return val;
}

function ConfettiBurst() {
  var pieces = [];
  for (var i = 0; i < 26; i++) {
    var angle = (i / 26) * Math.PI * 2;
    var dist = 90 + (i % 5) * 26;
    pieces.push(
      <motion.span
        key={i}
        className="confetti-piece"
        style={{ background: CONFETTI_COLORS[i % CONFETTI_COLORS.length] }}
        initial={{ x: 0, y: 0, opacity: 0, scale: 1, rotate: 0 }}
        animate={{
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist + 50,
          opacity: [0, 1, 1, 0],
          rotate: (i % 2 === 0 ? 1 : -1) * 220,
          scale: 0.7,
        }}
        transition={{ duration: 1.3, ease: "easeOut", delay: 1.5 + (i % 4) * 0.04 }}
      />
    );
  }
  return <div className="confetti-origin">{pieces}</div>;
}

type WelcomeOverlayProps = {
  onSkip?: () => void;
};

export function WelcomeOverlay(props: WelcomeOverlayProps) {
  var onSkip = props.onSkip;

  var [currentStage, setCurrentStage] = useState<number>(0);
  var [typedSubs, setTypedSubs] = useState<string[]>([]);
  var [activeSubIdx, setActiveSubIdx] = useState<number>(-1);
  var [typedEmail, setTypedEmail] = useState<string>("");
  var [typedPassword, setTypedPassword] = useState<string>("");
  var [isBtnPressed, setIsBtnPressed] = useState<boolean>(false);
  var [accountCreated, setAccountCreated] = useState<boolean>(false);
  var [isPlaying, setIsPlaying] = useState<boolean>(true);
  var [activeFeature, setActiveFeature] = useState<number>(-1);
  var [taskChecked, setTaskChecked] = useState<boolean>(false);

  // Stage 2 phone state
  var [showNotification, setShowNotification] = useState<boolean>(false);
  var [isTapActive, setIsTapActive] = useState<boolean>(false);
  var [isEmailVerified, setIsEmailVerified] = useState<boolean>(false);

  var targetEmail = "faiq@student.usm.my";

  // Dashboard count-up metrics (stage 3)
  var mycsdPts = useCountUp(340, currentStage === 3, 0.4);
  var eventsCount = useCountUp(3, currentStage === 3, 0.55);
  var coursesCount = useCountUp(4, currentStage === 3, 0.7);

  // Mouse parallax
  var mouseX = useMotionValue(0);
  var mouseY = useMotionValue(0);
  var springX = useSpring(mouseX, { stiffness: 50, damping: 18 });
  var springY = useSpring(mouseY, { stiffness: 50, damping: 18 });
  var rotateX = useTransform(springY, [-0.5, 0.5], [7, -7]);
  var rotateY = useTransform(springX, [-0.5, 0.5], [-9, 9]);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    var rect = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  // Keyboard navigation
  useEffect(function() {
    function onKey(e: KeyboardEvent) {
      var tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") {
        setCurrentStage(function(p) { return (p + 1) % STAGE_DATA.length; });
      } else if (e.key === "ArrowLeft") {
        setCurrentStage(function(p) { return (p - 1 + STAGE_DATA.length) % STAGE_DATA.length; });
      } else if (e.key === " " && tag !== "BUTTON" && tag !== "A") {
        e.preventDefault();
        setIsPlaying(function(p) { return !p; });
      }
    }
    window.addEventListener("keydown", onKey);
    return function() { window.removeEventListener("keydown", onKey); };
  }, []);

  // Feature spotlight cycling (stage 2)
  useEffect(function() {
    if (currentStage !== 2) {
      setActiveFeature(-1);
      return;
    }
    setActiveFeature(0);
    var iv = setInterval(function() {
      setActiveFeature(function(p) { return (p + 1) % FEATURES.length; });
    }, 1100);
    return function() { clearInterval(iv); };
  }, [currentStage]);

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
    setTypedPassword("");
    setIsBtnPressed(false);
    setAccountCreated(false);
    setTaskChecked(false);
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
      // Type email, then password dots, then press the button
      delay(function() {
        var emailIdx = 0;
        function typeEmailStep() {
          if (emailIdx <= targetEmail.length) {
            setTypedEmail(targetEmail.slice(0, emailIdx));
            emailIdx++;
            delay(typeEmailStep, 55);
          } else {
            var pwIdx = 0;
            delay(function typePwStep() {
              if (pwIdx <= 8) {
                setTypedPassword("•".repeat(pwIdx));
                pwIdx++;
                delay(typePwStep, 70);
              } else {
                delay(function() {
                  setIsBtnPressed(true);
                  delay(function() {
                    setIsBtnPressed(false);
                    setAccountCreated(true);
                  }, 350);
                }, 500);
              }
            }, 250);
          }
        }
        typeEmailStep();
      }, 450);
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

    if (currentStage === 3) {
      // Tick the pending deadline off near the end
      delay(function() {
        setTaskChecked(true);
      }, 2900);
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

  function goToStage(idx: number) {
    if (idx === currentStage) return;
    setCurrentStage(idx);
  }

  var currentData = STAGE_DATA[currentStage];

  return (
    <div
      className="welcome-demo-overlay"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
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
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStage}
                initial={{ opacity: 0, x: -32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 32 }}
                transition={{ duration: 0.32, ease: EASE }}
              >
                <div className="step-number-badge">
                  {currentData.num}
                </div>
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
              </motion.div>
            </AnimatePresence>
          </div>

          {/* RIGHT COLUMN: VISUAL STAGE DEMOS (mouse parallax wrapper) */}
          <div className="visual-col" style={{ perspective: 1200 }}>
            <motion.div
              className="visual-parallax"
              style={{
                rotateX: rotateX,
                rotateY: rotateY,
                transformStyle: "preserve-3d",
                width: "100%",
                height: "100%",
                minHeight: 380,
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AnimatePresence mode="sync" initial={false}>
                <motion.div
                  key={currentStage}
                  className="demo-stage-box"
                  style={{ pointerEvents: "auto", transformStyle: "preserve-3d" }}
                  initial={{ opacity: 0, y: 44, scale: 0.94, rotate: 1.5, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, scale: 1, rotate: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -36, scale: 0.95, rotate: -1.5, filter: "blur(6px)" }}
                  transition={{ duration: 0.5, ease: EASE }}
                >
                  {currentStage === 0 && (
                    <>
                      <div className="visual-stage-label">Sign up form</div>
                      <motion.div
                        animate={{ y: [0, -6, 0] }}
                        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                        style={{ transform: "translateZ(40px)", width: "100%", display: "flex", justifyContent: "center" }}
                      >
                        <motion.div
                          className="welcome-auth-card"
                          animate={accountCreated ? { rotate: [0, -1.5, 1.5, -0.5, 0], scale: [1, 1.03, 1] } : {}}
                          transition={{ duration: 0.5 }}
                        >
                          <div className="auth-tabs">
                            <div className="auth-tab">Sign in</div>
                            <div className="auth-tab active">Sign up</div>
                          </div>

                          <div className="auth-form-group">
                            <label>Email</label>
                            <div className={"auth-input-mock " + (typedEmail ? "highlight" : "")}>
                              <span>{typedEmail}</span>
                              {!typedEmail && <span className="placeholder-text">faiq@student.usm.my</span>}
                              {typedEmail && typedEmail.length < targetEmail.length && <span className="auth-cursor" />}
                            </div>
                          </div>

                          <div className="auth-form-group">
                            <label>Password</label>
                            <div className={"auth-input-mock " + (typedPassword ? "highlight" : "")}>
                              <span className="dots-text">{typedPassword}</span>
                              {!typedPassword && <span className="placeholder-text">••••••••</span>}
                              {typedPassword && typedPassword.length < 8 && <span className="auth-cursor" />}
                            </div>
                          </div>

                          <motion.button
                            className={"welcome-auth-btn " + (isBtnPressed ? "press " : "") + (accountCreated ? "auth-btn-success" : "")}
                            type="button"
                            whileHover={accountCreated ? {} : { scale: 1.03, y: -1 }}
                            whileTap={accountCreated ? {} : { scale: 0.96 }}
                          >
                            {accountCreated ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                <Icon name="ti-circle-check-filled" />
                                Account Created!
                              </span>
                            ) : (
                              <span>Create Account</span>
                            )}
                          </motion.button>
                        </motion.div>
                      </motion.div>
                    </>
                  )}

                  {currentStage === 1 && (
                    <>
                      <div className="visual-stage-label">Your inbox & verification</div>
                      <motion.div
                        animate={{ y: [0, -8, 0] }}
                        transition={{ repeat: Infinity, duration: 3.4, ease: "easeInOut" }}
                        style={{ transform: "translateZ(40px)" }}
                      >
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

                                {/* Push Notification Banner (wiggle wrapper keeps CSS swoop transform conflict-free) */}
                                <motion.div
                                  animate={showNotification && !isTapActive ? { rotate: [0, -1.6, 1.6, -1, 0.5, 0] } : { rotate: 0 }}
                                  transition={{ delay: 0.55, duration: 0.6 }}
                                >
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
                                </motion.div>

                                <motion.div
                                  className="phone-swipe-hint"
                                  animate={{ y: [0, -4, 0], opacity: [0.3, 0.65, 0.3] }}
                                  transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                                />
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
                                    <motion.div
                                      className={"phone-confirm-btn " + (isEmailVerified ? "verified" : "")}
                                      animate={!isEmailVerified ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                                      transition={!isEmailVerified ? { repeat: Infinity, duration: 1.4 } : { type: "spring", stiffness: 300, damping: 14 }}
                                    >
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
                                    </motion.div>
                                  </div>

                                  {isEmailVerified && (
                                    <motion.div
                                      className="phone-success-toast"
                                      initial={{ opacity: 0, y: 14, scale: 0.85 }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      transition={{ type: "spring", stiffness: 320, damping: 18 }}
                                    >
                                      <Icon name="ti-circle-check" />
                                      <span>Verification Successful! Access Granted.</span>
                                    </motion.div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    </>
                  )}

                  {currentStage === 2 && (
                    <>
                      <div className="visual-stage-label">Study tools & Campus hub</div>
                      <div className="welcome-features-grid" style={{ transform: "translateZ(30px)" }}>
                        {FEATURES.map(function(f, i) {
                          var isSpot = i === activeFeature;
                          return (
                            <motion.div
                              key={f.label}
                              className={"welcome-feature-card " + (isSpot ? "spot" : "")}
                              custom={i}
                              variants={featureVariants}
                              initial="hidden"
                              animate="show"
                              whileHover={{ scale: 1.08, rotate: -2, y: -4 }}
                              whileTap={{ scale: 0.94 }}
                            >
                              <motion.span
                                className="fi-icon"
                                animate={{ y: [0, -3, 0] }}
                                transition={{ repeat: Infinity, duration: 2.2, delay: i * 0.18, ease: "easeInOut" }}
                              >
                                <Icon name={f.icon} />
                              </motion.span>
                              <h3>{f.label}</h3>
                              <p>{f.desc}</p>
                            </motion.div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {currentStage === 3 && (
                    <>
                      <div className="visual-stage-label">Your live dashboard</div>
                      <motion.div
                        className="rich-dashboard-preview"
                        style={{ transform: "translateZ(40px)", position: "relative" }}
                        animate={{ y: [0, -5, 0] }}
                        transition={{ repeat: Infinity, duration: 3.6, ease: "easeInOut" }}
                      >
                        <ConfettiBurst />

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
                              <strong>{mycsdPts} Pts</strong>
                              <span>MyCSD</span>
                            </div>
                          </div>
                          <div className="metric-pill success-pill">
                            <Icon name="ti-confetti" />
                            <div>
                              <strong>{eventsCount} Events</strong>
                              <span>Attended</span>
                            </div>
                          </div>
                          <div className="metric-pill warning-pill">
                            <Icon name="ti-school" />
                            <div>
                              <strong>{coursesCount} Courses</strong>
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
                              <motion.span
                                className="status-tag active"
                                animate={{ scale: [1, 1.1, 1], opacity: [1, 0.7, 1] }}
                                transition={{ repeat: Infinity, duration: 1.6 }}
                              >
                                In Progress
                              </motion.span>
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
                            <div className={"task-row " + (taskChecked ? "checked" : "pending")}>
                              <motion.span
                                key={taskChecked ? "checked" : "pending"}
                                initial={{ scale: 0.4, rotate: -30 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                style={{ display: "inline-flex" }}
                              >
                                <Icon name={taskChecked ? "ti-checkbox" : "ti-square"} />
                              </motion.span>
                              <span>CMT322 Milestone Slides</span>
                              <span className={taskChecked ? "done-badge" : "urgent-badge"}>
                                {taskChecked ? "Done" : "Due Today"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>
        </div>

        {/* Controls: centered dots only */}
        <div className="welcome-controls">
          <div className="stage-dots-nav">
            {STAGE_DATA.map(function(s, i) {
              return (
                <motion.button
                  key={s.num}
                  type="button"
                  className={"dot-item " + (i === currentStage ? "active" : "")}
                  onClick={function() { goToStage(i); }}
                  whileHover={{ scale: 1.4 }}
                  whileTap={{ scale: 0.85 }}
                  aria-label={"Go to " + s.title}
                />
              );
            })}
          </div>
        </div>

        {/* Bottom Pulsing CTA */}
        <motion.div
          className="welcome-bottom-cta"
          initial={false}
          animate={currentStage === 3
            ? { opacity: 1, y: 0, scale: 1, pointerEvents: "auto" }
            : { opacity: 0, y: 14, scale: 0.92, pointerEvents: "none" }}
          transition={{ type: "spring", stiffness: 200, damping: 16 }}
        >
          <Link href="/register" className="cta-link-btn">
            <span>Get started</span>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
