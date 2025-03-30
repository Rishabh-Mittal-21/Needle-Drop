// components/MusicPanel.js
import React, { useState, useRef, useEffect, useReducer } from "react";
import YouTubeSearch from "./YouTubeSearch";

// Helper: Determine if a URL is a YouTube link.
const isYouTubeUrl = (url) =>
  /(?:youtube\.com\/.*v=|youtu\.be\/)([^&]+)/.test(url);

// Helper: Format time (in seconds) to mm:ss.
const formatTime = (time) => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
};

// --- Reducer for room queue state ---
const initialQueueState = {
  currentSong: null,
  mainQueue: [],
  pendingQueue: [],
};

// Safe parse function for localStorage state.
const safeParse = (stored) => {
  try {
    const parsed = JSON.parse(stored);
    return {
      currentSong: parsed.currentSong || null,
      mainQueue: Array.isArray(parsed.mainQueue) ? parsed.mainQueue : [],
      pendingQueue: Array.isArray(parsed.pendingQueue) ? parsed.pendingQueue : [],
    };
  } catch (e) {
    console.error("Failed to parse stored state", e);
    return initialQueueState;
  }
};

function queueReducer(state, action) {
  switch (action.type) {
    case "ADD_SONG":
      return {
        ...state,
        pendingQueue: [...state.pendingQueue, action.payload],
      };
    case "VOTE_SONG": {
      const { songId, voteDelta } = action;
      let newMainQueue = state.mainQueue;
      const newPendingQueue = state.pendingQueue
        .map((song) => {
          if (song.id === songId) {
            const updatedVotes = song.votes + voteDelta;
            // Adjust threshold as desired.
            if (updatedVotes >= 2) {
              newMainQueue = [...state.mainQueue, { ...song, votes: updatedVotes }];
              return null;
            } else if (updatedVotes <= -2) {
              return null;
            } else {
              return { ...song, votes: updatedVotes };
            }
          }
          return song;
        })
        .filter((song) => song !== null);
      return {
        ...state,
        pendingQueue: newPendingQueue,
        mainQueue: newMainQueue,
      };
    }
    case "NEXT_SONG": {
      if (state.mainQueue.length > 0) {
        return {
          ...state,
          currentSong: state.mainQueue[0],
          mainQueue: state.mainQueue.slice(1),
        };
      } else {
        return { ...state, currentSong: null };
      }
    }
    case "SET_STATE":
      return action.payload;
    default:
      return state;
  }
}

//////////////////////
// Global Music Panel
//////////////////////
function GlobalMusicPanel({ lobbyId }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 227.5,
        right: 10,
        width: "650px",
        height: "370px",
        backgroundColor: "#fff",
        borderRadius: "10px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        overflow: "hidden",
      }}
    >
      <iframe
        width="100%"
        height="100%"
        src="https://www.youtube-nocookie.com/embed/jfKfPfyJRdk?autoplay=1"
        title="Main Radio"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

//////////////////////////
// Room YouTube Player
//////////////////////////
function RoomYTPlayer({ videoUrl, roomKey, onEnded }) {
  const playerRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

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
      const dur = event.target.getDuration();
      setDuration(dur);
    }

    function onPlayerStateChange(event) {
      // Force playback if paused.
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
        videoId: extractVideoId(videoUrl),
        playerVars: {
          autoplay: 1,
          controls: 0,
          start: elapsed,
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
        },
      });
    }

    function extractVideoId(url) {
      const regExp = /(?:youtube\.com\/.*v=|youtu\.be\/)([^&]+)/;
      const match = url.match(regExp);
      return match ? match[1] : "";
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

    // Periodic re-sync every 10 seconds.
    const syncInterval = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.seekTo === "function") {
        const stored = localStorage.getItem(startKey);
        if (stored) {
          const offset = Math.floor(Date.now() / 1000 - parseFloat(stored));
          playerRef.current.seekTo(offset, true);
        }
      }
    }, 10000);

    const interval = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        setCurrentTime(playerRef.current.getCurrentTime());
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(syncInterval);
    };
  }, [videoUrl, roomKey, onEnded]);

  return (
    <div style={{ position: "relative", width: "600px", height: "338px" }}>
      <div id={`room-player-${roomKey}`} style={{ width: "100%", height: "100%" }}></div>
      {/* Invisible overlay to block interactions */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 1000,
          backgroundColor: "transparent",
          pointerEvents: "all",
        }}
      />
      <div style={{ marginTop: "5px" }}>
        <div
          style={{
            width: "100%",
            height: "6px",
            backgroundColor: "#eee",
            borderRadius: "3px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: duration ? `${(currentTime / duration) * 100}%` : "0%",
              height: "100%",
              backgroundColor: "#FF6BBA",
            }}
          ></div>
        </div>
        <div style={{ fontSize: "12px", textAlign: "right", color: "#666" }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
    </div>
  );
}

//////////////////////////
// Room Music Panel
//////////////////////////
function RoomMusicPanel({ zone, lobbyId, myId }) {
  const roomKey = `roomQueue-${lobbyId}-${zone}`;
  const votedKey = `votedSongs-${roomKey}-${myId || "anonymous"}`;

  const [state, dispatch] = useReducer(
    queueReducer,
    initialQueueState,
    () => {
      const stored = localStorage.getItem(roomKey);
      return stored ? safeParse(stored) : initialQueueState;
    }
  );
  const { currentSong, mainQueue, pendingQueue } = state;

  const [votedSongs, setVotedSongs] = useState({});
  const [newSongUrl, setNewSongUrl] = useState("");
  const [newSongTitle, setNewSongTitle] = useState("");
  const [audioProgress, setAudioProgress] = useState({ current: 0, duration: 0 });
  const audioRef = useRef(null);

  // Auto-start next song if none is playing.
  useEffect(() => {
    if (!currentSong && mainQueue.length > 0) {
      dispatch({ type: "NEXT_SONG" });
    }
  }, [currentSong, mainQueue]);

  // Save state to localStorage on change.
  useEffect(() => {
    localStorage.setItem(roomKey, JSON.stringify(state));
  }, [state, roomKey]);

  // Listen for storage events to sync state across instances.
  useEffect(() => {
    const handler = (e) => {
      if (e.key === roomKey && e.newValue) {
        try {
          const newState = JSON.parse(e.newValue);
          if (JSON.stringify(newState) !== JSON.stringify(state)) {
            dispatch({ type: "SET_STATE", payload: newState });
          }
        } catch (err) {
          console.error("Storage event parse error", err);
        }
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [roomKey, state]);

  // Manage voted songs state.
  useEffect(() => {
    const storedVotes = localStorage.getItem(votedKey);
    if (storedVotes) {
      try {
        setVotedSongs(JSON.parse(storedVotes));
      } catch (e) {
        console.error("Failed to parse votes", e);
      }
    }
  }, [votedKey]);

  useEffect(() => {
    localStorage.setItem(votedKey, JSON.stringify(votedSongs));
  }, [votedSongs, votedKey]);

  // Autoplay for non-YouTube songs.
  useEffect(() => {
    if (currentSong && !isYouTubeUrl(currentSong.url) && audioRef.current) {
      audioRef.current.src = currentSong.url;
      audioRef.current.play().catch((err) =>
        console.error("Audio autoplay blocked by browser", err)
      );
    }
  }, [currentSong]);

  // For YouTube songs, set a start time once.
  useEffect(() => {
    if (currentSong && isYouTubeUrl(currentSong.url)) {
      const startKey = `roomSongStartTime-${roomKey}`;
      if (!localStorage.getItem(startKey)) {
        localStorage.setItem(startKey, Date.now() / 1000);
      }
    }
  }, [currentSong, roomKey]);

  const handleSongEnd = () => {
    dispatch({ type: "NEXT_SONG" });
    localStorage.removeItem(`roomSongStartTime-${roomKey}`);
  };

  const handleAddSong = () => {
    if (!newSongUrl || !newSongTitle) return;
    const newSong = {
      id: Date.now(),
      title: newSongTitle,
      url: newSongUrl,
      votes: 0,
    };
    dispatch({ type: "ADD_SONG", payload: newSong });
    setNewSongUrl("");
    setNewSongTitle("");
  };

  const handleVoteYes = (songId) => {
    if (votedSongs[songId]) return;
    setVotedSongs((prev) => ({ ...prev, [songId]: true }));
    dispatch({ type: "VOTE_SONG", songId, voteDelta: 1 });
  };

  const handleVoteNo = (songId) => {
    if (votedSongs[songId]) return;
    setVotedSongs((prev) => ({ ...prev, [songId]: true }));
    dispatch({ type: "VOTE_SONG", songId, voteDelta: -1 });
  };

  const handleVideoSelect = (video) => {
    const url = `https://www.youtube.com/watch?v=${video.id.videoId}`;
    setNewSongUrl(url);
    setNewSongTitle(video.snippet.title);
  };

  const containerStyle = {
    position: "absolute",
    top: 120,
    right: 10,
    width: "600px",
    backgroundColor: "#fff",
    padding: "20px",
    borderRadius: "15px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
    maxHeight: "80vh",
    overflowY: "auto",
    fontFamily: "'Poppins', sans-serif",
    color: "#333",
  };

  return (
    <div style={containerStyle}>
      <h3 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "10px", color: "#FF6BBA" }}>
        Now Playing
      </h3>
      {currentSong ? (
        <div style={{ marginBottom: "20px" }}>
          <p style={{ fontSize: "16px", fontWeight: 500 }}>{currentSong.title}</p>
          {isYouTubeUrl(currentSong.url) ? (
            <RoomYTPlayer
              key={currentSong.id}
              videoUrl={currentSong.url}
              roomKey={roomKey}
              onEnded={handleSongEnd}
            />
          ) : (
            <>
              <audio
                ref={audioRef}
                onEnded={handleSongEnd}
                controls
                autoPlay
                onTimeUpdate={(e) => {
                  const curr = e.target.currentTime;
                  const dur = e.target.duration;
                  setAudioProgress({ current: curr, duration: dur });
                }}
                style={{ width: "100%", marginTop: "10px" }}
              />
              {audioProgress.duration > 0 && (
                <div style={{ marginTop: "5px" }}>
                  <div
                    style={{
                      width: "100%",
                      height: "6px",
                      backgroundColor: "#eee",
                      borderRadius: "3px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${(audioProgress.current / audioProgress.duration) * 100}%`,
                        height: "100%",
                        backgroundColor: "#FF6BBA",
                      }}
                    ></div>
                  </div>
                  <div style={{ fontSize: "12px", textAlign: "right", color: "#666" }}>
                    {formatTime(audioProgress.current)} / {formatTime(audioProgress.duration)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <p style={{ fontSize: "14px" }}>No song is playing.</p>
      )}

      <h3 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "10px", color: "#FF6BBA" }}>
        Main Queue
      </h3>
      {mainQueue.length === 0 ? (
        <p style={{ fontSize: "14px" }}>The main queue is empty.</p>
      ) : (
        <ul style={{ paddingLeft: "20px", marginBottom: "20px", fontSize: "14px" }}>
          {mainQueue.map((song) => (
            <li key={song.id} style={{ marginBottom: "5px" }}>{song.title}</li>
          ))}
        </ul>
      )}

      <h3 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "10px", color: "#FF6BBA" }}>
        Pending Queue
      </h3>
      {pendingQueue.length === 0 ? (
        <p style={{ fontSize: "14px" }}>No pending songs.</p>
      ) : (
        <ul style={{ paddingLeft: "20px", marginBottom: "20px", fontSize: "14px" }}>
          {pendingQueue.map((song) => (
            <li key={song.id} style={{ marginBottom: "8px" }}>
              <span>
                {song.title} (<strong>{song.votes}</strong> votes)
              </span>
              <button
                onClick={() => handleVoteYes(song.id)}
                disabled={votedSongs[song.id]}
                style={{
                  marginLeft: "10px",
                  backgroundColor: "#FFA4D3",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "6px 12px",
                  fontSize: "14px",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => (e.target.style.backgroundColor = "#ff8cc7")}
                onMouseLeave={(e) => (e.target.style.backgroundColor = "#FFA4D3")}
              >
                Yes
              </button>
              <button
                onClick={() => handleVoteNo(song.id)}
                style={{
                  marginLeft: "10px",
                  backgroundColor: "#FFCCDD",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "6px 12px",
                  fontSize: "14px",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => (e.target.style.backgroundColor = "#ffb3cf")}
                onMouseLeave={(e) => (e.target.style.backgroundColor = "#FFCCDD")}
              >
                No
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "10px", color: "#FF6BBA" }}>
        Add a Song
      </h3>
      <div
        style={{
          backgroundColor: "#FDF6F0",
          border: "2px solid #FFD1E6",
          borderRadius: "10px",
          padding: "15px",
          marginBottom: "20px",
          textAlign: "center",
        }}
      >
        <YouTubeSearch onVideoSelect={handleVideoSelect} />
      </div>
      <div style={{ marginBottom: "10px", display: "flex", flexWrap: "wrap", gap: "10px" }}>
        <input
          type="text"
          placeholder="Song Title"
          value={newSongTitle}
          onChange={(e) => setNewSongTitle(e.target.value)}
          style={{
            fontSize: "14px",
            padding: "6px 10px",
            borderRadius: "8px",
            border: "1px solid #ddd",
            flex: "1 1 40%",
          }}
        />
        <input
          type="text"
          placeholder="Song URL"
          value={newSongUrl}
          onChange={(e) => setNewSongUrl(e.target.value)}
          style={{
            fontSize: "14px",
            padding: "6px 10px",
            borderRadius: "8px",
            border: "1px solid #ddd",
            flex: "1 1 40%",
          }}
        />
      </div>
      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={handleAddSong}
          style={{
            backgroundColor: "#28a745",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "6px 12px",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
          }}
          onMouseEnter={(e) => (e.target.style.backgroundColor = "#218838")}
          onMouseLeave={(e) => (e.target.style.backgroundColor = "#28a745")}
        >
          Add Song
        </button>
      </div>
    </div>
  );
}

export default function MusicPanel({ zone, lobbyId, myId }) {
  return zone === "global" ? (
    <GlobalMusicPanel lobbyId={lobbyId} />
  ) : (
    <RoomMusicPanel zone={zone} lobbyId={lobbyId} myId={myId} />
  );
}
