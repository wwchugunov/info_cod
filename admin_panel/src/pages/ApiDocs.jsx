import { useState } from "react";
import Topbar from "../components/Topbar";
import api from "../services/api";
import useAdminInfo from "../hooks/useAdminInfo";

export default function ApiDocs() {
  const { role, company_id, permissions = {} } = useAdminInfo();
  const [companyId, setCompanyId] = useState(
    company_id ? String(company_id) : ""
  );
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const canRotate = role === "superadmin" || Boolean(permissions.token_generate);

  const rotateToken = async () => {
    if (!companyId) {
      setStatus("Укажите ID компании.");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const res = await api.post(`/admin/companies/${companyId}/token`);
      setToken(res.data.api_token || "");
      setStatus("Новий токен згенеровано. Збережіть його.");
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
        {token ? (
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
            {token}
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
          "Згенерувати токен". Під час реєстрації компанії токен також
          відображається в модальному вікні.
        </p>
        <p style={{ color: "#6e6a67" }}>
          Якщо дія недоступна, зверніться до адміністратора.
        </p>
        <p style={{ color: "#6e6a67" }}>
          Усі запити виконуються із заголовком
          <strong> Authorization: Bearer TOKEN</strong>.
        </p>
        <p style={{ color: "#6e6a67" }}>
          Базовий URL: <strong>/api</strong>.
        </p>
        <div className="card-grid" style={{ marginTop: 12 }}>
          <div className="card">
            <h3>POST /api/payment/generate</h3>
            <p style={{ color: "#6e6a67" }}>
              Створення платіжного посилання. Використовуйте токен компанії.
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
              {`Headers:
Authorization: Bearer TOKEN
Content-Type: application/json

Body:
{
  "amount": 100.5,
  "purpose": "Оплата послуг",
  "iban": "UA123..."
}`}
            </div>
          </div>
          <div className="card">
            <h3>GET /api/payment/payment/:linkId</h3>
            <p style={{ color: "#6e6a67" }}>
              Відображення сторінки оплати за згенерованим посиланням.
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
              {`Example:
https://your-domain.com/api/payment/payment/UUID`}
            </div>
          </div>
          <div className="card">
            <h3>Відповідь</h3>
            <p style={{ color: "#6e6a67" }}>
              API повертає дані про посилання та суми комісії.
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
    "paymentLink": "https://...",
    "originalAmount": 100.5,
    "commissionPercent": 3,
    "commissionFixed": 0,
    "finalAmount": 103.5,
    "linkId": "..."
  }
}`}
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
            <p className="muted-text">Превищено денний ліміт генерацій.</p>
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
