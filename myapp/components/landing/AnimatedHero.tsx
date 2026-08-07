"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { StepSignupDemo } from "./StepSignupDemo";
import { StepConfirmDemo } from "./StepConfirmDemo";
import { StepFeaturesDemo } from "./StepFeaturesDemo";

type AnimatedHeroProps = {
  onDismiss?: () => void;
};

export function AnimatedHero(props: AnimatedHeroProps) {
  var onDismiss = props.onDismiss;

  var [activeStep, setActiveStep] = useState<number>(0);
  var [isPlaying, setIsPlaying] = useState<boolean>(true);
  var [progress, setProgress] = useState<number>(0);

  // Auto-play timer loop
  useEffect(function() {
    if (!isPlaying) return;

    var stepDurations = [7000, 6000, 10000]; // Duration per step in ms
    var currentDuration = stepDurations[activeStep] || 7000;
    var intervalMs = 100;
    var elapsed = 0;

    var timer = setInterval(function() {
      elapsed += intervalMs;
      var pct = Math.min(100, (elapsed / currentDuration) * 100);
      setProgress(pct);

      if (elapsed >= currentDuration) {
        elapsed = 0;
        setProgress(0);
        setActiveStep(function(prev) {
          return (prev + 1) % 3;
        });
      }
    }, intervalMs);

    return function cleanup() {
      clearInterval(timer);
    };
  }, [isPlaying, activeStep]);

  function handleStepSelect(stepIndex: number) {
    setActiveStep(stepIndex);
    setProgress(0);
  }

  function handleStepComplete() {
    if (isPlaying) {
      setActiveStep(function(prev) {
        return (prev + 1) % 3;
      });
      setProgress(0);
    }
  }

  function togglePlay() {
    setIsPlaying(!isPlaying);
  }

  function goPrev() {
    setActiveStep(function(prev) {
      return prev === 0 ? 2 : prev - 1;
    });
    setProgress(0);
  }

  function goNext() {
    setActiveStep(function(prev) {
      return (prev + 1) % 3;
    });
    setProgress(0);
  }

  return (
    <div className="animated-hero-wrapper">
      <div className="hero-top-bar">
        <div className="hero-eyebrow">
          <span className="live-pulsar" />
          <Icon name="ti-sparkles" />
          <span>Interactive Onboarding & Feature Showcase</span>
        </div>

        <div className="hero-quick-actions">
          <button className="hero-ctrl-btn" onClick={togglePlay} title={isPlaying ? "Pause Tour" : "Play Tour"} type="button">
            <Icon name={isPlaying ? "ti-player-pause" : "ti-player-play"} />
            <span>{isPlaying ? "Pause" : "Play Auto-tour"}</span>
          </button>

          {onDismiss && (
            <button className="hero-ctrl-btn outline" onClick={onDismiss} type="button">
              <Icon name="ti-layout-dashboard" />
              <span>Go to Dashboard</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Headline */}
      <div className="hero-header-text">
        <h2>Experience StudentHub USM</h2>
        <p>Watch how to sign up, confirm your student email, and unlock smart campus tools in under 60 seconds.</p>
      </div>

      {/* Step Tabs Navigation */}
      <div className="hero-steps-nav">
        <button
          className={"step-nav-item " + (activeStep === 0 ? "active" : "")}
          onClick={function() { handleStepSelect(0); }}
          type="button"
        >
          <span className="step-num">1</span>
          <div className="step-label">
            <strong>Sign Up</strong>
            <span>Create account</span>
          </div>
          {activeStep === 0 && isPlaying && (
            <div className="step-progress-bar" style={{ width: progress + "%" }} />
          )}
        </button>

        <button
          className={"step-nav-item " + (activeStep === 1 ? "active" : "")}
          onClick={function() { handleStepSelect(1); }}
          type="button"
        >
          <span className="step-num">2</span>
          <div className="step-label">
            <strong>Confirm Email</strong>
            <span>Click link in inbox</span>
          </div>
          {activeStep === 1 && isPlaying && (
            <div className="step-progress-bar" style={{ width: progress + "%" }} />
          )}
        </button>

        <button
          className={"step-nav-item " + (activeStep === 2 ? "active" : "")}
          onClick={function() { handleStepSelect(2); }}
          type="button"
        >
          <span className="step-num">3</span>
          <div className="step-label">
            <strong>Explore Features</strong>
            <span>Actual app UI</span>
          </div>
          {activeStep === 2 && isPlaying && (
            <div className="step-progress-bar" style={{ width: progress + "%" }} />
          )}
        </button>
      </div>

      {/* Hero Display Stage */}
      <div className="hero-stage">
        {activeStep === 0 && (
          <StepSignupDemo isActive={activeStep === 0} onComplete={handleStepComplete} />
        )}
        {activeStep === 1 && (
          <StepConfirmDemo isActive={activeStep === 1} onComplete={handleStepComplete} />
        )}
        {activeStep === 2 && (
          <StepFeaturesDemo isActive={activeStep === 2} />
        )}
      </div>

      {/* Bottom Controls & CTA Bar */}
      <div className="hero-bottom-bar">
        <div className="nav-arrows">
          <button className="arrow-btn" onClick={goPrev} type="button" aria-label="Previous Step">
            <Icon name="ti-chevron-left" />
          </button>
          <span className="step-indicator-text">Step {activeStep + 1} of 3</span>
          <button className="arrow-btn" onClick={goNext} type="button" aria-label="Next Step">
            <Icon name="ti-chevron-right" />
          </button>
        </div>

        <div className="cta-button-group">
          <Link href="/register" className="hero-cta-btn primary">
            <Icon name="ti-user-plus" />
            <span>Sign Up Now</span>
          </Link>
          <Link href="/signin" className="hero-cta-btn secondary">
            <Icon name="ti-login" />
            <span>Sign In</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
