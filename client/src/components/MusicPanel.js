// components/MusicPanel.js
import React, { useState, useRef, useEffect } from "react";

// Helper: Determine if a URL is a YouTube link.
const isYouTubeUrl = (url) =>
  /(?:youtube\.com\/.*v=|youtu\.be\/)([^&]+)/.test(url);

// Helper: Compute an embed URL with a dynamic start parameter.
const getYouTubeEmbedUrlWithStart = (url, elapsed) => {
  const regExp = /(?:youtube\.com\/.*v=|youtu\.be\/)([^&]+)/;
  const match = url.match(regExp);
  return match
    ? `https://www.youtube-nocookie.com/embed/${match[1]}?autoplay=1&start=${elapsed}`
    : "";
};

// GLOBAL RADIO PANEL using YouTube IFrame API for syncing playback.
// This panel is now moved to the right side.
function GlobalMusicPanel({ lobbyId }) {
  const playerRef = useRef(null);

  useEffect(() => {
    let globalStartTime = localStorage.getItem("globalRadioStartTime");
    if (!globalStartTime) {
      globalStartTime = Date.now() / 1000;
      localStorage.setItem("globalRadioStartTime", globalStartTime);
    } else {
      globalStartTime = parseFloat(globalStartTime);
    }

    function onYouTubeIframeAPIReady() {
      if (!window.YT || !window.YT.Player) {
        setTimeout(onYouTubeIframeAPIReady, 500);
        return;
      }
      playerRef.current = new window.YT.Player(`global-player-${lobbyId}`, {
        videoId: "jfKfPfyJRdk",
        playerVars: {
          autoplay: 1,
          controls: 1,
          start: Math.floor(Date.now() / 1000 - globalStartTime),
        },
        events: {
          onReady: (event) => {
            const elapsed = Math.floor(Date.now() / 1000 - globalStartTime);
            if (typeof event.target.seekTo === "function") {
              event.target.seekTo(elapsed, true);
              event.target.playVideo();
            }
          },
        },
      });
    }

    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
    } else {
      onYouTubeIframeAPIReady();
    }
  }, [lobbyId]);

  return (
    <div
      style={{
        position: "absolute",
        top: 50,
        right: 10, // now on the right side
        width: "600px",
        height: "338px",
        backgroundColor: "#000",
        border: "2px solid #444",
        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
      }}
    >
      <div
        id={`global-player-${lobbyId}`}
        style={{ width: "100%", height: "100%" }}
      ></div>
    </div>
  );
}

// RoomYTPlayer: Uses the YouTube IFrame API for room videos.
// It forces playback if paused and synchronizes start time using localStorage.
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
      // If paused, force play.
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
          controls: 0, // disable user controls to prevent pausing
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
    <div
      id={`room-player-${roomKey}`}
      style={{ width: "400px", height: "225px" }}
    ></div>
  );
}

// ROOM RADIO PANEL: Handles "Now Playing", queues, and voting for room songs.
// The panel is moved entirely to the right side.
function RoomMusicPanel({ zone, lobbyId }) {
  const roomKey = `roomQueue-${zone}`;
  const [currentSong, setCurrentSong] = useState(null);
  const [mainQueue, setMainQueue] = useState([]);
  const [pendingQueue, setPendingQueue] = useState([]);
  const [votedSongs, setVotedSongs] = useState({});
  const [newSongUrl, setNewSongUrl] = useState("");
  const [newSongTitle, setNewSongTitle] = useState("");
  const audioRef = useRef(null);

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

  // Always sync state from localStorage.
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

  const handleVoteNo = (songId) => {
    // Optional "No" vote logic.
  };

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

  useEffect(() => {
    if (!currentSong && mainQueue.length > 0) {
      setCurrentSong(mainQueue[0]);
      setMainQueue((mq) => mq.slice(1));
    }
  }, [mainQueue, currentSong]);

  // For non-YouTube songs, use an audio element.
  useEffect(() => {
    if (currentSong && !isYouTubeUrl(currentSong.url) && audioRef.current) {
      audioRef.current.src = currentSong.url;
      audioRef.current.play().catch((err) =>
        console.error("Audio play error", err)
      );
    }
  }, [currentSong]);

  // For YouTube songs, store a start time if not already set.
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
        top: 50,
        right: 10,
        width: "420px",
        backgroundColor: "#fff",
        padding: "10px",
        borderRadius: "8px",
        maxHeight: "90vh",
        overflowY: "auto",
      }}
    >
      <h3 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "12px" }}>
        Now Playing
      </h3>
      {currentSong ? (
        <div style={{ marginBottom: "10px" }}>
          <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
            {currentSong.title}
          </p>
          {isYouTubeUrl(currentSong.url) ? (
            <RoomYTPlayer
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
              style={{ width: "300px", marginTop: "5px" }}
            />
          )}
          {/* For non-YouTube songs, show a thumbnail */}
          {!isYouTubeUrl(currentSong.url) &&
            (() => {
              const regExp = /(?:youtube\.com\/.*v=|youtu\.be\/)([^&]+)/;
              const match = currentSong.url.match(regExp);
              return match ? (
                <img
                  src={`https://img.youtube.com/vi/${match[1]}/0.jpg`}
                  alt="thumbnail"
                  style={{ width: "160px", height: "120px", marginTop: "10px" }}
                />
              ) : null;
            })()}
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
        <ul style={{ paddingLeft: "20px", fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
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
        <ul style={{ paddingLeft: "20px", fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
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

// Parent component: Choose which panel to render based on zone.
export default function MusicPanel({ zone, lobbyId }) {
  return zone === "global" ? (
    <GlobalMusicPanel lobbyId={lobbyId} />
  ) : (
    <RoomMusicPanel zone={zone} lobbyId={lobbyId} />
  );
}
