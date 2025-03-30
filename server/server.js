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
    origin: "http://localhost:3000", // or your client origin
    methods: ["GET", "POST"],
  },
});

// Store users per lobby: { [lobbyId]: { [socketId]: { x, y, name } } }
const lobbies = {};

// Store chats per lobby: { [lobbyId]: [ { name, message, time }, ... ] }
const chats = {};

io.on("connection", (socket) => {
  // On join-lobby
  socket.on("join-lobby", ({ lobbyId }) => {
    socket.join(lobbyId);
    socket.data.lobbyId = lobbyId;

    // Initialize user object if needed
    if (!lobbies[lobbyId]) {
      lobbies[lobbyId] = {};
    }
    lobbies[lobbyId][socket.id] = { x: 100, y: 100, name: "" };

    // Initialize chat array if needed
    if (!chats[lobbyId]) {
      chats[lobbyId] = [];
    }

    // Send the current users to the newly joined client
    socket.emit("init-users", lobbies[lobbyId]);

    // Send the existing chat history to the newly joined client
    socket.emit("init-chat", chats[lobbyId]);

    // Let others in the lobby know someone joined
    socket.to(lobbyId).emit("user-joined", {
      id: socket.id,
      position: { x: 100, y: 100 },
    });

    console.log(`${socket.id} joined lobby ${lobbyId}`);
  });

  // Movement
  socket.on("move", ({ x, y }) => {
    const lobbyId = socket.data.lobbyId;
    if (!lobbies[lobbyId]) return;
    const user = lobbies[lobbyId][socket.id] || {};
    lobbies[lobbyId][socket.id] = { ...user, x, y };
    socket.to(lobbyId).emit("user-moved", { id: socket.id, x, y });
  });

  // Update name
  socket.on("update-name", ({ name }) => {
    const lobbyId = socket.data.lobbyId;
    if (!lobbyId || !lobbies[lobbyId]) return;

    const user = lobbies[lobbyId][socket.id] || {};
    lobbies[lobbyId][socket.id] = { ...user, name };

    // Broadcast the updated name
    io.to(lobbyId).emit("name-updated", { id: socket.id, name });
    console.log(`${socket.id} updated name to: ${name}`);
  });

  // Chat: send-message
  socket.on("send-message", ({ message, name }) => {
    const lobbyId = socket.data.lobbyId;
    if (!lobbyId) return;
    if (!chats[lobbyId]) {
      chats[lobbyId] = [];
    }

    const newMsg = {
      name: name || "Anonymous",
      message,
      time: new Date().toISOString(),
    };

    // Add to server chat log
    chats[lobbyId].push(newMsg);

    // Broadcast to all in lobby
    io.to(lobbyId).emit("new-message", newMsg);
  });

  // Disconnect
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
