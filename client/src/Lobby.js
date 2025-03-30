// Lobby.js
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import socket from "./socket";
import MusicPanel from "./components/MusicPanel";

// Increase room sizes and adjust positions for layout.
const zones = {
  room1: { name: "Room 1", x: 50, y: 50, w: 250, h: 250, color: "#fcd5ce" },
  room2: { name: "Room 2", x: 350, y: 50, w: 250, h: 250, color: "#d0f4de" },
  room3: { name: "Room 3", x: 650, y: 50, w: 250, h: 250, color: "#caffbf" },
  global: { name: "Global Radio", x: 50, y: 350, w: 850, h: 200, color: "#a0c4ff" },
};

// Use full viewport minus the border thickness (2px) as boundaries.
const BORDER_WIDTH = 2;
const BOUNDS = {
  minX: BORDER_WIDTH,
  minY: BORDER_WIDTH,
  maxX: window.innerWidth - BORDER_WIDTH,
  maxY: window.innerHeight - BORDER_WIDTH,
};

export default function Lobby() {
  const { lobbyId } = useParams();
  const navigate = useNavigate();
  const [users, setUsers] = useState({});
  const [myId, setMyId] = useState(null);
  const [currentZone, setCurrentZone] = useState(null);

  useEffect(() => {
    if (socket.connected) {
      socket.disconnect();
    }
    socket.connect();

    const handleConnect = () => {
      const id = socket.id;
      console.log("[CLIENT] Connected with socket ID:", id);
      setMyId(id);
      setTimeout(() => {
        socket.emit("join-lobby", { lobbyId });
        console.log("[CLIENT] Emitted join-lobby");
      }, 0);
    };

    socket.on("connect", handleConnect);
    socket.on("init-users", (usersFromServer) => {
      console.log("[CLIENT] Received init-users:", usersFromServer);
      setUsers((prev) => ({ ...usersFromServer, ...prev }));
    });
    socket.on("user-joined", ({ id, position }) => {
      console.log("[CLIENT] Received user-joined:", id, position);
      setUsers((prev) => ({ ...prev, [id]: position }));
    });
    socket.on("user-moved", ({ id, x, y }) => {
      setUsers((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), x, y } }));
    });
    socket.on("user-left", ({ id }) => {
      console.log("[CLIENT] User left:", id);
      setUsers((prev) => ({
        ...prev,
        [id]: { ...(prev[id] || { x: 100, y: 100 }), leaving: true },
      }));
      setTimeout(() => {
        setUsers((prev) => {
          const updated = { ...prev };
          delete updated[id];
          console.log("[CLIENT] User removed from view:", id);
          return updated;
        });
      }, 1000);
    });

    return () => {
      console.log("[CLIENT] Cleaning up socket listeners and disconnecting");
      socket.off("connect", handleConnect);
      socket.off("init-users");
      socket.off("user-joined");
      socket.off("user-moved");
      socket.off("user-left");
      socket.disconnect();
    };
  }, [lobbyId]);

  // Movement & key handling within BOUNDS.
  useEffect(() => {
    const keys = new Set();
    let interval = null;
    const move = () => {
      setUsers((prev) => {
        if (!myId) return prev;
        const me = prev[myId] || { x: 100, y: 100 };
        let { x, y } = me;
        if (keys.has("ArrowUp")) y -= 5;
        if (keys.has("ArrowDown")) y += 5;
        if (keys.has("ArrowLeft")) x -= 5;
        if (keys.has("ArrowRight")) x += 5;
        x = Math.max(BOUNDS.minX, Math.min(x, BOUNDS.maxX - 24));
        y = Math.max(BOUNDS.minY, Math.min(y, BOUNDS.maxY - 24));
        socket.emit("move", { x, y });
        return { ...prev, [myId]: { x, y } };
      });
    };

    const handleKeyDown = (e) => {
      if (!e.key.startsWith("Arrow")) return;
      e.preventDefault();
      keys.add(e.key);
      if (!interval) interval = setInterval(move, 30);
    };
    const handleKeyUp = (e) => {
      keys.delete(e.key);
      if (keys.size === 0 && interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      clearInterval(interval);
    };
  }, [myId]);

  // Zone detection based on user position.
  useEffect(() => {
    const me = users[myId];
    if (!me) return;
    const zone = Object.entries(zones).find(([_, z]) => {
      return me.x >= z.x && me.x < z.x + z.w && me.y >= z.y && me.y < z.y + z.h;
    });
    const zoneId = zone?.[0] || null;
    if (zoneId !== currentZone) {
      setCurrentZone(zoneId);
    }
  }, [users, myId, currentZone]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#acd5ce",
        border: `${BORDER_WIDTH}px solid #444`,
        fontFamily: "'Press Start 2P', monospace",
      }}
    >
      <button
        onClick={() => navigate("/")}
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 1000,
          padding: "8px 12px",
          backgroundColor: "#e0e0e0",
          border: "2px solid #888",
          borderRadius: "6px",
          fontSize: "10px",
          cursor: "pointer",
          fontFamily: "'Press Start 2P', monospace",
        }}
      >
        ← Go Back
      </button>
      {/* Enlarged bubbly Lobby logo in the top-right */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 1000,
          padding: "10px 20px",
          backgroundColor: "#fff",
          border: "3px solid #ff69b4",
          borderRadius: "20px",
          fontSize: "32px",
          fontWeight: "bold",
          color: "#ff1493",
          textShadow: "2px 2px #fff",
          fontFamily: "Comic Sans MS, cursive, sans-serif",
        }}
      >
        Lobby #{lobbyId}
      </div>

      {Object.entries(zones).map(([zoneId, zone]) => (
        <div
          key={zoneId}
          style={{
            position: "absolute",
            left: zone.x,
            top: zone.y,
            width: zone.w,
            height: zone.h,
            backgroundColor: zone.color,
            border: "2px dashed #444",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            fontSize: "14px",
            color: "#222",
            textShadow: "1px 1px white",
            textAlign: "center",
            padding: "4px",
          }}
        >
          {zone.name}
        </div>
      ))}

      {Object.entries(users).map(([id, user]) => {
        if (!user || user.x === undefined || user.y === undefined) return null;
        const { x, y, leaving } = user;
        return (
          <div
            key={id}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 24,
              height: 24,
              borderRadius: "50%",
              backgroundColor:
                id === myId ? "#1e90ff" : leaving ? "#ff6b6b" : "#ffa500",
              border: "2px solid white",
              boxShadow: "0 0 6px rgba(0,0,0,0.2)",
              transition: "background-color 0.3s ease, opacity 0.3s ease",
            }}
          />
        );
      })}

      {["room1", "room2", "room3", "global"].includes(currentZone) && (
        <MusicPanel zone={currentZone} lobbyId={lobbyId} key={currentZone} />
      )}
    </div>
  );
}
