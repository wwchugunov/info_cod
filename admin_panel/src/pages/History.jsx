import { useEffect, useState } from "react";
import api from "../services/api";
import Topbar from "../components/Topbar";
import { formatDateTime } from "../utils/date";

export default function History({
  title = "Історія",
  subtitle = "Сканування та генерації",
  fixedType = "",
}) {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({
    company_id: "",
    from: "",
    to: "",
    status: "",
  });
  const [typeFilter, setTypeFilter] = useState(fixedType);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;
  const totalPages = total ? Math.ceil(total / limit) : 1;
  const formatMoney = (value) => Number(value || 0).toFixed(2);
  const statusLabels = {
    success: "Успішно",
    failed: "Помилка",
  };
  const formatStatus = (status) => statusLabels[status] || status || "—";
  const effectiveType = fixedType || typeFilter;

  const buildParams = () => {
    const base = Object.fromEntries(
      Object.entries({ ...filters, page, limit }).filter(([, value]) => value)
    );
    if (effectiveType) {
      base.type = effectiveType;
    }
    return base;
  };

  const load = () => {
    api
      .get("/admin/history", { params: buildParams() })
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

  const applyFilters = () => {
    if (page !== 1) {
      setPage(1);
      return;
    }
    load();
  };

  return (
    <div className="main-area">
      <Topbar title={title} subtitle={subtitle} />
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
          {effectiveType !== "scan" ? (
            <select
              className="input"
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
            >
              <option value="">Усі статуси</option>
              <option value="success">Успішні</option>
              <option value="failed">Помилки</option>
            </select>
          ) : null}
          {!fixedType ? (
            <select
              className="input"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">Усі події</option>
              <option value="generation">Генерації</option>
              <option value="scan">Сканування</option>
            </select>
          ) : null}
          <button className="button" onClick={applyFilters}>
            Застосувати
          </button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Тип</th>
                <th>Компанія</th>
                <th>Сума</th>
                <th>Комісія</th>
                <th>Всього</th>
                <th>Статус</th>
                <th>Причина</th>
                <th>Створено</th>
              </tr>
            </thead>
            <tbody>
              {items.map((h) => {
                const commission =
                  Number(h.commission_percent || 0) +
                  Number(h.commission_fixed || 0);
                const total = Number(h.amount || 0) + commission;
                const isScan = h.kind === "scan";
                const typeLabel = isScan ? "Сканування" : "Генерація";
                const statusLabel = isScan
                  ? h.is_duplicate
                    ? "Повторне"
                    : "Унікальне"
                  : formatStatus(h.status);
                return (
                  <tr key={h.id}>
                    <td>{h.id}</td>
                    <td>{typeLabel}</td>
                    <td>
                      {h.company_name
                        ? `${h.company_name} (#${h.company_id})`
                        : h.company_id}
                    </td>
                    <td>{isScan ? "—" : formatMoney(h.amount)}</td>
                    <td>{isScan ? "—" : formatMoney(commission)}</td>
                    <td>{isScan ? "—" : formatMoney(total)}</td>
                    <td>
                      <span className="badge">{statusLabel}</span>
                    </td>
                    <td>{isScan ? "—" : h.error_message || h.error_code || "—"}</td>
                    <td>{formatDateTime(h.created_at || h.createdAt)}</td>
                  </tr>
                );
              })}
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
