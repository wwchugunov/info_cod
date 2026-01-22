import { useEffect, useRef, useState } from "react";
import Topbar from "../components/Topbar";
import api from "../services/api";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import useAdminInfo from "../hooks/useAdminInfo";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatDate } from "../utils/date";

export default function Reports() {
  const [filters, setFilters] = useState({
    company_id: "",
    from: "",
    to: "",
  });
  const [metrics, setMetrics] = useState(null);
  const [series, setSeries] = useState([]);
  const pdfRef = useRef(null);
  const { role, permissions = {} } = useAdminInfo();
  const canDownload = role === "superadmin" || Boolean(permissions.reports_download);

  const buildParams = () =>
    Object.fromEntries(Object.entries(filters).filter(([, value]) => value));

  const loadMetrics = () => {
    api
      .get("/admin/metrics", { params: buildParams() })
      .then((res) => setMetrics(res.data))
      .catch(() => setMetrics(null));
    api
      .get("/admin/metrics/series", { params: { ...buildParams(), period: "day" } })
      .then((res) => setSeries(res.data.data || []))
      .catch(() => setSeries([]));
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const downloadCsv = async (path, filename) => {
    if (!canDownload) return;
    const res = await api.get(path, {
      params: buildParams(),
      responseType: "blob",
    });
    const url = URL.createObjectURL(res.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportXlsx = async () => {
    if (!canDownload) return;
    const fetchAll = async (path) => {
      const limit = 200;
      let page = 1;
      let items = [];
      while (true) {
        const res = await api.get(path, { params: { ...buildParams(), page, limit } });
        const next = res.data.items || [];
        items = items.concat(next);
        if (next.length < limit) break;
        page += 1;
      }
      return items;
    };

    const [companies, history, scans] = await Promise.all([
      fetchAll("/admin/companies"),
      fetchAll("/admin/generation-history"),
      fetchAll("/admin/scan-history"),
    ]);

    const wb = XLSX.utils.book_new();
    const companiesSheet = XLSX.utils.json_to_sheet(companies);
    const historySheet = XLSX.utils.json_to_sheet(history);
    const scansSheet = XLSX.utils.json_to_sheet(scans);

    XLSX.utils.book_append_sheet(wb, companiesSheet, "Companies");
    XLSX.utils.book_append_sheet(wb, historySheet, "GenerationHistory");
    XLSX.utils.book_append_sheet(wb, scansSheet, "ScanHistory");

    XLSX.writeFile(wb, "reports.xlsx", {
      bookType: "xlsx",
      compression: true,
      cellStyles: true,
    });
  };

  const exportPdf = async () => {
    if (!pdfRef.current) return;
    const canvas = await html2canvas(pdfRef.current, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, width, height);
    pdf.save("report.pdf");
  };

  return (
    <div className="main-area">
      <Topbar title="Звіти" subtitle="Експорт CSV / XLSX / PDF" />
      <div className="section" style={{ marginBottom: 16 }}>
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
          <button className="button" onClick={loadMetrics}>
            Застосувати
          </button>
        </div>
      </div>

      <div className="card-grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>Компанії</h3>
          <p style={{ color: "#6e6a67" }}>CSV вивантаження</p>
          <button
            className="button"
            onClick={() => downloadCsv("/admin/export/companies.csv", "companies.csv")}
            disabled={!canDownload}
          >
            Завантажити CSV
          </button>
        </div>
        <div className="card">
          <h3>Історія генерацій</h3>
          <p style={{ color: "#6e6a67" }}>CSV вивантаження</p>
          <button
            className="button"
            onClick={() =>
              downloadCsv(
                "/admin/export/generation-history.csv",
                "generation-history.csv"
              )
            }
            disabled={!canDownload}
          >
            Завантажити CSV
          </button>
        </div>
        <div className="card">
          <h3>Історія сканувань</h3>
          <p style={{ color: "#6e6a67" }}>CSV вивантаження</p>
          <button
            className="button"
            onClick={() => downloadCsv("/admin/export/scan-history.csv", "scan-history.csv")}
            disabled={!canDownload}
          >
            Завантажити CSV
          </button>
        </div>
      </div>
      {!canDownload ? (
        <p className="form-hint">
          Адміністратор заборонив цю дію, зверніться до адміністратора.
        </p>
      ) : null}

      <div className="section" ref={pdfRef}>
        <div className="section-header">
          <strong>Підсумки</strong>
          <div className="filter-row">
            <button
              className="button secondary"
              onClick={exportXlsx}
              disabled={!canDownload}
            >
              XLSX
            </button>
            <button className="button" onClick={exportPdf} disabled={!canDownload}>
              PDF з графіком
            </button>
          </div>
        </div>
        <div className="card-grid" style={{ marginBottom: 16 }}>
          <div className="card">
            <h3>Параметри</h3>
            <div style={{ color: "#6e6a67", lineHeight: 1.6 }}>
              <div>Компанія: {filters.company_id || "Усі"}</div>
              <div>
                Період: {filters.from || "—"} – {filters.to || "—"}
              </div>
            </div>
          </div>
          <div className="card">
            <h3>Сума з комісією</h3>
            <div className="value">
              {metrics ? Number(metrics.sum_final_amount).toFixed(2) : "—"}
            </div>
          </div>
          <div className="card">
            <h3>Усього генерацій</h3>
            <div className="value">{metrics?.generation_count ?? "—"}</div>
          </div>
          <div className="card">
            <h3>Усього сканувань</h3>
            <div className="value">{metrics?.scan_count ?? "—"}</div>
          </div>
        </div>
        <div className="card-grid">
          <div className="card">
            <h3>Сума платежів</h3>
            <div className="value">
              {metrics ? Number(metrics.sum_amount).toFixed(2) : "—"}
            </div>
          </div>
          <div className="card">
            <h3>Комісія</h3>
            <div className="value">
              {metrics
                ? Number(
                    metrics.sum_commission_percent + metrics.sum_commission_fixed
                  ).toFixed(2)
                : "—"}
            </div>
          </div>
          <div className="card">
            <h3>Кількість платежів</h3>
            <div className="value">{metrics?.payments_count ?? "—"}</div>
          </div>
          <div className="card">
            <h3>Генерацій (унікальні)</h3>
            <div className="value">{metrics?.generation_unique_count ?? "—"}</div>
          </div>
          <div className="card">
            <h3>Генерацій (повторні)</h3>
            <div className="value">{metrics?.generation_duplicate_count ?? "—"}</div>
          </div>
          <div className="card">
            <h3>Сканувань (унікальні)</h3>
            <div className="value">{metrics?.scan_unique_count ?? "—"}</div>
          </div>
          <div className="card">
            <h3>Сканувань (повторні)</h3>
            <div className="value">{metrics?.scan_duplicate_count ?? "—"}</div>
          </div>
        </div>

        <div style={{ width: "100%", height: 280, marginTop: 16 }}>
          <ResponsiveContainer>
            <BarChart data={series}>
              <CartesianGrid stroke="#efe6dc" strokeDasharray="4 4" />
              <XAxis
                dataKey="bucket"
                tickFormatter={(v) => formatDate(v)}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(v) => formatDate(v)}
              />
              <Bar dataKey="amount" fill="#ff7a3d" />
              <Bar dataKey="commission" fill="#0f8b8d" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
