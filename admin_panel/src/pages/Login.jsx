import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { setTokens } from "../services/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const res = await api.post("/admin/auth/login", {
        email,
        password,
      });
      setTokens({
        access_token: res.data.access_token,
        refresh_token: res.data.refresh_token,
      });
      navigate("/dashboard");
    } catch (err) {
      setError("Невірні дані для входу");
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h2>Вхід</h2>
        <form onSubmit={handleSubmit}>
          <input
            className="input"
            style={{ width: "100%", marginBottom: 12 }}
            placeholder="Е-пошта"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input"
            type="password"
            style={{ width: "100%", marginBottom: 12 }}
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? (
            <div style={{ color: "#b3261e", marginBottom: 12 }}>{error}</div>
          ) : null}
          <button className="button" type="submit">
            Увійти
          </button>
        </form>
      </div>
    </div>
  );
}
