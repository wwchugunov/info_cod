import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar";
import api from "../services/api";
import { clearTokens, getRefreshToken } from "../services/auth";

export default function Settings() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const saveProfile = async () => {
    setSaving(true);
    setStatus("");
    try {
      await api.patch("/admin/auth/profile", {
        name: form.name,
        email: form.email,
        password: form.password,
      });
      setStatus("Дані оновлено. Увійдіть знову.");
      clearTokens();
    } catch (err) {
      const message =
        err?.response?.data?.message || "Не вдалося оновити профіль";
      setStatus(message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await api.post("/admin/auth/logout", { refresh_token: refreshToken });
      } catch (err) {
        // ignore logout errors
      }
    }
    clearTokens();
    navigate("/login", { replace: true });
  };

  return (
    <div className="main-area">
      <Topbar title="Налаштування" subtitle="Доступ і конфігурація" />
      <div className="section" style={{ marginBottom: 16 }}>
        <div className="section-header">
          <strong>Профіль</strong>
        </div>
        <div className="filter-row">
          <input
            className="input"
            placeholder="Ім'я"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="input"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            className="input"
            placeholder="Новий пароль"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <button className="button" onClick={saveProfile} disabled={saving}>
            {saving ? "Збереження..." : "Зберегти"}
          </button>
        </div>
        {status ? <p className="form-hint">{status}</p> : null}
      </div>
      <div className="section">
        <div className="section-header">
          <strong>Сесія</strong>
        </div>
        <p style={{ color: "#6e6a67" }}>
          Для виходу з панелі очистьте токени.
        </p>
        <button className="button secondary" onClick={handleLogout}>
          Вийти
        </button>
      </div>
    </div>
  );
}
