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
      setStatus("Вкажіть ID компанії.");
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
        <div
          className="card-grid"
          style={{ marginTop: 12, gridTemplateColumns: "1fr" }}
        >
          <div className="card">
            <h3>POST /api/payment/generate</h3>
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
POST /api/payment/generate

Headers:
Authorization: Bearer TOKEN
Content-Type: application/json

Body:
{
  "amount": 1,
  "purpose": "Поповнення карти Шлапа!-1ґ-їхік",
  "iban": "UA903220010000026209302402931"
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
    "linkId": "http://infokod.com.ua/api/payment/payment/1bfbce81-efd9-4a8b-8b3b-47543a481ed3",
    "qr_link": "1bfbce81-efd9-4a8b-8b3b-47543a481ed3",
    "qrlink": "QkNECjAwMgoyClVDVAoK0s7CIM7Lxc3AClVBOTAzMjIwMDEwMDAwMDI2MjA5MzAyNDAyOTMxClVBSDEKOTI3NDY1OTEKCgrP7u_u4u3l7e3_IOrg8PLoINjr4O_gIS0xtC2_9bPq"
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
https://infokod.com.ua/api/payment/payment/1bfbce81-efd9-4a8b-8b3b-47543a481ed3`}
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
