// components/Chat.js
import React, { useState, useEffect, useRef } from "react";
import socket from "../socket"; // adjust path if needed

function Chat({ roomId, defaultName }) {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    const handleInitChat = (chatHistory) => {
      setMessages(chatHistory);
    };

    const handleNewMessage = (newMsg) => {
      setMessages((prev) => [...prev, newMsg]);
    };

    const handleClearChat = () => {
      setMessages([]);
    };

    socket.on("init-chat", handleInitChat);
    socket.on("new-message", handleNewMessage);
    socket.on("clear-chat", handleClearChat);

    return () => {
      socket.off("init-chat", handleInitChat);
      socket.off("new-message", handleNewMessage);
      socket.off("clear-chat", handleClearChat);
    };
  }, [roomId]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    if (!message.trim()) return;
    socket.emit("send-message", {
      message: message.trim(),
      name: defaultName || "Anonymous",
      roomId,
    });
    setMessage("");
  };

  return (
    <div
      ref={containerRef}
      style={{
        backgroundColor: "#fff",
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "10px",
        maxHeight: "300px",
        overflowY: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 10px 0" }}>Chat Room</h3>
      <div style={{ marginBottom: "10px", fontSize: "14px" }}>
        {messages.map((msg, index) => (
          <div key={index} style={{ marginBottom: "5px" }}>
            <strong>{msg.name}:</strong> {msg.message}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <input
          type="text"
          placeholder="Type your message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
          style={{ flexGrow: 1, padding: "6px" }}
        />
        <button onClick={sendMessage} style={{ padding: "6px 12px" }}>
          Send
        </button>
      </div>
    </div>
  );
}

export default Chat;
