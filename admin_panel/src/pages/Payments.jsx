import { useEffect, useState } from "react";
import api from "../services/api";
import Topbar from "../components/Topbar";
import useRole from "../hooks/useRole";

export default function Payments({ title = "Платежі", subtitle = "Пошук і моніторинг" }) {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({
    company_id: "",
    status: "pending",
    from: "",
    to: "",
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;
  const totalPages = total ? Math.ceil(total / limit) : 1;
  const role = useRole();
  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
  };
  const formatMoney = (value) => Number(value || 0).toFixed(2);
  const sumCommission = (item) =>
    Number(item.commission_percent || 0) + Number(item.commission_fixed || 0);
  const statusLabels = {
    pending: "Згенеровано",
    delivered: "Скановано",
  };
  const formatStatus = (status) => statusLabels[status] || status || "—";

  const buildParams = () =>
    Object.fromEntries(
      Object.entries({ ...filters, page, limit }).filter(([, value]) => value)
    );

  const load = () => {
    api
      .get("/admin/payments", { params: buildParams() })
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

  const showCompany = role && role !== "viewer";
  const totalCommission = items.reduce(
    (sum, item) => sum + sumCommission(item),
    0
  );

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
          <select
            className="input"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">Усі</option>
            <option value="pending">Згенеровано</option>
            <option value="delivered">Скановано</option>
          </select>
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
        <div style={{ marginTop: 8, color: "#6e6a67" }}>
          Комісія всього: {formatMoney(totalCommission)}
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                {showCompany ? <th>Компанія</th> : null}
                <th>Сума</th>
                <th>Комісія</th>
                <th>Всього</th>
                <th>Статус</th>
                <th>Створено</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const commission = sumCommission(p);
                const total = Number(p.amount || 0) + commission;
                return (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    {showCompany ? (
                      <td>
                        {p.Company?.name ||
                          p.company_name ||
                          (p.company_id ? `#${p.company_id}` : "—")}
                      </td>
                    ) : null}
                    <td>{formatMoney(p.amount)}</td>
                    <td>{formatMoney(commission)}</td>
                    <td>{formatMoney(total)}</td>
                    <td>
                      <span className="badge">{formatStatus(p.status)}</span>
                    </td>
                    <td>{formatDate(p.created_at || p.createdAt)}</td>
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
