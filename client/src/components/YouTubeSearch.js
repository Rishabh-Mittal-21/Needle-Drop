// components/YouTubeSearch.js
import React, { useState } from "react";

export default function YouTubeSearch({ onVideoSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  const API_KEY = "AIzaSyBzHzLIWmHNOH2xONrEXF7D4vQZpnN3qNA";

  const handleSearch = async () => {
    if (!query) return;
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(
          query
        )}&maxResults=10&key=${API_KEY}`
      );
      const data = await response.json();
      setResults(data.items || []);
    } catch (error) {
      console.error("YouTube search error:", error);
    }
  };

  const handleKeyDown = async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // If there are already results, automatically select the first one.
      if (results.length > 0) {
        onVideoSelect(results[0]);
        // Clear query and results after selection.
        setQuery("");
        setResults([]);
      } else {
        await handleSearch();
      }
    }
  };

  return (
    <div
      style={{
        backgroundColor: "#fff",
        padding: "10px",
        borderRadius: "8px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
        maxHeight: "400px",
        overflowY: "auto",
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <div style={{ marginBottom: "10px" }}>
        <input
          type="text"
          placeholder="Search YouTube..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            width: "70%",
            padding: "8px",
            fontFamily: "'Poppins', sans-serif",
            fontSize: "14px",
            marginRight: "10px",
            borderRadius: "6px",
            border: "1px solid #ccc",
          }}
        />
        <button
          onClick={handleSearch}
          style={{
            backgroundColor: "#FF6BBA",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            padding: "8px 16px",
            fontFamily: "'Poppins', sans-serif",
            fontSize: "14px",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => (e.target.style.backgroundColor = "#ff8cc7")}
          onMouseLeave={(e) => (e.target.style.backgroundColor = "#FF6BBA")}
        >
          Search
        </button>
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {results.map((video) => (
          <li
            key={video.id.videoId}
            onClick={() => {
              onVideoSelect(video);
              setQuery("");
              setResults([]);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "5px",
              cursor: "pointer",
              borderBottom: "1px solid #eee",
            }}
          >
            <img
              src={video.snippet.thumbnails.default.url}
              alt={video.snippet.title}
              style={{ marginRight: "10px" }}
            />
            <span
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: "14px",
              }}
            >
              {video.snippet.title}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
