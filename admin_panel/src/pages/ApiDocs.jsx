import { useEffect, useRef, useState } from "react";
import Topbar from "../components/Topbar";
import api from "../services/api";
import useAdminInfo from "../hooks/useAdminInfo";

export default function ApiDocs() {
  const { role, company_id, permissions = {} } = useAdminInfo();
  const [companyId, setCompanyId] = useState("");
  const [token, setToken] = useState("");
  const [tokens, setTokens] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const didPrefillRef = useRef(false);
  const apiBase = import.meta.env.VITE_API_BASE || "/api";
  const publicBase = import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;
  const paymentPageUrl = `${publicBase}${apiBase}/payment/payment/<TOKEN>`;

  const canRotate = role === "superadmin" || Boolean(permissions.token_generate);

  const loadToken = async (id) => {
    if (!id) return;
    try {
      const res = await api.get(`/admin/companies/${id}/token`);
      setToken(res.data.api_token || "");
    } catch (err) {
      setToken("");
      if (err?.response?.status === 403) {
        setStatus("Доступ до токенів вимкнено в прод середовищі.");
      }
    }
  };

  const loadTokens = async () => {
    try {
      const res = await api.get("/admin/companies/tokens");
      setTokens(res.data.items || []);
    } catch (err) {
      setTokens([]);
      if (err?.response?.status === 403) {
        setStatus("Доступ до токенів вимкнено в прод середовищі.");
      }
    }
  };

  useEffect(() => {
    if (company_id && !didPrefillRef.current) {
      setCompanyId(String(company_id));
      didPrefillRef.current = true;
    }
  }, [company_id]);

  useEffect(() => {
    if (companyId) {
      loadToken(companyId);
    }
  }, [companyId]);

  useEffect(() => {
    loadTokens();
  }, []);

  const rotateToken = async () => {
    if (!companyId) {
      setStatus("Вкажіть ID компанії.");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const res = await api.post(`/admin/companies/${companyId}/token`);
      setToken(res.data.api_token || "");
      setStatus("Новий токен згенеровано. Збережіть його.");
      loadTokens();
    } catch (err) {
      const message =
        err?.response?.data?.message || "Не вдалося згенерувати токен";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-area">
      <Topbar title="API" subtitle="Документація, токени та приклади" />
      <div className="section" style={{ marginBottom: 16 }}>
        <div className="section-header">
          <strong>Токен компанії</strong>
        </div>
        <div className="filter-row">
          <input
            className="input"
            placeholder="ID компанії"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            disabled={!canRotate && Boolean(company_id)}
          />
          <button
            className="button"
            onClick={rotateToken}
            disabled={!canRotate || loading}
          >
            {loading ? "Генерація..." : "Згенерувати токен"}
          </button>
        </div>
        {tokens.length > 1 ? (
          <div className="card-grid" style={{ marginTop: 12 }}>
            {tokens.map((item) => (
              <div className="card" key={item.id}>
                <h3>
                  {item.name || "Компанія"} #{item.id}
                </h3>
                <div
                  style={{
                    background: "#f6f2ea",
                    padding: "12px 14px",
                    borderRadius: 12,
                    wordBreak: "break-all",
                    fontFamily: "monospace",
                    color: "#1c1a19",
                    marginTop: 8,
                  }}
                >
                  {item.api_token || "—"}
                </div>
                <button
                  className="button secondary"
                  style={{ marginTop: 8 }}
                  onClick={() =>
                    navigator.clipboard?.writeText(item.api_token || "")
                  }
                  disabled={!item.api_token}
                >
                  Скопіювати
                </button>
              </div>
            ))}
          </div>
        ) : (tokens[0]?.api_token || token) ? (
          <div
            style={{
              background: "#f6f2ea",
              padding: "12px 14px",
              borderRadius: 12,
              wordBreak: "break-all",
              fontFamily: "monospace",
              color: "#1c1a19",
              marginTop: 8,
            }}
          >
            {tokens[0]?.api_token || token}
            <button
              className="button secondary"
              style={{ marginTop: 8 }}
              onClick={() =>
                navigator.clipboard?.writeText(tokens[0]?.api_token || token)
              }
            >
              Скопіювати
            </button>
          </div>
        ) : null}
        {status ? <p className="form-hint">{status}</p> : null}
        {!canRotate ? (
          <p className="form-hint">
            Адміністратор заборонив цю дію, зверніться до адміністратора.
          </p>
        ) : null}
      </div>

      <div className="section" style={{ marginBottom: 16 }}>
        <div className="section-header">
          <strong>Як працювати з API</strong>
        </div>
        <p style={{ color: "#6e6a67" }}>
          Отримання токена: відкрийте розділ <strong>API</strong> і натисніть
          "Згенерувати токен". У прод середовищі токен може не
          відображатися в інтерфейсі.
        </p>
        <p style={{ color: "#6e6a67" }}>
          Якщо дія недоступна, зверніться до адміністратора.
        </p>
        <p style={{ color: "#6e6a67" }}>
          Усі запити виконуються із заголовком
          <strong> Authorization: Bearer TOKEN</strong>.
        </p>
        <p style={{ color: "#6e6a67" }}>
          Базовий URL: <strong>{apiBase}</strong>.
        </p>
        <div
          className="card-grid"
          style={{ marginTop: 12, gridTemplateColumns: "1fr" }}
        >
          <div className="card">
            <h3>POST {apiBase}/payment/generate</h3>
            <p style={{ color: "#6e6a67" }}>
              Створює платіжне посилання та QR. Потрібен токен компанії в
              заголовку Authorization. Нижче — повний приклад запиту, який можна
              відправляти з вашого бекенду/CRM.
            </p>
            <div
              style={{
                background: "#f6f2ea",
                padding: "12px 14px",
                borderRadius: 12,
                fontFamily: "monospace",
                color: "#1c1a19",
                whiteSpace: "pre-wrap",
              }}
            >
              {`Request:
                POST ${apiBase}/payment/generate

                Headers:
                Authorization: Bearer TOKEN
                Content-Type: application/json

                Body:
                {
                  "amount": 1,
                  "purpose": "Поповнення карти"
                }`}
            </div>
            <p style={{ color: "#6e6a67", marginTop: 10 }}>
              <strong>amount</strong> — сума платежу в гривнях (число).
              <strong> purpose</strong> — призначення платежу, відображається у
              платежі.
              <strong> iban</strong> — IBAN отримувача в форматі UA...
            </p>
          </div>
          <div className="card">
            <h3>Відповідь</h3>
            <p style={{ color: "#6e6a67" }}>
              Повний приклад відповіді, що повертає API після успішної
              генерації.
            </p>
            <div
              style={{
                background: "#f6f2ea",
                padding: "12px 14px",
                borderRadius: 12,
                fontFamily: "monospace",
                color: "#1c1a19",
                whiteSpace: "pre-wrap",
              }}
            >
              {`{
  "message": "Successfully",
  "payment": {
    "originalAmount": 1,
    "commissionPercent": 0,
    "commissionFixed": 0,
    "finalAmount": 1,
    "linkId": "${paymentPageUrl}",
    "qr_link": "<TOKEN>",
    "qrlink": "NBU_TOKEN"
  }
}`}
            </div>
          </div>
          <div className="card">
            <h3>Пояснення полів</h3>
            <p style={{ color: "#6e6a67" }}>
              <strong>originalAmount</strong> — сума без комісії.
              <strong> commissionPercent</strong> — відсоткова комісія.
              <strong> commissionFixed</strong> — фіксована комісія.
              <strong> finalAmount</strong> — підсумкова сума до сплати.
              <strong> linkId</strong> — готове посилання на сторінку оплати.
              <strong> qr_link</strong> — ідентифікатор посилання (UUID), який
              підставляється у URL.
              <strong> qrlink</strong> — base64 URL‑рядок для генерації QR.
            </p>
            <div
              style={{
                background: "#f6f2ea",
                padding: "12px 14px",
                borderRadius: 12,
                fontFamily: "monospace",
                color: "#1c1a19",
                whiteSpace: "pre-wrap",
              }}
            >
              {`Сторінка оплати:
${paymentPageUrl}`}
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <strong>Типові помилки</strong>
        </div>
        <div className="form-grid">
          <div className="field">
            <strong>DAILY_LIMIT_REACHED</strong>
            <p className="muted-text">Перевищено денний ліміт генерацій.</p>
          </div>
          <div className="field">
            <strong>COMPANY_DISABLED</strong>
            <p className="muted-text">Компанія вимкнена адміністратором.</p>
          </div>
          <div className="field">
            <strong>IBAN_INVALID</strong>
            <p className="muted-text">Некоректний формат IBAN.</p>
          </div>
          <div className="field">
            <strong>AMOUNT_INVALID</strong>
            <p className="muted-text">Сума має бути додатним числом.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
