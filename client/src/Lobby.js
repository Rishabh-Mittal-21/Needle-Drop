// Imports
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import socket from "./socket";

// Rooms
const zones = {
  room1: { name: "Room 1", x: 50, y: 50, w: 150, h: 150, color: "#fcd5ce" },
  room2: { name: "Room 2", x: 250, y: 50, w: 150, h: 150, color: "#d0f4de" },
  room3: { name: "Room 3", x: 450, y: 50, w: 150, h: 150, color: "#caffbf" },
  global: { name: "Global Radio", x: 50, y: 250, w: 550, h: 200, color: "#a0c4ff" },
};

// Interactive lobby component
export default function Lobby() {
  const { lobbyId } = useParams();
  const navigate = useNavigate();
  const [users, setUsers] = useState({});
  const [myId, setMyId] = useState(null);

  useEffect(() => {
    if (socket.connected) {
      socket.disconnect();
    }

    socket.connect();

    // Adds socket instance
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

    // Track initial users
    socket.on("init-users", (usersFromServer) => {
      console.log("[CLIENT] Received init-users:", usersFromServer);
      setUsers((prev) => ({
        ...usersFromServer,
        ...prev
      }));
    });

    // Track new users joining
    socket.on("user-joined", ({ id, position }) => {
      console.log("[CLIENT] Received user-joined:", id, position);
      setUsers((prev) => ({
        ...prev,
        [id]: position
      }));
    });

    // Track movement
    socket.on("user-moved", ({ id, x, y }) => {
      setUsers((prev) => ({
        ...prev,
        [id]: { ...(prev[id] || {}), x, y }
      }));
    });

    // Track disconnect
    socket.on("user-left", ({ id }) => {
      console.log("[CLIENT] User left:", id);
      setUsers((prev) => ({
        ...prev,
        [id]: { ...(prev[id] || { x: 100, y: 100 }), leaving: true }
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

  // Handle key events for movement
  useEffect(() => {
    const handleKey = (e) => {
      if (!myId) return;

      if (
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        // Prevent default scrolling behavior
        e.preventDefault();
      }

      setUsers((prev) => {
        const me = prev[myId] || { x: 100, y: 100 };
        let { x, y } = me;

        if (e.key === "ArrowUp") y -= 10;
        if (e.key === "ArrowDown") y += 10;
        if (e.key === "ArrowLeft") x -= 10;
        if (e.key === "ArrowRight") x += 10;

        socket.emit("move", { x, y });
        return { ...prev, [myId]: { x, y } };
      });
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [myId]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#acd5ce",
        fontFamily: "'Press Start 2P', monospace"
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
          fontFamily: "'Press Start 2P', monospace"
        }}
      >
        ← Go Back
      </button>

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
            fontFamily: "'Press Start 2P', monospace",
            textAlign: "center",
            padding: "4px"
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
              transition: "background-color 0.3s ease, opacity 0.3s ease"
            }}
          />
        );
      })}
    </div>
  );
}
