"use client";

import React, { useState, useEffect } from "react";
import { Icon } from "@/components/ui/Icon";

type StepConfirmDemoProps = {
  isActive: boolean;
  onComplete?: () => void;
};

export function StepConfirmDemo(props: StepConfirmDemoProps) {
  var isActive = props.isActive;
  var onComplete = props.onComplete;

  var [notificationShown, setNotificationShown] = useState(false);
  var [cursorHovering, setCursorHovering] = useState(false);
  var [isClicked, setIsClicked] = useState(false);
  var [isVerified, setIsVerified] = useState(false);

  useEffect(function() {
    if (!isActive) {
      setNotificationShown(false);
      setCursorHovering(false);
      setIsClicked(false);
      setIsVerified(false);
      return;
    }

    var isCancelled = false;
    var timeouts: NodeJS.Timeout[] = [];

    function delay(fn: () => void, ms: number) {
      var t = setTimeout(function() {
        if (!isCancelled) fn();
      }, ms);
      timeouts.push(t);
    }

    // 1. Show notification banner
    delay(function() {
      setNotificationShown(true);

      // 2. Move cursor to confirm button
      delay(function() {
        setCursorHovering(true);

        // 3. Click action
        delay(function() {
          setIsClicked(true);

          // 4. Verification success!
          delay(function() {
            setIsVerified(true);
            setCursorHovering(false);

            if (onComplete) {
              delay(onComplete, 1400);
            }
          }, 600);
        }, 500);
      }, 700);
    }, 400);

    return function cleanup() {
      isCancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, [isActive]);

  return (
    <div className="hero-demo-card confirm-demo">
      <div className="demo-header-badge">
        <span className="demo-step-num">STEP 2</span>
        <span className="demo-step-title">Receive & Click Confirmation Link</span>
      </div>

      <div className="demo-card-inner">
        {/* Incoming Mail Banner */}
        <div className={"demo-mail-toast " + (notificationShown ? "slide-in" : "")}>
          <div className="toast-icon">
            <Icon name="ti-mail-heart" />
          </div>
          <div className="toast-text">
            <strong>USM Student Hub</strong>
            <span>Verification email delivered to julita@student.usm.my</span>
          </div>
          <span className="toast-time">Just now</span>
        </div>

        {/* Email Inbox Preview Window */}
        <div className="email-client-window">
          <div className="email-window-bar">
            <div className="window-dots">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
            </div>
            <div className="window-title">
              <Icon name="ti-mail-check" />
              <span>Inbox — USM Webmail</span>
            </div>
          </div>

          <div className="email-body">
            <div className="email-meta">
              <div className="sender-avatar">USM</div>
              <div>
                <strong className="email-subject">Confirm your StudentHub Account</strong>
                <p className="email-sender">From: auth@student.usm.my • To: julita@student.usm.my</p>
              </div>
            </div>

            <div className="email-content">
              <p>Hi Julita,</p>
              <p>Welcome to <strong>StudentHub USM</strong>! Please verify your email address to activate your campus workspace.</p>

              <div className="email-action-box">
                <button
                  className={
                    "confirm-link-btn " +
                    (cursorHovering ? "hovered " : "") +
                    (isClicked ? "clicked " : "") +
                    (isVerified ? "verified " : "")
                  }
                  type="button"
                >
                  {isVerified ? (
                    <>
                      <Icon name="ti-circle-check-filled" />
                      <span>Email Verified! Redirecting...</span>
                    </>
                  ) : (
                    <>
                      <Icon name="ti-sparkles" />
                      <span>Confirm Email & Activate Account</span>
                    </>
                  )}
                  {cursorHovering && !isVerified && (
                    <span className="animated-pointer-hand">
                      <Icon name="ti-pointer" />
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {isVerified && (
          <div className="verification-success-overlay">
            <div className="success-badge-card">
              <div className="sparkle-circle">
                <Icon name="ti-shield-check" />
              </div>
              <h4>Authentication Success!</h4>
              <p>Your account is confirmed and ready for action.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
