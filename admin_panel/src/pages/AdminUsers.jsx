import { useEffect, useState } from "react";
import api from "../services/api";
import Topbar from "../components/Topbar";

export default function AdminUsers() {
  const [items, setItems] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "viewer",
    company_id: "",
  });
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get("/admin/admin-users").then((res) => setItems(res.data || []));
  };

  const loadCompanies = () => {
    api
      .get("/admin/companies", { params: { limit: 200 } })
      .then((res) => setCompanies(res.data.items || []))
      .catch(() => setCompanies([]));
  };

  useEffect(() => {
    load();
    loadCompanies();
  }, []);

  const handleCreate = async () => {
    await api.post("/admin/admin-users", {
      ...form,
      company_id: form.company_id ? Number(form.company_id) : null,
    });
    setForm({
      name: "",
      email: "",
      password: "",
      role: "viewer",
      company_id: "",
    });
    load();
  };

  const toggleActive = async (user) => {
    await api.patch(`/admin/admin-users/${user.id}`, {
      is_active: !user.is_active,
    });
    load();
  };

  const openEdit = (user) => {
    setEditing(user);
    setEditForm({
      name: user.name || "",
      email: user.email || "",
      role: user.role || "viewer",
      is_active: Boolean(user.is_active),
      company_id: user.company_id ? String(user.company_id) : "",
      password: "",
    });
  };

  const closeEdit = () => {
    setEditing(null);
    setEditForm(null);
    setSaving(false);
  };

  const updateEditField = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveEdit = async () => {
    if (!editing || !editForm) return;
    setSaving(true);
    await api.patch(`/admin/admin-users/${editing.id}`, {
      name: editForm.name,
      email: editForm.email,
      role: editForm.role,
      is_active: editForm.is_active,
      company_id: editForm.company_id ? Number(editForm.company_id) : null,
    });
    if (editForm.password) {
      await api.post(`/admin/admin-users/${editing.id}/reset-password`, {
        password: editForm.password,
      });
    }
    closeEdit();
    load();
  };

  const companyNameById = companies.reduce((acc, company) => {
    acc[company.id] = company.name;
    return acc;
  }, {});

  return (
    <div className="main-area">
      <Topbar title="Адмін‑користувачі" subtitle="Керування ролями" />
      <div className="section" style={{ marginBottom: 16 }}>
        <div className="section-header">
          <strong>Створити користувача</strong>
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
            placeholder="Пароль"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <select
            className="input"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="viewer">viewer</option>
            <option value="manager">manager</option>
            <option value="admin">admin</option>
            <option value="superadmin">superadmin</option>
          </select>
          <select
            className="input"
            value={form.company_id}
            onChange={(e) => setForm({ ...form, company_id: e.target.value })}
          >
            <option value="">Без компанії</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
          <button className="button" onClick={handleCreate}>
            Створити
          </button>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <strong>Список</strong>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Ім'я</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Компанія</th>
                <th>Активний</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>
                    {user.company_id
                      ? companyNameById[user.company_id] ||
                        `#${user.company_id}`
                      : "—"}
                  </td>
                  <td>{user.is_active ? "Так" : "Ні"}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="button secondary"
                        onClick={() => toggleActive(user)}
                      >
                        {user.is_active ? "Вимкнути" : "Увімкнути"}
                      </button>
                      <button className="button" onClick={() => openEdit(user)}>
                        Редагувати
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editing && editForm ? (
        <div className="modal-backdrop" onClick={closeEdit}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Редагувати користувача</h3>
              <span>ID {editing.id}</span>
            </div>
            <div className="form-grid">
              <label className="field">
                Ім'я
                <input
                  className="input"
                  value={editForm.name}
                  onChange={(e) => updateEditField("name", e.target.value)}
                />
              </label>
              <label className="field">
                Email
                <input
                  className="input"
                  value={editForm.email}
                  onChange={(e) => updateEditField("email", e.target.value)}
                />
              </label>
              <label className="field">
                Роль
                <select
                  className="input"
                  value={editForm.role}
                  onChange={(e) => updateEditField("role", e.target.value)}
                >
                  <option value="viewer">viewer</option>
                  <option value="manager">manager</option>
                  <option value="admin">admin</option>
                  <option value="superadmin">superadmin</option>
                </select>
              </label>
              <label className="field">
                Компанія
                <select
                  className="input"
                  value={editForm.company_id}
                  onChange={(e) => updateEditField("company_id", e.target.value)}
                >
                  <option value="">Без компанії</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field checkbox">
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) =>
                    updateEditField("is_active", e.target.checked)
                  }
                />
                Активний
              </label>
              <label className="field">
                Новий пароль
                <input
                  className="input"
                  type="password"
                  value={editForm.password}
                  onChange={(e) => updateEditField("password", e.target.value)}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button className="button secondary" onClick={closeEdit}>
                Скасувати
              </button>
              <button className="button" onClick={saveEdit} disabled={saving}>
                {saving ? "Збереження..." : "Зберегти"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
