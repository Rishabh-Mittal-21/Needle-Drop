// SOCKET: 3001
// CLIENT: 3000

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

 // Store users per lobby
const lobbies = {};

io.on("connection", (socket) => {
  socket.on("join-lobby", ({ lobbyId }) => {
    socket.join(lobbyId);
    socket.data.lobbyId = lobbyId;

    if (!lobbies[lobbyId]) lobbies[lobbyId] = {};
    lobbies[lobbyId][socket.id] = { x: 100, y: 100 };

    socket.emit("init-users", lobbies[lobbyId]);
    socket.to(lobbyId).emit("user-joined", { id: socket.id });

    console.log(`${socket.id} joined lobby ${lobbyId}`);
  });

  socket.on("move", ({ x, y }) => {
    const lobbyId = socket.data.lobbyId;
    if (!lobbies[lobbyId]) return;

    lobbies[lobbyId][socket.id] = { x, y };
    socket.to(lobbyId).emit("user-moved", { id: socket.id, x, y });
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
