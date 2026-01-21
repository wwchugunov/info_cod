import { useEffect, useState } from "react";
import api from "../services/api";
import Topbar from "../components/Topbar";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [series, setSeries] = useState([]);
  const [period, setPeriod] = useState("day");
  const [filters, setFilters] = useState({
    company_id: "",
    from: "",
    to: "",
  });

  const buildParams = () =>
    Object.fromEntries(Object.entries(filters).filter(([, value]) => value));

  const loadSeries = () => {
    api
      .get("/admin/metrics/series", {
        params: { period, ...buildParams() },
      })
      .then((res) => setSeries(res.data.data || []))
      .catch(() => setSeries([]));
  };

  const loadMetrics = () => {
    api
      .get("/admin/metrics", { params: buildParams() })
      .then((res) => setMetrics(res.data))
      .catch(() => setMetrics(null));
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  useEffect(() => {
    loadSeries();
  }, [period]);

  return (
    <div className="main-area">
      <Topbar
        title="Огляд"
        subtitle="Ключові метрики платіжної системи"
        actions={
          <select
            className="input"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="day">День</option>
            <option value="week">Тиждень</option>
            <option value="month">Місяць</option>
          </select>
        }
      />
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
          <button
            className="button"
            onClick={() => {
              loadMetrics();
              loadSeries();
            }}
          >
            Застосувати
          </button>
        </div>
      </div>
      <div className="card-grid">
        {[
          { label: "Платежів", value: metrics?.payments_count ?? "—" },
          { label: "Генерацій", value: metrics?.generation_count ?? "—" },
          {
            label: "Генерацій (унікальні)",
            value: metrics?.generation_unique_count ?? "—",
          },
          {
            label: "Генерацій (повторні)",
            value: metrics?.generation_duplicate_count ?? "—",
          },
          {
            label: "Сканувань (унікальні)",
            value: metrics?.scan_unique_count ?? "—",
          },
          {
            label: "Сканувань (повторні)",
            value: metrics?.scan_duplicate_count ?? "—",
          },
          {
            label: "Сума платежів",
            value: metrics ? Number(metrics.sum_amount).toFixed(2) : "—",
          },
          {
            label: "Комісія",
            value: metrics
              ? Number(
                  metrics.sum_commission_percent + metrics.sum_commission_fixed
                ).toFixed(2)
              : "—",
          },
          {
            label: "Підсумок",
            value: metrics ? Number(metrics.sum_final_amount).toFixed(2) : "—",
          },
        ].map((card) => (
          <div className="card" key={card.label}>
            <h3>{card.label}</h3>
            <div className="value">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="section">
        <div className="section-header">
          <strong>Динаміка сум</strong>
        </div>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={series}>
              <CartesianGrid stroke="#efe6dc" strokeDasharray="4 4" />
              <XAxis
                dataKey="bucket"
                tickFormatter={(v) => new Date(v).toLocaleDateString()}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(v) => new Date(v).toLocaleDateString()}
              />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#ff7a3d"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="commission"
                stroke="#0f8b8d"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </div>
      </div>
  );
}
