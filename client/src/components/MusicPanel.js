// components/MusicPanel.js
import React, { useState, useRef, useEffect } from "react";

// GLOBAL RADIO PANEL
// Displays a rectangular YouTube livestream on the right side.
function GlobalMusicPanel({ lobbyId }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 50,
        right: 10,
        width: "400px",
        height: "225px",
        backgroundColor: "#000",
        border: "2px solid #444",
        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
      }}
    >
      <iframe
        width="100%"
        height="100%"
        src="https://www.youtube-nocookie.com/embed/jfKfPfyJRdk?si=umAVeQG3rj0yufQ3&autoplay=1"
        title="Main Radio"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

// ROOM MUSIC PANEL
// Handles "Now Playing", main queue, and pending queue with voting.
// Uses localStorage for persistence and synchronizes across tabs.
// The storage event handler only updates if our current state is empty so that
// a new client does not override the already-established state.
function RoomMusicPanel({ zone, lobbyId }) {
  const roomKey = `roomQueue-${zone}`;
  const [currentSong, setCurrentSong] = useState(null);
  const [mainQueue, setMainQueue] = useState([]);
  const [pendingQueue, setPendingQueue] = useState([]);
  const [votedSongs, setVotedSongs] = useState({});
  const audioRef = useRef(null);
  const [newSongUrl, setNewSongUrl] = useState("");
  const [newSongTitle, setNewSongTitle] = useState("");

  // Load state from localStorage on mount.
  useEffect(() => {
    const stored = localStorage.getItem(roomKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      setCurrentSong(parsed.currentSong);
      setMainQueue(parsed.mainQueue);
      setPendingQueue(parsed.pendingQueue);
    }
  }, [roomKey]);

  // Save state to localStorage whenever queues change.
  useEffect(() => {
    const state = { currentSong, mainQueue, pendingQueue };
    localStorage.setItem(roomKey, JSON.stringify(state));
  }, [currentSong, mainQueue, pendingQueue, roomKey]);

  // Sync state across tabs—but only update if our state is empty.
  useEffect(() => {
    const handler = (e) => {
      if (e.key === roomKey && e.newValue) {
        // Only update if we haven't set any songs yet.
        if (!currentSong && mainQueue.length === 0 && pendingQueue.length === 0) {
          const parsed = JSON.parse(e.newValue);
          setCurrentSong(parsed.currentSong);
          setMainQueue(parsed.mainQueue);
          setPendingQueue(parsed.pendingQueue);
        }
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [roomKey, currentSong, mainQueue, pendingQueue]);

  // Add a new song to the pending queue.
  const handleAddSong = () => {
    if (!newSongUrl || !newSongTitle) return;
    const newSong = {
      id: Date.now(),
      title: newSongTitle,
      url: newSongUrl,
      votes: 0,
    };
    setPendingQueue((prev) => [...prev, newSong]);
    setNewSongUrl("");
    setNewSongTitle("");
  };

  // Vote "Yes" for a pending song (only once per song per user).
  const handleVoteYes = (songId) => {
    if (votedSongs[songId]) return;
    setVotedSongs((prev) => ({ ...prev, [songId]: true }));
    setPendingQueue((prev) =>
      prev
        .map((song) => {
          if (song.id === songId) {
            const updatedVotes = song.votes + 1;
            if (updatedVotes >= 3) {
              setMainQueue((mq) => [...mq, { ...song, votes: updatedVotes }]);
              return null;
            }
            return { ...song, votes: updatedVotes };
          }
          return song;
        })
        .filter((song) => song !== null)
    );
  };

  // "No" vote (optional, currently no action).
  const handleVoteNo = (songId) => {
    // You can implement logic for "No" votes if desired.
  };

  // Advance to the next song when the current one ends.
  const handleSongEnd = () => {
    if (mainQueue.length > 0) {
      setCurrentSong(mainQueue[0]);
      setMainQueue((mq) => mq.slice(1));
    } else {
      setCurrentSong(null);
    }
  };

  // Auto-load next song if none is playing.
  useEffect(() => {
    if (!currentSong && mainQueue.length > 0) {
      setCurrentSong(mainQueue[0]);
      setMainQueue((mq) => mq.slice(1));
    }
  }, [mainQueue, currentSong]);

  // When currentSong changes, load and play it.
  useEffect(() => {
    if (currentSong && audioRef.current) {
      audioRef.current.src = currentSong.url;
      audioRef.current
        .play()
        .catch((err) => console.error("Audio play error", err));
    }
  }, [currentSong]);

  // Helper: extract a YouTube thumbnail URL.
  const extractYouTubeThumbnail = (url) => {
    const regExp = /(?:youtube\.com\/.*v=|youtu\.be\/)([^&]+)/;
    const match = url.match(regExp);
    return match ? `https://img.youtube.com/vi/${match[1]}/0.jpg` : null;
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: 10,
        left: 10,
        right: 10,
        backgroundColor: "#fff",
        padding: "10px",
        borderRadius: "8px",
        maxHeight: "40vh",
        overflowY: "auto",
      }}
    >
      <h3 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "12px" }}>
        Now Playing
      </h3>
      {currentSong ? (
        <div style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
          {extractYouTubeThumbnail(currentSong.url) && (
            <img
              src={extractYouTubeThumbnail(currentSong.url)}
              alt="thumbnail"
              style={{ width: "120px", height: "90px", marginRight: "10px" }} // increased thumbnail size
            />
          )}
          <div>
            <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
              {currentSong.title}
            </p>
            <audio
              ref={audioRef}
              onEnded={handleSongEnd}
              controls
              autoPlay
              style={{ width: "300px", marginTop: "5px" }}
            />
          </div>
        </div>
      ) : (
        <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
          No song is playing.
        </p>
      )}

      <h3 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "12px" }}>
        Main Queue
      </h3>
      {mainQueue.length === 0 ? (
        <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
          The main queue is empty.
        </p>
      ) : (
        <ul
          style={{
            paddingLeft: "20px",
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "10px",
          }}
        >
          {mainQueue.map((song) => (
            <li key={song.id}>{song.title}</li>
          ))}
        </ul>
      )}

      <h3 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "12px" }}>
        Pending Queue
      </h3>
      {pendingQueue.length === 0 ? (
        <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
          No pending songs.
        </p>
      ) : (
        <ul
          style={{
            paddingLeft: "20px",
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "10px",
          }}
        >
          {pendingQueue.map((song) => (
            <li key={song.id} style={{ marginBottom: "5px" }}>
              <span>
                {song.title} ({song.votes} votes)
              </span>
              <button
                onClick={() => handleVoteYes(song.id)}
                disabled={votedSongs[song.id]}
                style={{
                  marginLeft: "5px",
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: "10px",
                }}
              >
                Yes
              </button>
              <button
                onClick={() => handleVoteNo(song.id)}
                style={{
                  marginLeft: "5px",
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: "10px",
                }}
              >
                No
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "12px" }}>
        Add a Song
      </h3>
      <div>
        <input
          type="text"
          placeholder="Song Title"
          value={newSongTitle}
          onChange={(e) => setNewSongTitle(e.target.value)}
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "10px",
            marginRight: "5px",
          }}
        />
        <input
          type="text"
          placeholder="Song URL"
          value={newSongUrl}
          onChange={(e) => setNewSongUrl(e.target.value)}
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "10px",
            marginRight: "5px",
          }}
        />
        <button
          onClick={handleAddSong}
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "10px",
          }}
        >
          Add Song
        </button>
      </div>
    </div>
  );
}

// Parent component that renders the appropriate panel.
export default function MusicPanel({ zone, lobbyId }) {
  return zone === "global" ? (
    <GlobalMusicPanel lobbyId={lobbyId} />
  ) : (
    <RoomMusicPanel zone={zone} lobbyId={lobbyId} />
  );
}
