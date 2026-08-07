"use client";

import React, { useState, useEffect } from "react";
import { Icon } from "@/components/ui/Icon";

type StepFeaturesDemoProps = {
  isActive: boolean;
};

type FeatureTab = "planner" | "study" | "events" | "marketplace";

export function StepFeaturesDemo(props: StepFeaturesDemoProps) {
  var isActive = props.isActive;

  var [activeTab, setActiveTab] = useState<FeatureTab>("planner");

  useEffect(function() {
    if (!isActive) return;

    var tabs: FeatureTab[] = ["planner", "study", "events", "marketplace"];
    var currentIdx = 0;

    var interval = setInterval(function() {
      currentIdx = (currentIdx + 1) % tabs.length;
      setActiveTab(tabs[currentIdx]);
    }, 3500);

    return function cleanup() {
      clearInterval(interval);
    };
  }, [isActive]);

  return (
    <div className="hero-demo-card features-demo">
      <div className="demo-header-badge">
        <span className="demo-step-num">STEP 3</span>
        <span className="demo-step-title">Explore Platform Features (Actual UI)</span>
      </div>

      <div className="demo-card-inner">
        {/* Sub Navigation Bar for Features */}
        <div className="feature-tabs-nav">
          <button
            className={"tab-btn " + (activeTab === "planner" ? "active" : "")}
            onClick={function() { setActiveTab("planner"); }}
            type="button"
          >
            <Icon name="ti-calendar-event" />
            <span>Campus Planner</span>
          </button>
          <button
            className={"tab-btn " + (activeTab === "study" ? "active" : "")}
            onClick={function() { setActiveTab("study"); }}
            type="button"
          >
            <Icon name="ti-brain" />
            <span>Study Hub AI</span>
          </button>
          <button
            className={"tab-btn " + (activeTab === "events" ? "active" : "")}
            onClick={function() { setActiveTab("events"); }}
            type="button"
          >
            <Icon name="ti-trophy" />
            <span>MyCSD Events</span>
          </button>
          <button
            className={"tab-btn " + (activeTab === "marketplace" ? "active" : "")}
            onClick={function() { setActiveTab("marketplace"); }}
            type="button"
          >
            <Icon name="ti-shopping-bag" />
            <span>Marketplace</span>
          </button>
        </div>

        {/* Feature 1: Campus Planner */}
        {activeTab === "planner" && (
          <div className="feature-panel-view fade-in">
            <div className="panel-header">
              <div className="panel-title">
                <Icon name="ti-calendar-time" />
                <div>
                  <h4>Smart Schedule & Assignment Tracker</h4>
                  <p>Organize classes, assignment deadlines, and exam reminders</p>
                </div>
              </div>
              <span className="panel-tag brand-tag">Live Timetable</span>
            </div>

            <div className="ui-mock-grid">
              <div className="ui-mock-card">
                <div className="ui-card-head">
                  <strong>Today Schedule — Friday</strong>
                  <span className="ui-badge success">3 Active Classes</span>
                </div>
                <div className="ui-timeline-list">
                  <div className="ui-timeline-item active">
                    <span className="time">09:00 AM</span>
                    <div className="details">
                      <strong>CAT201 — Data Structures</strong>
                      <span>DKG 31 • Dr. Farhan</span>
                    </div>
                    <span className="status-pill active">In Progress</span>
                  </div>
                  <div className="ui-timeline-item">
                    <span className="time">02:00 PM</span>
                    <div className="details">
                      <strong>CMT322 — Web Engineering</strong>
                      <span>Lab 4 • Prof. Aisyah</span>
                    </div>
                    <span className="status-pill upcoming">Next Up</span>
                  </div>
                  <div className="ui-timeline-item">
                    <span className="time">04:30 PM</span>
                    <div className="details">
                      <strong>MyCSD — Makerpreneur Talk</strong>
                      <span>Dewan Agung Tuanku Syed Sirajuddin</span>
                    </div>
                    <span className="status-pill point">+20 Pts</span>
                  </div>
                </div>
              </div>

              <div className="ui-mock-card highlight-card">
                <div className="ui-card-head">
                  <strong>Upcoming Deadlines</strong>
                  <Icon name="ti-bell-ringing" />
                </div>
                <div className="task-check-list">
                  <div className="task-item checked">
                    <Icon name="ti-checkbox" />
                    <span>Submit CAT201 Assignment 2</span>
                    <span className="deadline-badge past">Done</span>
                  </div>
                  <div className="task-item pending">
                    <Icon name="ti-square" />
                    <span>Prepare CMT322 Milestone Slides</span>
                    <span className="deadline-badge urgent">Due Today</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feature 2: Study Hub & RAG AI */}
        {activeTab === "study" && (
          <div className="feature-panel-view fade-in">
            <div className="panel-header">
              <div className="panel-title">
                <Icon name="ti-robot" />
                <div>
                  <h4>AI Assistant & RAG Study Companion</h4>
                  <p>Chat with your course notes, generate flashcards & practice quizzes</p>
                </div>
              </div>
              <span className="panel-tag AI-tag">RAG Powered</span>
            </div>

            <div className="ui-mock-grid">
              <div className="ui-mock-card ai-chat-card">
                <div className="ai-chat-header">
                  <div className="ai-avatar">
                    <Icon name="ti-sparkles" />
                  </div>
                  <div>
                    <strong>Study AI Assistant</strong>
                    <span>CAT201 Binary Trees & Graphs</span>
                  </div>
                </div>
                <div className="chat-bubble user">
                  <p>Can you summarize the difference between BFS and DFS?</p>
                </div>
                <div className="chat-bubble ai">
                  <p>
                    <strong>BFS (Breadth-First Search)</strong> explores neighbor nodes level by level using a <code>Queue</code>.
                    <br />
                    <strong>DFS (Depth-First Search)</strong> explores deep branches first using a <code>Stack</code> or recursion!
                  </p>
                  <div className="ai-actions">
                    <span className="ai-btn"><Icon name="ti-cards" /> Create Flashcards</span>
                    <span className="ai-btn"><Icon name="ti-help" /> Generate Quiz</span>
                  </div>
                </div>
              </div>

              <div className="ui-mock-card flashcard-preview">
                <div className="ui-card-head">
                  <strong>Generated Flashcard #4</strong>
                  <span className="ui-badge brand">CAT201</span>
                </div>
                <div className="flashcard-box">
                  <span className="card-side-label">FRONT</span>
                  <p className="flashcard-text">What is the worst-case time complexity of QuickSort?</p>
                  <div className="flip-hint">
                    <Icon name="ti-rotate" /> Flip to reveal answer
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feature 3: MyCSD Events & Points */}
        {activeTab === "events" && (
          <div className="feature-panel-view fade-in">
            <div className="panel-header">
              <div className="panel-title">
                <Icon name="ti-trophy" />
                <div>
                  <h4>MyCSD Campus Event Hub</h4>
                  <p>Register for activities, track points, and claim verified certificates</p>
                </div>
              </div>
              <span className="panel-tag warning-tag">MyCSD Verified</span>
            </div>

            <div className="ui-mock-grid">
              <div className="ui-mock-card event-card">
                <div className="event-img-placeholder">
                  <Icon name="ti-rocket" />
                  <span className="point-badge">+50 MyCSD Points</span>
                </div>
                <div className="event-body">
                  <h5>USM Hackathon 2026: AI & Tech Innovation</h5>
                  <p className="event-info">
                    <Icon name="ti-clock" /> Tomorrow, 10:00 AM • <Icon name="ti-map-pin" /> Eureka Complex
                  </p>
                  <div className="event-foot">
                    <span className="seats-left">14 seats remaining</span>
                    <button className="ui-btn brand" type="button">
                      <Icon name="ti-user-check" /> Register Now
                    </button>
                  </div>
                </div>
              </div>

              <div className="ui-mock-card points-summary">
                <div className="ui-card-head">
                  <strong>MyCSD Tracker</strong>
                  <Icon name="ti-award" />
                </div>
                <div className="stat-giant">
                  <span className="number">340</span>
                  <span className="unit">Points Earned</span>
                </div>
                <div className="progress-bar-wrap">
                  <div className="bar-fill" style={{ width: "68%" }} />
                </div>
                <p className="stat-caption">68% towards annual co-curricular milestone!</p>
              </div>
            </div>
          </div>
        )}

        {/* Feature 4: Marketplace & Transit */}
        {activeTab === "marketplace" && (
          <div className="feature-panel-view fade-in">
            <div className="panel-header">
              <div className="panel-title">
                <Icon name="ti-bus" />
                <div>
                  <h4>Student Marketplace & Transit Tracker</h4>
                  <p>Buy secondhand textbooks & check live campus bus arrival times</p>
                </div>
              </div>
              <span className="panel-tag success-tag">Campus Utilities</span>
            </div>

            <div className="ui-mock-grid">
              <div className="ui-mock-card transit-card">
                <div className="ui-card-head">
                  <strong>USM Bus Line A — Desasiswa Tekun</strong>
                  <span className="ui-badge success">On Schedule</span>
                </div>
                <div className="bus-arrival-row">
                  <Icon name="ti-bus" />
                  <div>
                    <strong>Arriving in 3 mins</strong>
                    <span>Current Stop: Fajar Harapan</span>
                  </div>
                  <span className="distance">400m away</span>
                </div>
              </div>

              <div className="ui-mock-card market-item">
                <div className="market-row">
                  <div className="item-icon">📚</div>
                  <div className="item-info">
                    <strong>Discrete Mathematics (6th Ed)</strong>
                    <span className="seller">Posted by Amirul • Hardcover</span>
                  </div>
                  <div className="item-price">RM 35</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
