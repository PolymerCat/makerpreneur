"use client";

import React, { useState } from "react";

export type StudyBuddyState = "idle" | "thinking" | "searching" | "generating" | "speaking";

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

  const isWorking = state === "thinking" || state === "searching" || state === "generating";

  return (
    <div
      className={`study-buddy-icon-wrap ${className}`}
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
        @keyframes sbGlowPulse {
          0%, 100% { transform: scale(1); opacity: 0.55; }
          50% { transform: scale(1.15); opacity: 0.9; }
        }
        @keyframes sbSpinRing {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes sbFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
        }
        @keyframes sbBounceClick {
          0% { transform: scale(1); }
          30% { transform: scale(0.82) rotate(-8deg); }
          60% { transform: scale(1.22) rotate(6deg); }
          100% { transform: scale(1); }
        }
        @keyframes sbScanLine {
          0% { transform: translateY(-10px); opacity: 0; }
          50% { opacity: 0.8; }
          100% { transform: translateY(10px); opacity: 0; }
        }
        .study-buddy-icon-wrap:hover .sb-core {
          transform: scale(1.08);
          filter: drop-shadow(0 0 12px rgba(124, 58, 237, 0.8));
        }
        .study-buddy-icon-wrap:hover .sb-ring {
          animation-duration: 2s !important;
        }
      `}</style>

      {/* Background Glowing Aura Ring */}
      <div
        className="sb-aura"
        style={{
          position: "absolute",
          inset: -4,
          borderRadius: "50%",
          background:
            state === "searching"
              ? "radial-gradient(circle, rgba(16, 185, 129, 0.6) 0%, rgba(16, 185, 129, 0) 75%)"
              : state === "generating"
              ? "radial-gradient(circle, rgba(236, 72, 153, 0.6) 0%, rgba(236, 72, 153, 0) 75%)"
              : isWorking
              ? "radial-gradient(circle, rgba(99, 102, 241, 0.7) 0%, rgba(99, 102, 241, 0) 75%)"
              : "radial-gradient(circle, rgba(124, 58, 237, 0.5) 0%, rgba(124, 58, 237, 0) 75%)",
          animation: isWorking
            ? "sbGlowPulse 1.2s infinite ease-in-out"
            : "sbGlowPulse 3.5s infinite ease-in-out",
          pointerEvents: "none",
        }}
      />

      {/* Rotating Outer Tech Dash Ring */}
      <svg
        className="sb-ring"
        viewBox="0 0 100 100"
        style={{
          position: "absolute",
          inset: -2,
          width: "calc(100% + 4px)",
          height: "calc(100% + 4px)",
          animation: `sbSpinRing ${isWorking ? "2.5s" : "12s"} linear infinite`,
          opacity: 0.85,
        }}
      >
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke={
            state === "searching"
              ? "#10b981"
              : state === "generating"
              ? "#ec4899"
              : "#a855f7"
          }
          strokeWidth="3"
          strokeDasharray={isWorking ? "25 15" : "10 20 5 20"}
          strokeLinecap="round"
        />
      </svg>

      {/* Main Mascot Core SVG */}
      <svg
        className="sb-core"
        viewBox="0 0 100 100"
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          zIndex: 2,
          transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.25s ease",
          animation: clicked
            ? "sbBounceClick 0.55s ease-out"
            : isWorking
            ? "sbFloat 1.5s infinite ease-in-out"
            : "sbFloat 3.5s infinite ease-in-out",
        }}
      >
        <defs>
          <linearGradient id="sbBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>

          <linearGradient id="sbFaceGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          <filter id="sbEyeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Head Shell */}
        <rect
          x="10"
          y="14"
          width="80"
          height="72"
          rx="32"
          fill="url(#sbBodyGrad)"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeOpacity="0.3"
        />

        {/* Visor Screen */}
        <rect
          x="18"
          y="24"
          width="64"
          height="52"
          rx="22"
          fill="url(#sbFaceGrad)"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1.5"
        />

        {/* Dynamic Expressive Eyes / Face Elements */}
        {state === "searching" ? (
          /* Scanning Wave Eyes */
          <g filter="url(#sbEyeGlow)">
            <circle cx="38" cy="50" r="7" fill="#10b981" />
            <circle cx="62" cy="50" r="7" fill="#10b981" />
            <line x1="28" y1="50" x2="72" y2="50" stroke="#34d399" strokeWidth="2.5" strokeDasharray="4 3" />
          </g>
        ) : state === "generating" ? (
          /* Star/Sparkle Eyes */
          <g filter="url(#sbEyeGlow)" fill="#f472b6">
            <path d="M38 42 L40 48 L46 50 L40 52 L38 58 L36 52 L30 50 L36 48 Z" />
            <path d="M62 42 L64 48 L70 50 L64 52 L62 58 L60 52 L54 50 L60 48 Z" />
          </g>
        ) : isWorking ? (
          /* Thinking Concentrating Eyes */
          <g filter="url(#sbEyeGlow)">
            <ellipse cx="38" cy="48" rx="6" ry="8" fill="#38bdf8" />
            <ellipse cx="62" cy="48" rx="6" ry="8" fill="#38bdf8" />
            <circle cx="40" cy="46" r="2.5" fill="#ffffff" />
            <circle cx="64" cy="46" r="2.5" fill="#ffffff" />
          </g>
        ) : clicked ? (
          /* Cheerful Happy Smile Eyes ^_^ */
          <g stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" fill="none" filter="url(#sbEyeGlow)">
            <path d="M31 52 Q38 42 45 52" />
            <path d="M55 52 Q62 42 69 52" />
          </g>
        ) : (
          /* Default Friendly Glowing Eyes */
          <g filter="url(#sbEyeGlow)">
            <circle cx="38" cy="49" r="7" fill="#38bdf8" />
            <circle cx="62" cy="49" r="7" fill="#38bdf8" />
            <circle cx="40" cy="47" r="2.5" fill="#ffffff" />
            <circle cx="64" cy="47" r="2.5" fill="#ffffff" />
          </g>
        )}

        {/* Cute Antenna / Sparkle Crest */}
        <circle cx="50" cy="9" r="4" fill="#a855f7" filter="url(#sbEyeGlow)" />
        <line x1="50" y1="14" x2="50" y2="9" stroke="#c084fc" strokeWidth="2.5" />
      </svg>
    </div>
  );
}
