"use client";

import React, { useState, useEffect } from "react";
import { Icon } from "@/components/ui/Icon";

type StepSignupDemoProps = {
  isActive: boolean;
  onComplete?: () => void;
};

export function StepSignupDemo(props: StepSignupDemoProps) {
  var isActive = props.isActive;
  var onComplete = props.onComplete;

  var [typedName, setTypedName] = useState("");
  var [typedEmail, setTypedEmail] = useState("");
  var [typedPass, setTypedPass] = useState("");
  var [isSubmitted, setIsSubmitted] = useState(false);
  var [focusField, setFocusField] = useState<"name" | "email" | "pass" | "submit" | null>(null);

  var targetName = "Julita Aisyah";
  var targetEmail = "julita@student.usm.my";
  var targetPass = "••••••••••••";

  useEffect(function() {
    if (!isActive) {
      setTypedName("");
      setTypedEmail("");
      setTypedPass("");
      setIsSubmitted(false);
      setFocusField(null);
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

    // Step 1: Focus name & type name
    setFocusField("name");
    var nameIdx = 0;
    function typeNameStep() {
      if (nameIdx <= targetName.length) {
        setTypedName(targetName.slice(0, nameIdx));
        nameIdx++;
        delay(typeNameStep, 60);
      } else {
        // Move to email
        delay(function() {
          setFocusField("email");
          var emailIdx = 0;
          function typeEmailStep() {
            if (emailIdx <= targetEmail.length) {
              setTypedEmail(targetEmail.slice(0, emailIdx));
              emailIdx++;
              delay(typeEmailStep, 45);
            } else {
              // Move to pass
              delay(function() {
                setFocusField("pass");
                var passIdx = 0;
                function typePassStep() {
                  if (passIdx <= targetPass.length) {
                    setTypedPass(targetPass.slice(0, passIdx));
                    passIdx++;
                    delay(typePassStep, 40);
                  } else {
                    // Focus submit button & click
                    delay(function() {
                      setFocusField("submit");
                      delay(function() {
                        setIsSubmitted(true);
                        setFocusField(null);
                        if (onComplete) {
                          delay(onComplete, 1200);
                        }
                      }, 400);
                    }, 300);
                  }
                }
                typePassStep();
              }, 300);
            }
          }
          typeEmailStep();
        }, 300);
      }
    }

    delay(typeNameStep, 400);

    return function cleanup() {
      isCancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, [isActive]);

  return (
    <div className="hero-demo-card signup-demo">
      <div className="demo-header-badge">
        <span className="demo-step-num">STEP 1</span>
        <span className="demo-step-title">Instant Registration</span>
      </div>

      <div className="demo-card-inner">
        <div className="demo-brand">
          <img src="/logo-crest.webp" alt="USM Crest" className="demo-crest" />
          <div>
            <h3>Join StudentHub USM</h3>
            <p>Create your campus workspace account</p>
          </div>
        </div>

        <div className="demo-form-stack">
          <div className={"demo-field " + (focusField === "name" ? "focused" : "")}>
            <label>
              Full name
              <span className="field-hint">e.g. USM Matric Name</span>
            </label>
            <div className="demo-input-wrapper">
              <Icon name="ti-user" />
              <div className="demo-input-text">
                {typedName}
                {focusField === "name" && <span className="demo-cursor" />}
              </div>
            </div>
          </div>

          <div className={"demo-field " + (focusField === "email" ? "focused" : "")}>
            <label>
              USM Student Email
              <span className="field-hint">@student.usm.my</span>
            </label>
            <div className="demo-input-wrapper">
              <Icon name="ti-mail" />
              <div className="demo-input-text">
                {typedEmail}
                {focusField === "email" && <span className="demo-cursor" />}
              </div>
            </div>
          </div>

          <div className={"demo-field " + (focusField === "pass" ? "focused" : "")}>
            <label>Password</label>
            <div className="demo-input-wrapper">
              <Icon name="ti-lock" />
              <div className="demo-input-text">
                {typedPass}
                {focusField === "pass" && <span className="demo-cursor" />}
              </div>
            </div>
          </div>

          <button
            className={
              "demo-submit-btn " +
              (focusField === "submit" ? "active-click" : "") +
              (isSubmitted ? "submitted" : "")
            }
            type="button"
          >
            {isSubmitted ? (
              <>
                <Icon name="ti-circle-check" />
                <span>Account Created! Sending Link...</span>
              </>
            ) : (
              <>
                <Icon name="ti-user-plus" />
                <span>Create Student Account</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
