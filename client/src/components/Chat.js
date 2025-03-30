// Chat.js
import React, { useState, useEffect } from "react";

function Chat({ roomId, clearSignal, defaultName }) {
  const chatKey = `chat-${roomId}`;
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");

  // Load existing messages from localStorage on mount.
  useEffect(() => {
    const stored = localStorage.getItem(chatKey);
    if (stored) {
      try {
        setMessages(JSON.parse(stored));
      } catch (error) {
        console.error("Failed to parse chat messages:", error);
      }
    }
  }, [chatKey]);

  // Listen for localStorage changes (from other windows/instances).
  useEffect(() => {
    const handler = (e) => {
      if (e.key === chatKey && e.newValue) {
        try {
          setMessages(JSON.parse(e.newValue));
        } catch (error) {
          console.error("Storage event parse error:", error);
        }
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [chatKey]);

  // When clearSignal changes, clear messages for this room.
  useEffect(() => {
    setMessages([]);
    localStorage.setItem(chatKey, JSON.stringify([]));
  }, [clearSignal, chatKey]);

  // Handler for sending a message.
  const handleSend = () => {
    if (!defaultName || !message.trim()) return;
    const newMsg = {
      name: defaultName.trim(),
      message: message.trim(),
      time: new Date().toISOString(),
    };
    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    localStorage.setItem(chatKey, JSON.stringify(updatedMessages));
    setMessage("");
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "10px", maxHeight: "300px", overflowY: "auto" }}>
      <h3 style={{ margin: "0 0 10px 0" }}>Chat Room</h3>
      {/* Display the user's name */}
      <div style={{ marginBottom: "10px", fontSize: "12px", color: "#555" }}>
        You are: <strong>{defaultName || "Anonymous"}</strong>
      </div>
      {/* Chat messages */}
      <div style={{ marginBottom: "10px", fontSize: "14px" }}>
        {messages.map((msg, index) => (
          <div key={index} style={{ marginBottom: "5px" }}>
            <strong>{msg.name}: </strong>
            <span>{msg.message}</span>
          </div>
        ))}
      </div>
      {/* Message input */}
      <div style={{ display: "flex", gap: "10px" }}>
        <input
          type="text"
          placeholder="Type your message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSend();
            }
          }}
          style={{ flexGrow: 1, padding: "6px" }}
        />
        <button onClick={handleSend} style={{ padding: "6px 12px" }}>
          Send
        </button>
      </div>
    </div>
  );
}

export default Chat;
