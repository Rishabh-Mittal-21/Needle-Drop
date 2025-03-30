// components/MusicPanel.js
import React, { useState, useRef, useEffect } from "react";

// Helper: Determine if a URL is a YouTube link.
const isYouTubeUrl = (url) =>
  /(?:youtube\.com\/.*v=|youtu\.be\/)([^&]+)/.test(url);

// Positioned at top: 120px to provide space below the Lobby logo.
function GlobalMusicPanel({ lobbyId }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 120,
        right: 10,
        width: "800px",
        height: "450px",
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
      {/* Invisible overlay to disable user interaction */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 1000,
          backgroundColor: "transparent",
        }}
        onClick={(e) => e.preventDefault()}
      />
    </div>
  );
}

// ROOM YOUTUBE PLAYER for room songs.
function RoomYTPlayer({ videoUrl, roomKey, onEnded }) {
  const playerRef = useRef(null);

  useEffect(() => {
    const startKey = `roomSongStartTime-${roomKey}`;
    let storedTime = localStorage.getItem(startKey);
    if (!storedTime) {
      storedTime = Date.now() / 1000;
      localStorage.setItem(startKey, storedTime);
    } else {
      storedTime = parseFloat(storedTime);
    }
    const elapsed = Math.floor(Date.now() / 1000 - storedTime);

    function onPlayerReady(event) {
      if (typeof event.target.seekTo === "function") {
        event.target.seekTo(elapsed, true);
        event.target.playVideo();
      }
    }

    function onPlayerStateChange(event) {
      if (
        event.data === window.YT.PlayerState.PAUSED &&
        playerRef.current &&
        typeof playerRef.current.playVideo === "function"
      ) {
        playerRef.current.playVideo();
      }
      if (event.data === window.YT.PlayerState.ENDED) {
        onEnded();
      }
    }

    function createPlayer() {
      if (!window.YT || !window.YT.Player) {
        setTimeout(createPlayer, 500);
        return;
      }
      playerRef.current = new window.YT.Player(`room-player-${roomKey}`, {
        videoId: (() => {
          const regExp = /(?:youtube\.com\/.*v=|youtu\.be\/)([^&]+)/;
          const match = videoUrl.match(regExp);
          return match ? match[1] : "";
        })(),
        playerVars: {
          autoplay: 1,
          controls: 0, // disable controls so users cannot pause the video
          start: elapsed,
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
        },
      });
    }

    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = createPlayer;
    } else {
      createPlayer();
    }

    // Prevent spacebar from pausing.
    const handleKeyDown = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (playerRef.current && typeof playerRef.current.playVideo === "function") {
          playerRef.current.playVideo();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [videoUrl, roomKey, onEnded]);

  return (
    <div style={{ position: "relative", width: "600px", height: "338px" }}>
      <div
        id={`room-player-${roomKey}`}
        style={{ width: "100%", height: "100%" }}
      ></div>
      {/* Invisible overlay to disable interactions */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 1000,
          backgroundColor: "transparent",
        }}
        onClick={(e) => e.preventDefault()}
      />
    </div>
  );
}

// ROOM MUSIC PANEL: Handles "Now Playing", queues, and voting for room songs.
function RoomMusicPanel({ zone, lobbyId, myId }) {
  const roomKey = `roomQueue-${lobbyId}-${zone}`;
  const votedKey = `votedSongs-${roomKey}-${myId || "anonymous"}`;
  const [currentSong, setCurrentSong] = useState(null);
  const [mainQueue, setMainQueue] = useState([]);
  const [pendingQueue, setPendingQueue] = useState([]);
  const [votedSongs, setVotedSongs] = useState({});
  const [newSongUrl, setNewSongUrl] = useState("");
  const [newSongTitle, setNewSongTitle] = useState("");
  const audioRef = useRef(null);

  // Load queue state from localStorage.
  useEffect(() => {
    const stored = localStorage.getItem(roomKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      setCurrentSong(parsed.currentSong);
      setMainQueue(parsed.mainQueue);
      setPendingQueue(parsed.pendingQueue);
    }
  }, [roomKey]);

  // Save queue state to localStorage whenever it changes.
  useEffect(() => {
    const state = { currentSong, mainQueue, pendingQueue };
    localStorage.setItem(roomKey, JSON.stringify(state));
  }, [currentSong, mainQueue, pendingQueue, roomKey]);

  // Sync state across tabs.
  useEffect(() => {
    const handler = (e) => {
      if (e.key === roomKey && e.newValue) {
        const parsed = JSON.parse(e.newValue);
        setCurrentSong(parsed.currentSong);
        setMainQueue(parsed.mainQueue);
        setPendingQueue(parsed.pendingQueue);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [roomKey]);

  // Load the user's vote record from localStorage.
  useEffect(() => {
    const storedVotes = localStorage.getItem(votedKey);
    if (storedVotes) {
      setVotedSongs(JSON.parse(storedVotes));
    }
  }, [votedKey]);

  // Persist the vote record to localStorage.
  useEffect(() => {
    localStorage.setItem(votedKey, JSON.stringify(votedSongs));
  }, [votedSongs, votedKey]);

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

  // Vote Yes: Increase vote count by 1.
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

  // Vote No: Decrease vote count by 1.
  const handleVoteNo = (songId) => {
    if (votedSongs[songId]) return;
    setVotedSongs((prev) => ({ ...prev, [songId]: true }));
    setPendingQueue((prev) =>
      prev
        .map((song) => {
          if (song.id === songId) {
            const updatedVotes = song.votes - 1;
            if (updatedVotes <= -3) {
              return null;
            }
            return { ...song, votes: updatedVotes };
          }
          return song;
        })
        .filter((song) => song !== null)
    );
  };

  // When the current song ends, move to the next song.
  const handleSongEnd = () => {
    if (mainQueue.length > 0) {
      setCurrentSong(mainQueue[0]);
      setMainQueue((mq) => mq.slice(1));
      localStorage.removeItem(`roomSongStartTime-${roomKey}`);
    } else {
      setCurrentSong(null);
      localStorage.removeItem(`roomSongStartTime-${roomKey}`);
    }
  };

  // Auto-load the next song if none is playing.
  useEffect(() => {
    if (!currentSong && mainQueue.length > 0) {
      setCurrentSong(mainQueue[0]);
      setMainQueue((mq) => mq.slice(1));
    }
  }, [mainQueue, currentSong]);

  // For non-YouTube songs.
  useEffect(() => {
    if (currentSong && !isYouTubeUrl(currentSong.url) && audioRef.current) {
      audioRef.current.src = currentSong.url;
      audioRef.current.play().catch((err) =>
        console.error("Audio play error", err)
      );
    }
  }, [currentSong]);

  // For YouTube songs, set a start time if not already set.
  useEffect(() => {
    if (currentSong && isYouTubeUrl(currentSong.url)) {
      const startKey = `roomSongStartTime-${roomKey}`;
      if (!localStorage.getItem(startKey)) {
        localStorage.setItem(startKey, Date.now() / 1000);
      }
    }
  }, [currentSong, roomKey]);

  return (
    <div
      style={{
        position: "absolute",
        top: 120,
        right: 10,
        width: "600px",
        backgroundColor: "#fff",
        padding: "15px",
        borderRadius: "8px",
        maxHeight: "90vh",
        overflowY: "auto",
      }}
    >
      <h3
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "16px",
          margin: "10px 0",
        }}
      >
        Now Playing
      </h3>
      {currentSong ? (
        <div style={{ marginBottom: "15px" }}>
          <p
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: "14px",
            }}
          >
            {currentSong.title}
          </p>
          {isYouTubeUrl(currentSong.url) ? (
            <RoomYTPlayer
              key={currentSong.id}
              videoUrl={currentSong.url}
              roomKey={roomKey}
              onEnded={handleSongEnd}
            />
          ) : (
            <audio
              ref={audioRef}
              onEnded={handleSongEnd}
              controls
              autoPlay
              style={{ width: "100%", marginTop: "5px" }}
            />
          )}
          {!isYouTubeUrl(currentSong.url) &&
            (() => {
              const regExp = /(?:youtube\.com\/.*v=|youtu\.be\/)([^&]+)/;
              const match = currentSong.url.match(regExp);
              return match ? (
                <img
                  src={`https://img.youtube.com/vi/${match[1]}/0.jpg`}
                  alt="thumbnail"
                  style={{
                    width: "100%",
                    height: "auto",
                    marginTop: "10px",
                  }}
                />
              ) : null;
            })()}
        </div>
      ) : (
        <p
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "14px",
          }}
        >
          No song is playing.
        </p>
      )}

      <h3
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "16px",
          margin: "10px 0",
        }}
      >
        Main Queue
      </h3>
      {mainQueue.length === 0 ? (
        <p
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "14px",
          }}
        >
          The main queue is empty.
        </p>
      ) : (
        <ul
          style={{
            paddingLeft: "20px",
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "14px",
          }}
        >
          {mainQueue.map((song) => (
            <li key={song.id}>{song.title}</li>
          ))}
        </ul>
      )}

      <h3
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "16px",
          margin: "10px 0",
        }}
      >
        Pending Queue
      </h3>
      {pendingQueue.length === 0 ? (
        <p
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "14px",
          }}
        >
          No pending songs.
        </p>
      ) : (
        <ul
          style={{
            paddingLeft: "20px",
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "14px",
          }}
        >
          {pendingQueue.map((song) => (
            <li key={song.id} style={{ marginBottom: "8px" }}>
              <span>
                {song.title} ({song.votes} votes)
              </span>
              <button
                onClick={() => handleVoteYes(song.id)}
                disabled={votedSongs[song.id]}
                style={{
                  marginLeft: "5px",
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: "14px",
                }}
              >
                Yes
              </button>
              <button
                onClick={() => handleVoteNo(song.id)}
                style={{
                  marginLeft: "5px",
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: "14px",
                }}
              >
                No
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "16px",
          margin: "10px 0",
        }}
      >
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
            fontSize: "14px",
            marginRight: "10px",
            padding: "5px",
          }}
        />
        <input
          type="text"
          placeholder="Song URL"
          value={newSongUrl}
          onChange={(e) => setNewSongUrl(e.target.value)}
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "14px",
            marginRight: "10px",
            padding: "5px",
          }}
        />
        <button
          onClick={handleAddSong}
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "14px",
            padding: "5px 10px",
          }}
        >
          Add Song
        </button>
      </div>
    </div>
  );
}

// Parent component: Choose panel based on zone.
export default function MusicPanel({ zone, lobbyId, myId }) {
  return zone === "global" ? (
    <GlobalMusicPanel lobbyId={lobbyId} />
  ) : (
    <RoomMusicPanel zone={zone} lobbyId={lobbyId} myId={myId} />
  );
}
