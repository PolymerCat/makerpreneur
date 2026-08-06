"use client";

import React, { useState } from "react";

export type StudyBuddyState =
  | "idle"
  | "loading"
  | "thinking"
  | "typing"
  | "searching"
  | "generating"
  | "speaking";

type StudyBuddyIconProps = {
  state?: StudyBuddyState;
  size?: number;
  interactive?: boolean;
  className?: string;
  onClick?: () => void;
};

export function StudyBuddyIcon({
  state = "idle",
  size = 36,
  interactive = true,
  className = "",
  onClick,
}: StudyBuddyIconProps) {
  const [clicked, setClicked] = useState(false);

  const handleClick = () => {
    setClicked(true);
    setTimeout(() => setClicked(false), 600);
    onClick?.();
  };

  return (
    <div
      className={`study-buddy-minimal-icon ${className}`}
      onClick={interactive ? handleClick : onClick}
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: interactive ? "pointer" : "default",
        userSelect: "none",
      }}
      title={`StudyBuddy (${state})`}
    >
      <style>{`
        @keyframes sbBlink {
          0%, 88%, 100% { transform: scaleY(1); }
          94% { transform: scaleY(0.1); }
        }
        @keyframes sbFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @keyframes sbTilt {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(7deg); }
        }
        @keyframes sbScanEye {
          0%, 100% { transform: translateX(-4px); }
          50% { transform: translateX(4px); }
        }
        @keyframes sbTypeBounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-3px); opacity: 1; }
        }
        @keyframes sbOrbSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes sbPulseAura {
          0%, 100% { transform: scale(1); opacity: 0.2; }
          50% { transform: scale(1.15); opacity: 0.45; }
        }
        @keyframes sbBounceClick {
          0% { transform: scale(1); }
          30% { transform: scale(0.85) rotate(-6deg); }
          60% { transform: scale(1.18) rotate(4deg); }
          100% { transform: scale(1); }
        }
        .study-buddy-minimal-icon:hover .sb-minimal-body {
          transform: scale(1.06);
        }
      `}</style>

      {/* Outer Ambient Glow Ring (Minimal) */}
      <div
        style={{
          position: "absolute",
          inset: -2,
          borderRadius: "50%",
          background:
            state === "searching"
              ? "var(--success, #10b981)"
              : state === "generating"
              ? "#ec4899"
              : state === "typing" || state === "loading"
              ? "#3b82f6"
              : "var(--brand, #7c3aed)",
          filter: "blur(6px)",
          animation: state === "idle" ? "none" : "sbPulseAura 1.8s ease-in-out infinite",
          opacity: 0.25,
        }}
      />

      {/* Loading Orbital Spinner Dots */}
      {(state === "loading" || state === "thinking") && (
        <svg
          viewBox="0 0 100 100"
          style={{
            position: "absolute",
            inset: -4,
            width: "calc(100% + 8px)",
            height: "calc(100% + 8px)",
            animation: "sbOrbSpin 2s linear infinite",
            pointerEvents: "none",
          }}
        >
          <circle cx="50" cy="6" r="4" fill="var(--brand, #7c3aed)" />
          <circle cx="94" cy="50" r="3" fill="#3b82f6" opacity="0.7" />
          <circle cx="50" cy="94" r="2.5" fill="#10b981" opacity="0.5" />
        </svg>
      )}

      {/* Minimal SVG Mascot Container */}
      <svg
        className="sb-minimal-body"
        viewBox="0 0 100 100"
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          zIndex: 2,
          transition: "transform 0.2s ease-out",
          animation: clicked
            ? "sbBounceClick 0.5s ease-out"
            : state === "thinking"
            ? "sbTilt 2s ease-in-out infinite"
            : "sbFloat 3s ease-in-out infinite",
        }}
      >
        <defs>
          <linearGradient id="sbMinBody" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--brand, #7c3aed)" />
            <stop offset="100%" stopColor="var(--brand-deep, #4c1d95)" />
          </linearGradient>

          <linearGradient id="sbMinFace" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f8fafc" />
          </linearGradient>
        </defs>

        {/* Minimal Ears / Wings Accent */}
        <path d="M 22 28 L 10 14 L 30 20 Z" fill="var(--brand, #7c3aed)" />
        <path d="M 78 28 L 90 14 L 70 20 Z" fill="var(--brand, #7c3aed)" />

        {/* Minimal Main Round Body */}
        <circle cx="50" cy="52" r="40" fill="url(#sbMinBody)" />

        {/* Soft Minimal Face Plate */}
        <ellipse cx="50" cy="53" rx="30" ry="26" fill="url(#sbMinFace)" />

        {/* DYNAMIC EYE ANIMATIONS */}
        {state === "searching" ? (
          /* Searching: Scanning Eye Motion */
          <g style={{ animation: "sbScanEye 1.2s ease-in-out infinite" }}>
            <circle cx="40" cy="50" r="4.5" fill="#0f172a" />
            <circle cx="60" cy="50" r="4.5" fill="#0f172a" />
            <circle cx="42" cy="48" r="1.5" fill="#ffffff" />
            <circle cx="62" cy="48" r="1.5" fill="#ffffff" />
          </g>
        ) : state === "loading" || state === "thinking" ? (
          /* Loading / Thinking: Eyes looking up in thought */
          <g>
            <circle cx="40" cy="46" r="4.5" fill="#0f172a" />
            <circle cx="60" cy="46" r="4.5" fill="#0f172a" />
            <circle cx="41" cy="44" r="1.5" fill="#ffffff" />
            <circle cx="61" cy="44" r="1.5" fill="#ffffff" />
          </g>
        ) : state === "typing" ? (
          /* Typing: Attentive Eyes looking down + 3 bouncing typing dots */
          <g>
            <circle cx="40" cy="48" r="4" fill="#0f172a" />
            <circle cx="60" cy="48" r="4" fill="#0f172a" />
            {/* 3 Bouncing Typing Dots inside face */}
            <circle cx="42" cy="62" r="2" fill="var(--brand, #7c3aed)" style={{ animation: "sbTypeBounce 1s infinite 0s" }} />
            <circle cx="50" cy="62" r="2" fill="var(--brand, #7c3aed)" style={{ animation: "sbTypeBounce 1s infinite 0.2s" }} />
            <circle cx="58" cy="62" r="2" fill="var(--brand, #7c3aed)" style={{ animation: "sbTypeBounce 1s infinite 0.4s" }} />
          </g>
        ) : clicked ? (
          /* Clicked: Happy Smile Eyes ^_^ */
          <g stroke="#0f172a" strokeWidth="3" strokeLinecap="round" fill="none">
            <path d="M 34 50 Q 40 42 46 50" />
            <path d="M 54 50 Q 60 42 66 50" />
            <path d="M 44 60 Q 50 65 56 60" strokeWidth="2.5" />
          </g>
        ) : (
          /* Idle / Standard: Clean Minimal Blinking Eyes */
          <g style={{ transformOrigin: "50% 50%", animation: "sbBlink 4s infinite" }}>
            <circle cx="40" cy="50" r="4.5" fill="#0f172a" />
            <circle cx="60" cy="50" r="4.5" fill="#0f172a" />
            <circle cx="42" cy="48" r="1.5" fill="#ffffff" />
            <circle cx="62" cy="48" r="1.5" fill="#ffffff" />
            {/* Subtle Minimal Mouth */}
            <path d="M 46 59 Q 50 63 54 59" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" fill="none" />
          </g>
        )}
      </svg>
    </div>
  );
}
