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
import { formatDateTime, formatTime } from "../utils/date";

function formatBytes(value) {
  const num = Number(value || 0);
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  if (num < 1024 * 1024 * 1024) return `${(num / 1024 / 1024).toFixed(1)} MB`;
  return `${(num / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export default function Load() {
  const [metrics, setMetrics] = useState([]);
  const [latest, setLatest] = useState(null);

  const load = () => {
    api
      .get("/admin/system-metrics", { params: { limit: 120 } })
      .then((res) => {
        const items = res.data.items || [];
        const normalized = items.map((item) => {
          const timestamp = item.created_at || item.createdAt || null;
          return { ...item, timestamp };
        });
        setMetrics(normalized.slice().reverse());
        setLatest(normalized[0] || null);
      })
      .catch(() => {
        setMetrics([]);
        setLatest(null);
      });
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);

  const toNumber = (value) => Number(value || 0);

  return (
    <div className="main-area">
      <Topbar title="Навантаження" subtitle="Системні метрики" />
      <div className="card-grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>CPU</h3>
          <div className="value">{latest ? `${latest.cpu_usage_percent}%` : "—"}</div>
        </div>
        <div className="card">
          <h3>RAM</h3>
          <div className="value">
            {latest ? `${formatBytes(latest.mem_used)} / ${formatBytes(latest.mem_total)}` : "—"}
          </div>
        </div>
        <div className="card">
          <h3>RPS</h3>
          <div className="value">{latest ? latest.rps : "—"}</div>
        </div>
        <div className="card">
          <h3>Помилки</h3>
          <div className="value">{latest ? latest.error_count : "—"}</div>
        </div>
        <div className="card">
          <h3>Трафік</h3>
          <div className="value">
            {latest
              ? `${formatBytes(latest.bytes_in)} / ${formatBytes(latest.bytes_out)}`
              : "—"}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <strong>Динаміка</strong>
        </div>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={metrics}>
              <CartesianGrid stroke="#efe6dc" strokeDasharray="4 4" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(v) => formatTime(v)}
              />
              <YAxis />
              <Tooltip labelFormatter={(v) => formatDateTime(v)} />
              <Line type="monotone" dataKey="cpu_usage_percent" stroke="#ff7a3d" dot={false} />
              <Line
                type="monotone"
                dataKey="rps"
                stroke="#0f8b8d"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="avg_response_ms"
                stroke="#6b4f3a"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <strong>Деталі</strong>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Час</th>
                <th>CPU %</th>
                <th>RAM</th>
                <th>RPS</th>
                <th>AVG ms</th>
                <th>Трафік</th>
                <th>Loop lag</th>
              </tr>
            </thead>
            <tbody>
              {metrics.slice(-20).map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.timestamp
                      ? new Date(item.timestamp).toLocaleTimeString()
                      : "—"}
                  </td>
                  <td>{item.cpu_usage_percent}</td>
                  <td>{formatBytes(toNumber(item.mem_used))}</td>
                  <td>{item.rps}</td>
                  <td>{item.avg_response_ms}</td>
                  <td>
                    {formatBytes(toNumber(item.bytes_in))} / {formatBytes(toNumber(item.bytes_out))}
                  </td>
                  <td>{item.event_loop_lag_ms?.toFixed?.(2) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
