// Basic home page
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();
  return (
    <div style={{ padding: 20 }}>
      <h1>Needle Drop</h1>
      <p>Select a lobby:</p>
      {[1, 2, 3].map((id) => (
        <button key={id} onClick={() => navigate(`/lobby/${id}`)} style={{ margin: 10 }}>
          Enter Lobby {id}
        </button>
      ))}
    </div>
  );
}
