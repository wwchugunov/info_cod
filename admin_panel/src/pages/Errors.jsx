import { useEffect, useState } from "react";
import api from "../services/api";
import Topbar from "../components/Topbar";

export default function Errors() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({
    source: "",
    status_code: "",
    from: "",
    to: "",
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const buildParams = () =>
    Object.fromEntries(
      Object.entries({ ...filters, page }).filter(([, value]) => value)
    );

  const load = () => {
    api
      .get("/admin/errors", { params: buildParams() })
      .then((res) => {
        setItems(res.data.items || []);
        setTotal(res.data.total || 0);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
      });
  };

  useEffect(() => {
    load();
  }, [page]);

  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
  };

  return (
    <div className="main-area">
      <Topbar title="Помилки" subtitle="Серверні та клієнтські" />
      <div className="section">
        <div className="filter-row">
          <select
            className="input"
            value={filters.source}
            onChange={(e) => setFilters({ ...filters, source: e.target.value })}
          >
            <option value="">Усі джерела</option>
            <option value="server">Сервер</option>
            <option value="client">Клієнт</option>
          </select>
          <input
            className="input"
            placeholder="HTTP код"
            value={filters.status_code}
            onChange={(e) =>
              setFilters({ ...filters, status_code: e.target.value })
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
          <button className="button" onClick={() => load()}>
            Застосувати
          </button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Час</th>
                <th>Джерело</th>
                <th>Код</th>
                <th>Шлях / URL</th>
                <th>Повідомлення</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{formatDate(item.created_at || item.createdAt)}</td>
                  <td>{item.source}</td>
                  <td>{item.status_code ?? "—"}</td>
                  <td>{item.path || "—"}</td>
                  <td>{item.message}</td>
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
            disabled={items.length === 0}
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
