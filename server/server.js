// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // adjust as needed
    methods: ["GET", "POST"],
  },
});

// Store users per lobby: { [lobbyId]: { [socketId]: { x, y, name } } }
const lobbies = {};

// Store chats per chat room: { [roomId]: [ { name, message, time }, ... ] }
const chats = {};

io.on("connection", (socket) => {
  // When a client joins a lobby.
  socket.on("join-lobby", ({ lobbyId }) => {
    socket.join(lobbyId);
    socket.data.lobbyId = lobbyId;
    if (!lobbies[lobbyId]) {
      lobbies[lobbyId] = {};
    }
    lobbies[lobbyId][socket.id] = { x: 100, y: 100, name: "" };
    // If there’s no chat history for the lobby, initialize an empty array.
    if (!chats[lobbyId]) {
      chats[lobbyId] = [];
    }
    socket.emit("init-users", lobbies[lobbyId]);
    socket.emit("init-chat", chats[lobbyId]);
    socket.to(lobbyId).emit("user-joined", {
      id: socket.id,
      position: { x: 100, y: 100 },
    });
    console.log(`${socket.id} joined lobby ${lobbyId}`);
  });

  // New: join-chat event for dedicated chat rooms (e.g. per zone)
  socket.on("join-chat", ({ roomId }) => {
    socket.join(roomId);
    // Initialize chat history for this room if not exists.
    if (!chats[roomId]) {
      chats[roomId] = [];
    }
    socket.emit("init-chat", chats[roomId]);
    console.log(`${socket.id} joined chat room ${roomId}`);
  });

  // Movement events remain unchanged.
  socket.on("move", ({ x, y }) => {
    const lobbyId = socket.data.lobbyId;
    if (!lobbies[lobbyId]) return;
    const user = lobbies[lobbyId][socket.id] || {};
    lobbies[lobbyId][socket.id] = { ...user, x, y };
    socket.to(lobbyId).emit("user-moved", { id: socket.id, x, y });
  });

  // Update name event.
  socket.on("update-name", ({ name }) => {
    const lobbyId = socket.data.lobbyId;
    if (!lobbyId || !lobbies[lobbyId]) return;
    const user = lobbies[lobbyId][socket.id] || {};
    lobbies[lobbyId][socket.id] = { ...user, name };
    io.to(lobbyId).emit("name-updated", { id: socket.id, name });
    console.log(`${socket.id} updated name to: ${name}`);
  });

  // Chat send-message event.
  socket.on("send-message", ({ message, name, roomId }) => {
    const lobbyId = socket.data.lobbyId;
    if (!roomId) return;
    if (!chats[roomId]) {
      chats[roomId] = [];
    }
    const newMsg = {
      name: name || "Anonymous",
      message,
      time: new Date().toISOString(),
    };
    chats[roomId].push(newMsg);
    io.to(roomId).emit("new-message", newMsg);
  });

  // Clear chat event.
  socket.on("clear-chat", ({ roomId }) => {
    if (chats[roomId]) {
      chats[roomId] = [];
    }
    io.to(roomId).emit("clear-chat");
    console.log(`Chat cleared in room ${roomId}`);
  });

  socket.on("disconnect", () => {
    const lobbyId = socket.data.lobbyId;
    if (lobbyId && lobbies[lobbyId]) {
      delete lobbies[lobbyId][socket.id];
      socket.to(lobbyId).emit("user-left", { id: socket.id });
    }
    console.log("User disconnected:", socket.id);
  });
});

server.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});
