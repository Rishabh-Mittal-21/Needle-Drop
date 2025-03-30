import React from "react";
import { useNavigate } from "react-router-dom";
import "./Home.css";

export default function Home() {
  const navigate = useNavigate();
  return (
    <div className="home-container">
      <h1 className="home-title">Needle Drop</h1>
      <p className="home-description">Select a lobby:</p>
      <div className="button-container">
        {[1, 2, 3].map((id) => (
          <button
            key={id}
            onClick={() => navigate(`/lobby/${id}`)}
            className="lobby-button"
          >
            Enter Lobby {id}
          </button>
        ))}
      </div>
    </div>
  );
}
