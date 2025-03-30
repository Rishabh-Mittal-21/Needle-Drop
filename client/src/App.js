import { Routes, Route } from "react-router-dom";
import Home from "./Home";
import Lobby from "./Lobby";

// Connects to Home.js
function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/lobby/:lobbyId" element={<Lobby />} />
    </Routes>
  );
}

export default App;
