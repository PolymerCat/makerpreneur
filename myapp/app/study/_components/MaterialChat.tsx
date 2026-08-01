"use client";

import React from "react";
import type { Material } from "../_lib/types";

function MaterialChat(props: {
  materials: Material[];
  onSendMessage?: (question: string, materialId: string) => Promise<string>;
  streamUrl?: string;
  streamingParams?: { chunks: string[]; chatHistory: string; language: string };
}): React.JSX.Element {
  var materials = props.materials;
  var onSendMessage = props.onSendMessage;
  var streamUrl = props.streamUrl;
  var streamingParams = props.streamingParams;

  var [messages, setMessages] = React.useState<
    { role: string; content: string }[]
  >([]);
  var [inputValue, setInputValue] = React.useState("");
  var [selectedId, setSelectedId] = React.useState("");
  var [loading, setLoading] = React.useState(false);

  React.useEffect(function() {
    if (materials.length > 0 && selectedId === "") {
      setSelectedId(materials[0].id);
    }
  }, [materials, selectedId]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setInputValue(e.target.value);
  }

  async function handleSend(): Promise<void> {
    if (inputValue.trim() === "" || selectedId === "") {
      return;
    }
    var question = inputValue.trim();
    setInputValue("");
    setMessages(function(prev) {
      var updated = prev.slice();
      updated.push({ role: "user", content: question });
      return updated;
    });
    setLoading(true);

    try {
      if (streamUrl && streamingParams) {
        await handleStreamSend(question);
      } else if (onSendMessage) {
        var answer = await onSendMessage(question, selectedId);
        setMessages(function(prev) {
          var updated = prev.slice();
          updated.push({ role: "assistant", content: answer });
          return updated;
        });
      }
    } catch (err) {
      setMessages(function(prev) {
        var updated = prev.slice();
        updated.push({ role: "assistant", content: "Error: " + String(err) });
        return updated;
      });
    }

    setLoading(false);
  }

  async function handleStreamSend(question: string): Promise<void> {
    if (!streamUrl || !streamingParams) {
      return;
    }

    var params = streamingParams;
    var response = await fetch(streamUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: question,
        chunks: params.chunks,
        chatHistory: params.chatHistory,
        language: params.language
      })
    });

    if (!response.ok) {
      throw new Error("Stream request failed: " + response.statusText);
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
        break;
      }
      var text = decoder.decode(result.value, { stream: true });
      assistantMessage = assistantMessage + text;
      setMessages(function(prev) {
        var updated = prev.slice();
        updated[updated.length - 1] = { role: "assistant", content: assistantMessage };
        return updated;
      });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === "Enter") {
      handleSend();
    }
  }

  function handleClear(): void {
    setMessages([]);
  }

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    setSelectedId(e.target.value);
  }

  return (
    <div className="material-chat">
      <div className="chat-controls">
        <select value={selectedId} onChange={handleSelectChange}>
          {materials.map(function(mat: Material) {
            return (
              <option key={mat.id} value={mat.id}>{mat.title}</option>
            );
          })}
        </select>
        <button className="btn btn-sm" onClick={handleClear}>Clear</button>
      </div>
      <div className="chat-messages">
        {messages.map(function(msg, index) {
          var className = "chat-bubble chat-" + msg.role;
          return (
            <div key={index} className={className}>
              <strong>{msg.role === "user" ? "You" : "AI"}:</strong>
              {" " + msg.content}
            </div>
          );
        })}
      </div>
      <div className="chat-input-row">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question..."
          disabled={loading}
        />
        <button className="btn btn-primary" onClick={handleSend} disabled={loading}>
          {loading ? "Thinking..." : "Send"}
        </button>
      </div>
    </div>
  );
}

export default MaterialChat;
