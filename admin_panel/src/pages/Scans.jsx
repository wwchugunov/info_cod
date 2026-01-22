import { useEffect, useState } from "react";
import api from "../services/api";
import Topbar from "../components/Topbar";
import { formatDateTime } from "../utils/date";

export default function Scans() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({
    company_id: "",
    from: "",
    to: "",
  });
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [uniqueCount, setUniqueCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const limit = 50;
  const totalPages = total ? Math.ceil(total / limit) : 1;

  const buildParams = () => {
    const base = Object.fromEntries(
      Object.entries({ ...filters, page, limit }).filter(([, value]) => value)
    );
    if (typeFilter === "unique") {
      base.is_duplicate = "false";
    } else if (typeFilter === "duplicate") {
      base.is_duplicate = "true";
    }
    return base;
  };

  const load = () => {
    api
      .get("/admin/scan-history", { params: buildParams() })
      .then((res) => {
        setItems(res.data.items || []);
        setTotal(res.data.total || 0);
        setUniqueCount(res.data.unique_count || 0);
        setDuplicateCount(res.data.duplicate_count || 0);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
        setUniqueCount(0);
        setDuplicateCount(0);
      });
  };

  useEffect(() => {
    load();
  }, [page]);

  const applyFilters = () => {
    if (page !== 1) {
      setPage(1);
      return;
    }
    load();
  };

  return (
    <div className="main-area">
      <Topbar title="Сканування" subtitle="Історія сканувань платежів" />
      <div className="section">
        <div className="filter-row">
          <input
            className="input"
            placeholder="ID компанії"
            value={filters.company_id}
            onChange={(e) =>
              setFilters({ ...filters, company_id: e.target.value })
            }
          />
          <input
            className="input"
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
          <input
            className="input"
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
          <select
            className="input"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Усі сканування</option>
            <option value="unique">Унікальні</option>
            <option value="duplicate">Повторні</option>
          </select>
          <button className="button" onClick={applyFilters}>
            Застосувати
          </button>
        </div>
        <div style={{ marginBottom: 8, color: "#6e6a67" }}>
          Унікальних сканувань: {uniqueCount} • Повторних: {duplicateCount}
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Компанія</th>
                <th>Платіж</th>
                <th>Link ID</th>
                <th>IP</th>
                <th>Платформа</th>
                <th>Пристрій</th>
                <th>UA</th>
                <th>Тип</th>
                <th>Створено</th>
              </tr>
            </thead>
            <tbody>
              {items.map((h) => (
                <tr key={h.id}>
                  <td>{h.id}</td>
                  <td>
                    {h.company_name
                      ? `${h.company_name} (#${h.company_id})`
                      : h.company_id || "—"}
                  </td>
                  <td>{h.payment_id || "—"}</td>
                  <td>{h.link_id || "—"}</td>
                  <td>{h.client_ip || "—"}</td>
                  <td>{h.platform || "—"}</td>
                  <td>{h.device || "—"}</td>
                  <td style={{ maxWidth: 240, wordBreak: "break-all" }}>
                    {h.user_agent || "—"}
                  </td>
                  <td>
                    <span className="badge">
                      {h.is_duplicate ? "Повторне" : "Унікальне"}
                    </span>
                  </td>
                  <td>{formatDateTime(h.created_at || h.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button
            className="button secondary"
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={page === 1}
          >
            Назад
          </button>
          <button
            className="button"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={page >= totalPages}
          >
            Далі
          </button>
          <div style={{ color: "#6e6a67", alignSelf: "center" }}>
            Всього: {total}
          </div>
        </div>
      </div>
    </div>
  );
}
