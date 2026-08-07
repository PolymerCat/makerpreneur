"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  type Variants,
} from "framer-motion";
import { Icon } from "@/components/ui/Icon";

/* ── Shared constants ── */

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

type WelcomeOverlayProps = {
  onSkip?: () => void;
};

type WelcomeState = {
  currentStage: number;
  typedSubs: string[];
  activeSubIdx: number;
  typedEmail: string;
  typedPassword: string;
  isBtnPressed: boolean;
  accountCreated: boolean;
  activeFeature: number;
  taskChecked: boolean;
  showNotification: boolean;
  isTapActive: boolean;
  isEmailVerified: boolean;
  typedTitle: string;
  isTitleTyping: boolean;
  mycsdPts: number;
  eventsCount: number;
  coursesCount: number;
  goToStage: (idx: number) => void;
};

/* ── useIsMobile ── */

function useIsMobile() {
  var [isMobile, setIsMobile] = useState(function() {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 768px)").matches;
  });
  useEffect(function() {
    var mq = window.matchMedia("(max-width: 768px)");
    function onChange(e: MediaQueryListEvent) { setIsMobile(e.matches); }
    mq.addEventListener("change", onChange);
    return function() { mq.removeEventListener("change", onChange); };
  }, []);
  return isMobile;
}

/* ── useCountUp (setInterval, works everywhere) ── */

function useCountUp(target: number, active: boolean, delay: number) {
  var [val, setVal] = useState(0);
  useEffect(function() {
    if (!active) { setVal(0); return; }
    var startTime = Date.now() + delay;
    var duration = 1300;
    var iv = setInterval(function() {
      var elapsed = Date.now() - startTime;
      if (elapsed < 0) return;
      var progress = Math.min(elapsed / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(eased * target));
      if (progress >= 1) clearInterval(iv);
    }, 30);
    return function() { clearInterval(iv); };
  }, [active, target, delay]);
  return val;
}

/* ── Shared stage logic hook ── */

function useWelcomeState() {
  var [currentStage, setCurrentStage] = useState<number>(0);
  var [typedSubs, setTypedSubs] = useState<string[]>([]);
  var [activeSubIdx, setActiveSubIdx] = useState<number>(-1);
  var [typedEmail, setTypedEmail] = useState<string>("");
  var [typedPassword, setTypedPassword] = useState<string>("");
  var [isBtnPressed, setIsBtnPressed] = useState<boolean>(false);
  var [accountCreated, setAccountCreated] = useState<boolean>(false);
  var [activeFeature, setActiveFeature] = useState<number>(-1);
  var [taskChecked, setTaskChecked] = useState<boolean>(false);

  var [showNotification, setShowNotification] = useState<boolean>(false);
  var [isTapActive, setIsTapActive] = useState<boolean>(false);
  var [isEmailVerified, setIsEmailVerified] = useState<boolean>(false);

  var [typedTitle, setTypedTitle] = useState<string>("");
  var [isTitleTyping, setIsTitleTyping] = useState<boolean>(false);

  var targetEmail = "faiq@student.usm.my";

  var mycsdPts = useCountUp(340, currentStage === 3, 0.4);
  var eventsCount = useCountUp(3, currentStage === 3, 0.55);
  var coursesCount = useCountUp(4, currentStage === 3, 0.7);

  // Keyboard ArrowLeft / ArrowRight stage navigation
  useEffect(function() {
    function handleKeyDown(e: KeyboardEvent) {
      var tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentStage(function(prev) { return (prev - 1 + STAGE_DATA.length) % STAGE_DATA.length; });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentStage(function(prev) { return (prev + 1) % STAGE_DATA.length; });
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return function() { window.removeEventListener("keydown", handleKeyDown); };
  }, []);

  // Feature spotlight cycling (stage 2)
  useEffect(function() {
    if (currentStage !== 2) { setActiveFeature(-1); return; }
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
      var t = setTimeout(function() { if (!isCancelled) fn(); }, ms);
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

    // Typewriter effect for Title (Mobile)
    var targetTitle = data.title;
    setTypedTitle("");
    setIsTitleTyping(true);
    var titleIdx = 0;

    function typeTitleChar() {
      if (titleIdx <= targetTitle.length) {
        setTypedTitle(targetTitle.slice(0, titleIdx));
        titleIdx++;
        delay(typeTitleChar, 45);
      } else {
        setIsTitleTyping(false);
      }
    }
    typeTitleChar();

    var subIdx = 0;
    var charIdx = 0;

    function typeNextChar() {
      if (subIdx < data.subs.length) {
        setActiveSubIdx(subIdx);
        var targetText = data.subs[subIdx];
        if (charIdx <= targetText.length) {
          var textSlice = targetText.slice(0, charIdx);
          setTypedSubs(function(prev) {
            var nextArr = prev.slice();
            nextArr[subIdx] = textSlice;
            return nextArr;
          });
          charIdx++;
          delay(typeNextChar, 30);
        } else {
          subIdx++;
          charIdx = 0;
          delay(typeNextChar, 220);
        }
      } else {
        setActiveSubIdx(-1);
      }
    }
    delay(typeNextChar, 250);

    if (currentStage === 0) {
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
      delay(function() {
        setShowNotification(true);
        delay(function() {
          setIsTapActive(true);
          delay(function() { setIsEmailVerified(true); }, 1000);
        }, 1200);
      }, 600);
    }

    if (currentStage === 3) {
      delay(function() { setTaskChecked(true); }, 2900);
    }

    delay(function() {
      setCurrentStage(function(prev) { return (prev + 1) % STAGE_DATA.length; });
    }, STAGE_DURATION);

    return function cleanup() {
      isCancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, [currentStage]);

  return {
    currentStage, typedSubs, activeSubIdx, typedEmail, typedPassword,
    isBtnPressed, accountCreated, activeFeature, taskChecked,
    showNotification, isTapActive, isEmailVerified,
    typedTitle, isTitleTyping,
    mycsdPts, eventsCount, coursesCount,
    goToStage: function(idx: number) { if (idx !== currentStage) setCurrentStage(idx); },
  };
}

/* ── Desktop overlay (framer-motion) ── */

function DesktopConfetti() {
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

function DesktopOverlay(props: { state: WelcomeState; onSkip?: () => void }) {
  var s = props.state;
  var onSkip = props.onSkip;

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

  var currentData = STAGE_DATA[s.currentStage];

  // Keyboard navigation
  useEffect(function() {
    function onKey(e: KeyboardEvent) {
      var tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") { s.goToStage((s.currentStage + 1) % STAGE_DATA.length); }
      else if (e.key === "ArrowLeft") { s.goToStage((s.currentStage - 1 + STAGE_DATA.length) % STAGE_DATA.length); }
    }
    window.addEventListener("keydown", onKey);
    return function() { window.removeEventListener("keydown", onKey); };
  }, [s.currentStage]);

  return (
    <div
      className="welcome-demo-overlay"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="bg-blob bg-blob1" />
      <div className="bg-blob bg-blob2" />

      <div className="overlay-header-bar">
        <div className="header-brand">
          <img src="/logo-crest.webp" alt="USM Crest" className="overlay-crest" />
          <strong>StudentHub USM</strong>
        </div>
        <div className="header-controls">
          <Link href="/signin" className="overlay-ctrl-btn primary-signin">
            <Icon name="ti-login" /><span>Sign in</span>
          </Link>
          {onSkip && (
            <button className="overlay-ctrl-btn primary-skip" onClick={onSkip} type="button">
              <span>Skip to Dashboard</span><Icon name="ti-arrow-right" />
            </button>
          )}
        </div>
      </div>

      <div className="welcome-page-wrap">

        <div className="demo-hero-container">
          <div className="narration-col">
            <AnimatePresence mode="wait">
              <motion.div key={s.currentStage}
                initial={{ opacity: 0, x: -32 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 32 }} transition={{ duration: 0.32, ease: EASE }}
              >
                <h1 className="step-title-text">{currentData.title}</h1>
                <div className="sub-steps-list">
                  {currentData.subs.map(function(fullText, idx) {
                    var typedText = s.typedSubs[idx] !== undefined ? s.typedSubs[idx] : "";
                    var isStarted = idx <= s.activeSubIdx || (s.activeSubIdx === -1 && typedText.length > 0);
                    var isCurrentlyTyping = s.activeSubIdx === idx;
                    return (
                      <div className={"sub-step-row " + (isStarted ? "show" : "")} key={fullText}>
                        <span className="num-circle">{idx + 1}</span>
                        <span className="txt-content">
                          {typedText}{isCurrentlyTyping && <span className="auth-cursor" />}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="visual-col" style={{ perspective: 1200 }}>
            <motion.div className="visual-parallax"
              style={{ rotateX, rotateY, transformStyle: "preserve-3d", width: "100%", height: "100%", minHeight: 380, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <AnimatePresence mode="sync" initial={false}>
                <motion.div key={s.currentStage} className="demo-stage-box"
                  style={{ pointerEvents: "auto", transformStyle: "preserve-3d" }}
                  initial={{ opacity: 0, y: 44, scale: 0.94, rotate: 1.5, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, scale: 1, rotate: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -36, scale: 0.95, rotate: -1.5, filter: "blur(6px)" }}
                  transition={{ duration: 0.5, ease: EASE }}
                >
                  <DesktopStageContent s={s} />
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>
        </div>

        <div className="welcome-controls">
          <div className="stage-dots-nav">
            {STAGE_DATA.map(function(st, i) {
              return (
                <motion.button key={st.num} type="button"
                  className={"dot-item " + (i === s.currentStage ? "active" : "")}
                  onClick={function() { s.goToStage(i); }}
                  whileHover={{ scale: 1.4 }} whileTap={{ scale: 0.85 }}
                  aria-label={"Go to " + st.title}
                />
              );
            })}
          </div>
        </div>

        <motion.div className="welcome-bottom-cta" initial={false}
          animate={s.currentStage === 3
            ? { opacity: 1, y: 0, scale: 1, pointerEvents: "auto" }
            : { opacity: 0, y: 14, scale: 0.92, pointerEvents: "none" }}
          transition={{ type: "spring", stiffness: 200, damping: 16 }}
        >
          <Link href="/register" className="cta-link-btn"><span>Get started free &rarr;</span></Link>
        </motion.div>
      </div>
    </div>
  );
}

/* Desktop stage content (conditional on currentStage) */

function DesktopStageContent(props: { s: WelcomeState }) {
  var s = props.s;
  var targetEmail = "faiq@student.usm.my";

  if (s.currentStage === 0) return (
    <>
      <div className="visual-stage-label">Sign up form</div>
      <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        style={{ transform: "translateZ(40px)", width: "100%", display: "flex", justifyContent: "center" }}>
        <motion.div className="welcome-auth-card"
          animate={s.accountCreated ? { rotate: [0, -1.5, 1.5, -0.5, 0], scale: [1, 1.03, 1] } : {}}
          transition={{ duration: 0.5 }}
        >
          <div className="auth-tabs"><div className="auth-tab">Sign in</div><div className="auth-tab active">Sign up</div></div>
          <div className="auth-form-group">
            <label>Email</label>
            <div className={"auth-input-mock " + (s.typedEmail ? "highlight" : "")}>
              <span>{s.typedEmail}</span>
              {!s.typedEmail && <span className="placeholder-text">faiq@student.usm.my</span>}
              {s.typedEmail && s.typedEmail.length < targetEmail.length && <span className="auth-cursor" />}
            </div>
          </div>
          <div className="auth-form-group">
            <label>Password</label>
            <div className={"auth-input-mock " + (s.typedPassword ? "highlight" : "")}>
              <span className="dots-text">{s.typedPassword}</span>
              {!s.typedPassword && <span className="placeholder-text">••••••••</span>}
              {s.typedPassword && s.typedPassword.length < 8 && <span className="auth-cursor" />}
            </div>
          </div>
          <motion.button
            className={"welcome-auth-btn " + (s.isBtnPressed ? "press " : "") + (s.accountCreated ? "auth-btn-success" : "")}
            type="button"
            whileHover={s.accountCreated ? {} : { scale: 1.03, y: -1 }}
            whileTap={s.accountCreated ? {} : { scale: 0.96 }}
          >
            {s.accountCreated ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Icon name="ti-circle-check-filled" />Account Created!
              </span>
            ) : <span>Create Account</span>}
          </motion.button>
        </motion.div>
      </motion.div>
    </>
  );

  if (s.currentStage === 1) return (
    <>
      <div className="visual-stage-label">Your inbox & verification</div>
      <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3.4, ease: "easeInOut" }}
        style={{ transform: "translateZ(40px)" }}>
        <div className="phone-mockup-frame">
          <div className="phone-notch" />
          <div className="phone-screen">
            <div className="phone-status-bar"><span>09:41</span><div className="status-icons"><Icon name="ti-wifi" /><Icon name="ti-battery-4" /></div></div>
            {!s.isTapActive ? (
              <div className="phone-lockscreen">
                <div className="phone-clock"><h2>09:41</h2><p>Friday, August 7</p></div>
                <motion.div animate={s.showNotification && !s.isTapActive ? { rotate: [0, -1.6, 1.6, -1, 0.5, 0] } : { rotate: 0 }}
                  transition={{ delay: 0.55, duration: 0.6 }}>
                  <div className={"phone-push-notification " + (s.showNotification ? "swoop-in" : "")}>
                    <div className="push-head">
                      <img src="/logo-crest.webp" alt="USM Crest" className="push-app-icon" />
                      <strong>StudentHub USM</strong><span>now</span>
                    </div>
                    <div className="push-body">
                      <strong>Confirm your email address</strong>
                      <p>Welcome to USM! Tap to verify your account faiq@student.usm.my</p>
                    </div>
                    {s.showNotification && !s.isTapActive && (
                      <div className="animated-tap-hand"><Icon name="ti-pointer" /></div>
                    )}
                  </div>
                </motion.div>
                <motion.div className="phone-swipe-hint"
                  animate={{ y: [0, -4, 0], opacity: [0.3, 0.65, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }} />
              </div>
            ) : (
              <div className="phone-mail-app">
                <div className="mail-header"><Icon name="ti-arrow-left" /><span>USM Inbox</span><Icon name="ti-dots-vertical" /></div>
                <div className="mail-card-content">
                  <div className="sender-pill">
                    <div className="usm-circle">USM</div>
                    <div><strong>StudentHub Authentication</strong><p>To: faiq@student.usm.my</p></div>
                  </div>
                  <div className="mail-body-text">
                    <p>Hi Faiq,</p><p>Click the link below to confirm your USM student account and unlock your workspace.</p>
                  </div>
                  <div className="mail-cta-wrapper">
                    <motion.div className={"phone-confirm-btn " + (s.isEmailVerified ? "verified" : "")}
                      animate={!s.isEmailVerified ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                      transition={!s.isEmailVerified ? { repeat: Infinity, duration: 1.4 } : { type: "spring", stiffness: 300, damping: 14 }}
                    >
                      {s.isEmailVerified ? (
                        <><Icon name="ti-circle-check-filled" /><span>Account Verified!</span></>
                      ) : (
                        <><Icon name="ti-sparkles" /><span>Confirm Email Address</span></>
                      )}
                    </motion.div>
                  </div>
                  {s.isEmailVerified && (
                    <motion.div className="phone-success-toast"
                      initial={{ opacity: 0, y: 14, scale: 0.85 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 320, damping: 18 }}
                    >
                      <Icon name="ti-circle-check" /><span>Verification Successful! Access Granted.</span>
                    </motion.div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );

  if (s.currentStage === 2) return (
    <>
      <div className="visual-stage-label">Study tools & Campus hub</div>
      <div className="welcome-features-grid" style={{ transform: "translateZ(30px)" }}>
        {FEATURES.map(function(f, i) {
          var isSpot = i === s.activeFeature;
          return (
            <motion.div key={f.label}
              className={"welcome-feature-card " + (isSpot ? "spot" : "")}
              custom={i} variants={featureVariants} initial="hidden" animate="show"
              whileHover={{ scale: 1.08, rotate: -2, y: -4 }} whileTap={{ scale: 0.94 }}
            >
              <motion.span className="fi-icon"
                animate={{ y: [0, -3, 0] }}
                transition={{ repeat: Infinity, duration: 2.2, delay: i * 0.18, ease: "easeInOut" }}>
                <Icon name={f.icon} />
              </motion.span>
              <h3>{f.label}</h3><p>{f.desc}</p>
            </motion.div>
          );
        })}
      </div>
    </>
  );

  // Stage 3
  return (
    <>
      <div className="visual-stage-label">Your live dashboard</div>
      <motion.div className="rich-dashboard-preview"
        style={{ transform: "translateZ(40px)", position: "relative" }}
        animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 3.6, ease: "easeInOut" }}
      >
        <DesktopConfetti />
        <div className="dash-preview-topbar">
          <div className="dash-brand"><img src="/logo-crest.webp" alt="USM Crest" className="dash-logo" /><strong>StudentHub USM</strong></div>
          <div className="user-greeting-pill"><span className="user-avatar">F</span><span>Good morning, Faiq</span></div>
        </div>
        <div className="dash-metrics-row">
          <div className="metric-pill brand-pill"><Icon name="ti-trophy" /><div><strong>{s.mycsdPts} Pts</strong><span>MyCSD</span></div></div>
          <div className="metric-pill success-pill"><Icon name="ti-confetti" /><div><strong>{s.eventsCount} Events</strong><span>Attended</span></div></div>
          <div className="metric-pill warning-pill"><Icon name="ti-school" /><div><strong>{s.coursesCount} Courses</strong><span>Active</span></div></div>
        </div>
        <div className="dash-widgets-grid">
          <div className="widget-card">
            <div className="widget-head"><strong>Today Schedule</strong><span className="widget-badge active">Friday</span></div>
            <div className="schedule-row active">
              <span className="time-col">09:00 AM</span>
              <div className="info-col"><strong>CAT201 Data Structures</strong><span>DKG 31 • Dr. Farhan</span></div>
              <motion.span className="status-tag active"
                animate={{ scale: [1, 1.1, 1], opacity: [1, 0.7, 1] }}
                transition={{ repeat: Infinity, duration: 1.6 }}>In Progress</motion.span>
            </div>
            <div className="schedule-row">
              <span className="time-col">02:00 PM</span>
              <div className="info-col"><strong>CMT322 Web Engineering</strong><span>Lab 4 • Prof. Aisyah</span></div>
              <span className="status-tag upcoming">Upcoming</span>
            </div>
          </div>
          <div className="widget-card">
            <div className="widget-head"><strong>Deadlines</strong><Icon name="ti-bell" /></div>
            <div className="task-row checked"><Icon name="ti-checkbox" /><span>CAT201 Assignment 2</span><span className="done-badge">Done</span></div>
            <div className={"task-row " + (s.taskChecked ? "checked" : "pending")}>
              <motion.span key={s.taskChecked ? "checked" : "pending"}
                initial={{ scale: 0.4, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }} style={{ display: "inline-flex" }}>
                <Icon name={s.taskChecked ? "ti-checkbox" : "ti-square"} />
              </motion.span>
              <span>CMT322 Milestone Slides</span>
              <span className={s.taskChecked ? "done-badge" : "urgent-badge"}>{s.taskChecked ? "Done" : "Due Today"}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ── Mobile overlay (pure CSS, no framer) ── */

function MobileConfetti() {
  var pieces = [];
  for (var i = 0; i < 10; i++) {
    var angle = (i / 10) * Math.PI * 2;
    var dist = 70 + i * 8;
    var tx = Math.cos(angle) * dist;
    var ty = Math.sin(angle) * dist + 30;
    var rot = (i % 2 === 0 ? 1 : -1) * (120 + i * 30);
    pieces.push(
      <span key={i} className="confetti-piece-mobile"
        style={{ background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          "--tx": tx + "px", "--ty": ty + "px", "--tr": rot + "deg",
          animationDelay: (1.5 + i * 0.05) + "s",
        } as React.CSSProperties} />
    );
  }
  return <div className="confetti-origin-mobile">{pieces}</div>;
}

function MobileOverlay(props: { state: WelcomeState; onSkip?: () => void }) {
  var s = props.state;
  var onSkip = props.onSkip;
  var targetEmail = "faiq@student.usm.my";
  var currentData = STAGE_DATA[s.currentStage];

  // Swipe handlers
  var [touchStartX, setTouchStartX] = useState(0);

  function handleTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.touches[0].clientX);
  }

  function handleTouchEnd(e: React.TouchEvent) {
    var delta = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) < 50) return;
    if (delta < -50) {
      s.goToStage((s.currentStage + 1) % STAGE_DATA.length);
    } else {
      s.goToStage((s.currentStage - 1 + STAGE_DATA.length) % STAGE_DATA.length);
    }
  }

  // Keyboard on mobile too (bluetooth keyboards, etc.)
  useEffect(function() {
    function onKey(e: KeyboardEvent) {
      var tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") s.goToStage((s.currentStage + 1) % STAGE_DATA.length);
      else if (e.key === "ArrowLeft") s.goToStage((s.currentStage - 1 + STAGE_DATA.length) % STAGE_DATA.length);
    }
    window.addEventListener("keydown", onKey);
    return function() { window.removeEventListener("keydown", onKey); };
  }, [s.currentStage]);

  return (
    <div className="welcome-demo-overlay welcome-mobile"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="bg-blob bg-blob1" />
      <div className="bg-blob bg-blob2" />

      <div className="overlay-header-bar">
        <div className="header-brand">
          <img src="/logo-crest.webp" alt="USM Crest" className="overlay-crest" />
          <strong>StudentHub USM</strong>
        </div>
        <div className="header-controls">
          <Link href="/signin" className="overlay-ctrl-btn primary-signin">
            <Icon name="ti-login" /><span>Sign in</span>
          </Link>
          {onSkip && (
            <button className="overlay-ctrl-btn primary-skip" onClick={onSkip} type="button">
              <span>Skip to Dashboard</span><Icon name="ti-arrow-right" />
            </button>
          )}
        </div>
      </div>

      <div className="welcome-page-wrap">

        <div className="demo-hero-container">
          <div className="narration-col">
            <div className="narration-slide" key={s.currentStage}>
              <h1 className="step-title-text">
                {s.typedTitle}
                {s.isTitleTyping && <span className="auth-cursor" />}
              </h1>
            </div>
          </div>

          <div className="visual-col">
            {/* Stage 0 */}
            <div className={"demo-stage-box " + (s.currentStage === 0 ? "active" : "")}>
              <div className="visual-stage-label">Sign up form</div>
              <div className={"float-auth"}>
                <div className={"welcome-auth-card " + (s.accountCreated ? "wobble-trigger" : "")}>
                  <div className="auth-tabs"><div className="auth-tab">Sign in</div><div className="auth-tab active">Sign up</div></div>
                  <div className="auth-form-group">
                    <label>Email</label>
                    <div className={"auth-input-mock " + (s.typedEmail ? "highlight" : "")}>
                      <span>{s.typedEmail}</span>
                      {!s.typedEmail && <span className="placeholder-text">faiq@student.usm.my</span>}
                      {s.typedEmail && s.typedEmail.length < targetEmail.length && <span className="auth-cursor" />}
                    </div>
                  </div>
                  <div className="auth-form-group">
                    <label>Password</label>
                    <div className={"auth-input-mock " + (s.typedPassword ? "highlight" : "")}>
                      <span className="dots-text">{s.typedPassword}</span>
                      {!s.typedPassword && <span className="placeholder-text">••••••••</span>}
                      {s.typedPassword && s.typedPassword.length < 8 && <span className="auth-cursor" />}
                    </div>
                  </div>
                  <button className={"welcome-auth-btn " + (s.isBtnPressed ? "press " : "") + (s.accountCreated ? "auth-btn-success" : "")} type="button">
                    {s.accountCreated ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <Icon name="ti-circle-check-filled" />Account Created!
                      </span>
                    ) : <span>Create Account</span>}
                  </button>
                </div>
              </div>
            </div>

            {/* Stage 1 */}
            <div className={"demo-stage-box " + (s.currentStage === 1 ? "active" : "")}>
              <div className="visual-stage-label">Your inbox & verification</div>
              <div className="float-phone">
                <div className="phone-mockup-frame">
                  <div className="phone-notch" />
                  <div className="phone-screen">
                    <div className="phone-status-bar"><span>09:41</span><div className="status-icons"><Icon name="ti-wifi" /><Icon name="ti-battery-4" /></div></div>
                    {!s.isTapActive ? (
                      <div className="phone-lockscreen">
                        <div className="phone-clock"><h2>09:41</h2><p>Friday, August 7</p></div>
                        <div className={s.showNotification && !s.isTapActive ? "wiggle-trigger" : ""}>
                          <div className={"phone-push-notification " + (s.showNotification ? "swoop-in" : "")}>
                            <div className="push-head">
                              <img src="/logo-crest.webp" alt="USM Crest" className="push-app-icon" />
                              <strong>StudentHub USM</strong><span>now</span>
                            </div>
                            <div className="push-body">
                              <strong>Confirm your email address</strong>
                              <p>Welcome to USM! Tap to verify your account faiq@student.usm.my</p>
                            </div>
                            {s.showNotification && !s.isTapActive && (
                              <div className="animated-tap-hand"><Icon name="ti-pointer" /></div>
                            )}
                          </div>
                        </div>
                        <div className="phone-swipe-hint" />
                      </div>
                    ) : (
                      <div className="phone-mail-app">
                        <div className="mail-header"><Icon name="ti-arrow-left" /><span>USM Inbox</span><Icon name="ti-dots-vertical" /></div>
                        <div className="mail-card-content">
                          <div className="sender-pill">
                            <div className="usm-circle">USM</div>
                            <div><strong>StudentHub Authentication</strong><p>To: faiq@student.usm.my</p></div>
                          </div>
                          <div className="mail-body-text">
                            <p>Hi Faiq,</p><p>Click the link below to confirm your USM student account and unlock your workspace.</p>
                          </div>
                          <div className="mail-cta-wrapper">
                            <div className={"phone-confirm-btn " + (!s.isEmailVerified ? "pulse-trigger " : "") + (s.isEmailVerified ? "verified" : "")}>
                              {s.isEmailVerified ? (
                                <><Icon name="ti-circle-check-filled" /><span>Account Verified!</span></>
                              ) : (
                                <><Icon name="ti-sparkles" /><span>Confirm Email Address</span></>
                              )}
                            </div>
                          </div>
                          {s.isEmailVerified && (
                            <div className="phone-success-toast pop-in-toast">
                              <Icon name="ti-circle-check" /><span>Verification Successful! Access Granted.</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Stage 2 */}
            <div className={"demo-stage-box " + (s.currentStage === 2 ? "active" : "")}>
              <div className="visual-stage-label">Study tools & Campus hub</div>
              <div className="welcome-features-grid">
                {FEATURES.map(function(f, i) {
                  var isSpot = i === s.activeFeature;
                  return (
                    <div key={f.label} className={"welcome-feature-card " + (isSpot ? "spot" : "")}>
                      <span className="fi-icon"><Icon name={f.icon} /></span>
                      <h3>{f.label}</h3><p>{f.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stage 3 */}
            <div className={"demo-stage-box " + (s.currentStage === 3 ? "active" : "")}>
              <div className="visual-stage-label">Your live dashboard</div>
              <div className="rich-dashboard-preview float-dashboard" style={{ position: "relative" }}>
                <MobileConfetti />
                <div className="dash-preview-topbar">
                  <div className="dash-brand"><img src="/logo-crest.webp" alt="USM Crest" className="dash-logo" /><strong>StudentHub USM</strong></div>
                  <div className="user-greeting-pill"><span className="user-avatar">F</span><span>Good morning, Faiq</span></div>
                </div>
                <div className="dash-metrics-row">
                  <div className="metric-pill brand-pill"><Icon name="ti-trophy" /><div><strong>{s.mycsdPts} Pts</strong><span>MyCSD</span></div></div>
                  <div className="metric-pill success-pill"><Icon name="ti-confetti" /><div><strong>{s.eventsCount} Events</strong><span>Attended</span></div></div>
                  <div className="metric-pill warning-pill"><Icon name="ti-school" /><div><strong>{s.coursesCount} Courses</strong><span>Active</span></div></div>
                </div>
                <div className="dash-widgets-grid">
                  <div className="widget-card">
                    <div className="widget-head"><strong>Today Schedule</strong><span className="widget-badge active">Friday</span></div>
                    <div className="schedule-row active">
                      <span className="time-col">09:00 AM</span>
                      <div className="info-col"><strong>CAT201 Data Structures</strong><span>DKG 31 • Dr. Farhan</span></div>
                      <span className="status-tag active badge-pulse">In Progress</span>
                    </div>
                    <div className="schedule-row">
                      <span className="time-col">02:00 PM</span>
                      <div className="info-col"><strong>CMT322 Web Engineering</strong><span>Lab 4 • Prof. Aisyah</span></div>
                      <span className="status-tag upcoming">Upcoming</span>
                    </div>
                  </div>
                  <div className="widget-card">
                    <div className="widget-head"><strong>Deadlines</strong><Icon name="ti-bell" /></div>
                    <div className="task-row checked"><Icon name="ti-checkbox" /><span>CAT201 Assignment 2</span><span className="done-badge">Done</span></div>
                    <div className={"task-row " + (s.taskChecked ? "checked" : "pending")}>
                      <span className={s.taskChecked ? "check-pop" : ""} style={{ display: "inline-flex" }}>
                        <Icon name={s.taskChecked ? "ti-checkbox" : "ti-square"} />
                      </span>
                      <span>CMT322 Milestone Slides</span>
                      <span className={s.taskChecked ? "done-badge" : "urgent-badge"}>{s.taskChecked ? "Done" : "Due Today"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={"welcome-bottom-cta " + (s.currentStage === 3 ? "visible" : "")}>
          <Link href="/register" className="cta-link-btn"><span>Get started free &rarr;</span></Link>
        </div>
      </div>
    </div>
  );
}

/* ── Main export ── */

export function WelcomeOverlay(props: WelcomeOverlayProps) {
  var isMobile = useIsMobile();
  var state = useWelcomeState();

  if (isMobile) {
    return <MobileOverlay state={state} onSkip={props.onSkip} />;
  }
  return <DesktopOverlay state={state} onSkip={props.onSkip} />;
}
