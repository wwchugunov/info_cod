import { useEffect, useState } from "react";
import api from "../services/api";
import Topbar from "../components/Topbar";

export default function BankHistory() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({
    company_id: "",
    bank_short_name: "",
    from: "",
    to: "",
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;
  const totalPages = total ? Math.ceil(total / limit) : 1;

  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
  };

  const buildParams = () =>
    Object.fromEntries(
      Object.entries({ ...filters, page, limit }).filter(([, value]) => value)
    );

  const load = () => {
    api
      .get("/admin/bank-history", { params: buildParams() })
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
      <Topbar title="Банки" subtitle="Історія переходів у банк" />
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
            placeholder="Банк (short)"
            value={filters.bank_short_name}
            onChange={(e) =>
              setFilters({ ...filters, bank_short_name: e.target.value })
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
          <button className="button" onClick={applyFilters}>
            Застосувати
          </button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Компанія</th>
                <th>Платіж</th>
                <th>Банк</th>
                <th>Платформа</th>
                <th>Дія</th>
                <th>IP</th>
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
                  <td>{h.bank_name || h.bank_short_name || "—"}</td>
                  <td>{h.platform || "—"}</td>
                  <td>{h.action || "—"}</td>
                  <td>{h.client_ip || "—"}</td>
                  <td>{formatDate(h.created_at || h.createdAt)}</td>
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
