"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Icon } from "@/components/ui/Icon";
import { useSession } from "@/lib/auth-context";
import { db } from "../_lib/db";
import { renderMarkdown } from "../_lib/render-markdown";
import { useCourse } from "../_lib/CourseProvider";
import { CoursePicker } from "../_components/CoursePicker";
import { CourseBar } from "../_components/CourseBar";
import { aiExtractMemory } from "../actions";
import type { Material } from "../_lib/types";

var STREAM_URL = "/study/api/chat";

var SUGGESTIONS = [
  "What is mMTC in 5G?",
  "Explain eigenvalues and eigenvectors",
  "Summarize the Krebs cycle",
  "What are Newton's three laws of motion?"
];

type ChatMessage = { role: string; content: string };
type Conversation = {
  id: string;
  userId: string;
  title: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
};

function formatDate(iso: string): string {
  var d = new Date(iso);
  var now = new Date();
  var isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    var h = d.getHours();
    var m = d.getMinutes();
    var ampm = h >= 12 ? "PM" : "AM";
    var h12 = h % 12 || 12;
    return "Today " + h12 + ":" + (m < 10 ? "0" : "") + m + " " + ampm;
  }
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[d.getMonth()] + " " + d.getDate();
}

export default function ChatPage() {
  var { activeCourse } = useCourse();

  if (!activeCourse) {
    return <AppShell><CoursePicker /></AppShell>;
  }

  var [messages, setMessages] = React.useState<ChatMessage[]>([]);
  var [inputValue, setInputValue] = React.useState("");
  var [loading, setLoading] = React.useState(false);
  var [activeTab, setActiveTab] = React.useState("chat");
  var [conversations, setConversations] = React.useState<Conversation[]>([]);
  var [activeConvId, setActiveConvId] = React.useState("");
  var { user } = useSession();
  var [historyLoading, setHistoryLoading] = React.useState(false);
  var [sources, setSources] = React.useState<{ material: Material; chunkCount: number }[]>([]);
  var [isSearching, setIsSearching] = React.useState(false);
  var messagesEndRef = React.useRef<HTMLDivElement>(null);
  var textareaRef = React.useRef<HTMLTextAreaElement>(null);
  var loadedUserIdRef = React.useRef<string | null>(null);
  var memoriesCacheRef = React.useRef<{ courseId: string; list: string[] } | null>(null);

  var pendingBufferRef = React.useRef("");
  var displayedTextRef = React.useRef("");
  var typewriterIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  var isStreamDoneRef = React.useRef(false);

  React.useEffect(function() {
    return function() {
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
      }
    };
  }, []);

  React.useEffect(function() {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ block: "end" });
    }
  }, [messages]);

  React.useEffect(function() {
    if (user && user.id !== loadedUserIdRef.current) {
      loadedUserIdRef.current = user.id;
      loadConversations(user.id);
    } else if (!user) {
      loadedUserIdRef.current = null;
    }
  }, [user]);

  React.useEffect(function() {
    if (!activeCourse) {
      return;
    }
    console.log("[SOURCES-LOAD] activeCourse:", activeCourse.id, activeCourse.name);
    db.listAll("materials", { courseId: activeCourse.id }, "createdAt").then(function(all) {
      console.log("[SOURCES-LOAD] materials found:", all.length);
      Promise.all(all.map(function(m: Material) {
        return db.listAll("chunks", { materialId: m.id }, null).then(function(chunks) {
          console.log("[SOURCES-LOAD] material:", m.id, m.title, "status:", m.status, "chunks:", chunks.length);
          return { material: m, chunkCount: chunks.length };
        });
      })).then(function(data) {
        console.log("[SOURCES-LOAD] setSources with", data.length, "items");
        setSources(data);
      });
    }).catch(function(err) {
      console.error("[SOURCES-LOAD] ERROR:", err);
    });
  }, [activeCourse]);

  async function loadConversations(userId: string): Promise<void> {
    try {
      var list = await db.listConversations(userId);
      setConversations(list as Conversation[]);
    } catch (err) {
      console.error("loadConversations:", err);
    }
  }

  async function ensureConversation(title: string): Promise<string> {
    if (activeConvId !== "" && user) {
      return activeConvId;
    }
    if (!user) {
      return "";
    }
    try {
      var conv = await db.createConversation(user.id, title);
      var convData = conv as Conversation;
      setActiveConvId(convData.id);
      var list = await db.listConversations(user.id);
      setConversations(list as Conversation[]);
      return convData.id;
    } catch (err) {
      console.error("ensureConversation:", err);
      return "";
    }
  }

  async function handleNewChat(): Promise<void> {
    setMessages([]);
    setActiveConvId("");
    setActiveTab("chat");
  }

  async function handleSelectConversation(convId: string): Promise<void> {
    setHistoryLoading(true);
    try {
      var msgs = await db.listMessages(convId);
      setMessages((msgs as ChatMessage[]));
      setActiveConvId(convId);
      setActiveTab("chat");
    } catch (err) {
      console.error("handleSelectConversation:", err);
    }
    setHistoryLoading(false);
  }

  async function handleDeleteConversation(convId: string, e: React.MouseEvent): Promise<void> {
    e.stopPropagation();
    try {
      await db.deleteConversation(convId);
      if (activeConvId === convId) {
        setMessages([]);
        setActiveConvId("");
      }
      if (user) {
        var list = await db.listConversations(user.id);
        setConversations(list as Conversation[]);
      }
    } catch (err) {
      console.error("handleDeleteConversation:", err);
    }
  }

  function autoGrow(): void {
    var ta = textareaRef.current;
    if (!ta) {
      return;
    }
    ta.style.height = "auto";
    var max = 160;
    var next = ta.scrollHeight;
    if (next > max) {
      next = max;
    }
    ta.style.height = next + "px";
  }

  async function handleSend(): Promise<void> {
    if (inputValue.trim() === "" || loading) {
      return;
    }
    var question = inputValue.trim();
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setMessages(function(prev) {
      var updated = prev.slice();
      updated.push({ role: "user", content: question });
      return updated;
    });
    setLoading(true);

    var title = question.slice(0, 60);
    var targetConvId = activeConvId;
    if (user && !targetConvId) {
      targetConvId = await ensureConversation(title);
    }
    if (user && targetConvId) {
      db.addMessage(targetConvId, "user", question).catch(function(err) {
        console.error("addMessage user error:", err);
      });
    }

    try {
      var recent = messages.slice(-10);
      var historyLines: string[] = [];
      for (var i = 0; i < recent.length; i++) {
        var role = recent[i].role === "user" ? "User" : "Assistant";
        historyLines.push(role + ": " + recent[i].content);
      }
      var chatHistory = historyLines.join("\n");

      var currentConv = conversations.find(function(c) { return c.id === activeConvId; });
      var currentSummary = currentConv?.summary || "";

      var memories: string[] = [];
      if (user && activeCourse) {
        var memCache = memoriesCacheRef.current;
        if (memCache && memCache.courseId === activeCourse.id) {
          memories = memCache.list;
        } else {
          try {
            var memList = await db.listMemories(user.id, activeCourse.id);
            memories = memList.map(function(m: any) { return "[" + m.type + "] " + m.content; });
            memoriesCacheRef.current = { courseId: activeCourse.id, list: memories };
          } catch (_mErr) {}
        }
      }

      console.log("[SEND] sources count:", sources.length);
      var readyMaterialIds = sources.filter(function(s) {
        return s.material.status === "ready" && s.chunkCount > 0;
      }).map(function(s) {
        return s.material.id;
      });
      var isGreeting = /^(hi|hello|hey|greetings|thanks|thank you|good morning|good afternoon)\b/i.test(question.trim());

      if (readyMaterialIds.length > 0 && !isGreeting) {
        setIsSearching(true);
      } else {
        setIsSearching(false);
      }

      pendingBufferRef.current = "";
      displayedTextRef.current = "";
      isStreamDoneRef.current = false;
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
        typewriterIntervalRef.current = null;
      }

      function startTypewriter() {
        if (typewriterIntervalRef.current) return;
        typewriterIntervalRef.current = setInterval(function() {
          if (pendingBufferRef.current.length > 0) {
            var step = pendingBufferRef.current.length > 200 ? 20 : 4;
            var chunk = pendingBufferRef.current.slice(0, step);
            pendingBufferRef.current = pendingBufferRef.current.slice(step);
            displayedTextRef.current += chunk;
            var currentText = displayedTextRef.current;
            setMessages(function(prev) {
              var updated = prev.slice();
              updated[updated.length - 1] = { role: "assistant", content: currentText };
              return updated;
            });
          } else if (isStreamDoneRef.current) {
            if (typewriterIntervalRef.current) {
              clearInterval(typewriterIntervalRef.current);
              typewriterIntervalRef.current = null;
            }
          }
        }, 45);
      }

      var response = await fetch(STREAM_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: question,
          materialIds: isGreeting ? [] : readyMaterialIds,
          chatHistory: chatHistory,
          summary: currentSummary,
          memories: memories,
          language: "en"
        })
      });

      if (!response.ok) {
        var errorBody = await response.text();
        throw new Error("Request failed (" + response.status + "): " + errorBody);
      }

      var reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      var decoder = new TextDecoder();
      var assistantMessage = "";

      setMessages(function(prev) {
        var updated = prev.slice();
        updated.push({ role: "assistant", content: "" });
        return updated;
      });

      while (true) {
        var result = await reader.read();
        if (result.done) {
          isStreamDoneRef.current = true;
          break;
        }
        var text = decoder.decode(result.value, { stream: true });
        if (text !== "") {
          setIsSearching(false);
          assistantMessage = assistantMessage + text;
          pendingBufferRef.current += text;
          startTypewriter();
        }
      }

      setIsSearching(false);

      if (user && targetConvId) {
        await db.addMessage(targetConvId, "assistant", assistantMessage);
        await db.renameConversation(targetConvId, title);
        var list = await db.listConversations(user.id);
        setConversations(list as Conversation[]);
        // Fire non-blocking memory extraction hook (skip trivial exchanges)
        var isTrivial = /^(hi|hello|hey|thanks|thank you|ok|okay|good|great|nice|bye|noted)\b/i.test(question.trim()) || assistantMessage.trim().length < 60;
        if (!isTrivial) {
          aiExtractMemory(targetConvId, activeCourse?.id || null, question, assistantMessage)
            .then(function() {
              memoriesCacheRef.current = null;
            })
            .catch(function(mErr) {
              console.error("[CHAT] Non-blocking aiExtractMemory error:", mErr);
            });
        }
      }
    } catch (err) {
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
        typewriterIntervalRef.current = null;
      }
      setIsSearching(false);
      setMessages(function(prev) {
        var updated = prev.slice();
        updated.push({ role: "assistant", content: "Error: " + String(err) });
        return updated;
      });
    }

    setIsSearching(false);
    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSuggestion(text: string): void {
    setInputValue(text);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }

  function handleTabClick(tab: string): void {
    setActiveTab(tab);
  }

  return (
    <AppShell>
      <CourseBar />
      <div className="chat-page">
        <div className="chat-tabs">
          <button
            type="button"
            className={"chat-tab" + (activeTab === "chat" ? " active" : "")}
            onClick={function() { handleTabClick("chat"); }}
          >
            <Icon name="ti-message-2" />
            <span>Chat</span>
          </button>
          <button
            type="button"
            className={"chat-tab" + (activeTab === "sources" ? " active" : "")}
            onClick={function() { handleTabClick("sources"); }}
          >
            <Icon name="ti-folders" />
            <span>Sources</span>
          </button>
          <button
            type="button"
            className={"chat-tab" + (activeTab === "history" ? " active" : "")}
            onClick={function() { handleTabClick("history"); }}
          >
            <Icon name="ti-history" />
            <span>History</span>
          </button>
          <div className="chat-tabs-actions">
            {messages.length > 0 ? (
              <button type="button" className="chat-icon-btn" onClick={handleNewChat} title="New chat">
                <Icon name="ti-plus" />
              </button>
            ) : null}
          </div>
        </div>

        {!user ? (
          <div className="chat-auth-banner">
            <Icon name="ti-user" />
            <span>Sign in to save conversations across sessions.</span>
            <a href="/auth" className="chat-auth-link">Sign in</a>
          </div>
        ) : null}

        {activeTab === "chat" ? (
          <div className="chat-center">
            <div className="chat-scroll">
              {messages.length === 0 ? (
                <div className="chat-empty">
                  <div className="chat-empty-icon">
                    <Icon name="ti-brain" />
                  </div>
                  {conversations.length > 0 ? (
                    <button
                      type="button"
                      className="chat-resume-pill"
                      onClick={function() { handleSelectConversation(conversations[0].id); }}
                    >
                      <Icon name="ti-arrow-back-up" />
                      <span>Resume: <strong>{conversations[0].title}</strong></span>
                    </button>
                  ) : null}
                  <h2>What can I help you study?</h2>
                  <p className="chat-empty-sub">Ask about any subject. Responses are augmented by your indexed materials.</p>
                  <div className="chat-suggestions">
                    {SUGGESTIONS.map(function(s) {
                      return (
                        <button
                          key={s}
                          type="button"
                          className="chat-suggestion"
                          onClick={function() { handleSuggestion(s); }}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {messages.map(function(msg, index) {
                var isUser = msg.role === "user";
                return (
                  <div key={index} className={"chat-row chat-row-" + msg.role}>
                    <div className="chat-avatar">
                      <Icon name={isUser ? "ti-user" : "ti-robot"} />
                    </div>
                    <div className="chat-content">
                      <div className="chat-name">{isUser ? "You" : "Study Buddy"}</div>
                      {isUser ? (
                        <div className="chat-text chat-text-user">{msg.content}</div>
                      ) : (
                        <div
                          className="chat-text chat-text-ai"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
              {loading && (messages.length === 0 || messages[messages.length - 1].role === "user" || messages[messages.length - 1].content === "") ? (
                <div className="chat-row chat-row-assistant">
                  <div className="chat-avatar"><Icon name="ti-robot" /></div>
                  <div className="chat-content">
                    <div className="chat-name">Study Buddy</div>
                    <em className="chat-typing-text">{isSearching ? "Searching course materials…" : "Typing…"}</em>
                  </div>
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-compose">
              <div className="chat-input-wrap">
                <textarea
                  ref={textareaRef}
                  className="chat-textarea"
                  placeholder="Message Study Buddy..."
                  value={inputValue}
                  rows={1}
                  onChange={function(e) { setInputValue(e.target.value); autoGrow(); }}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                />
                <button
                  type="button"
                  className={"chat-send " + (inputValue.trim() === "" || loading ? "disabled" : "")}
                  onClick={handleSend}
                  disabled={inputValue.trim() === "" || loading}
                  title="Send"
                >
                  <Icon name="ti-arrow-up" />
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "sources" ? (
          sources.length === 0 ? (
            <div className="chat-empty chat-center">
              <div className="chat-empty-icon"><Icon name="ti-folder-off" /></div>
              <h2>No sources indexed yet</h2>
              <p className="chat-empty-sub">Upload materials in the Materials page to use them as sources.</p>
            </div>
          ) : (
            <div className="chat-center">
              <div className="chat-source-list">
                {sources.map(function(s) {
                  return (
                    <div key={s.material.id} className="chat-source-item">
                      <div className="chat-source-icon"><Icon name="ti-file-text" /></div>
                      <div className="chat-source-info">
                        <div className="chat-source-title">{s.material.title}</div>
                        <div className="chat-source-meta">
                          {s.chunkCount > 0 ? s.chunkCount + " chunks" : "No chunks"}
                          <span className="chat-source-status"> &middot; {s.material.status}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : null}

        {activeTab === "history" ? (
          <div className="chat-center">
            {historyLoading ? (
              <div className="chat-empty">
                <p className="chat-empty-sub">Loading conversations...</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="chat-empty">
                <div className="chat-empty-icon"><Icon name="ti-history-off" /></div>
                <h2>No conversations yet</h2>
                <p className="chat-empty-sub">Start a new chat and it will appear here.</p>
              </div>
            ) : (
              <div className="chat-history-list">
                {conversations.map(function(conv) {
                  return (
                    <button
                      key={conv.id}
                      type="button"
                      className={"chat-history-item" + (conv.id === activeConvId ? " active" : "")}
                      onClick={function() { handleSelectConversation(conv.id); }}
                    >
                      <div className="chat-history-info">
                        <div className="chat-history-title">{conv.title}</div>
                        <div className="chat-history-date">{formatDate(conv.updatedAt)}</div>
                      </div>
                      <span
                        className="chat-history-delete"
                        onClick={function(e) { handleDeleteConversation(conv.id, e); }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={function(e) { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); handleDeleteConversation(conv.id, e as unknown as React.MouseEvent); } }}
                      >
                        <Icon name="ti-trash" />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
