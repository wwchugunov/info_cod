import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import Topbar from "../components/Topbar";
import useAdminInfo from "../hooks/useAdminInfo";
import { formatDateTime } from "../utils/date";

const HISTORY_LIMIT = 8;

const formatMoney = (value) =>
  Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "0.00";
const formatOptionalMoney = (value) =>
  Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "—";

export default function PaymentLinkGenerator() {
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [payment, setPayment] = useState(null);
  const [companyIdInput, setCompanyIdInput] = useState("");
  const { company_id, role } = useAdminInfo();
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [allowAmountEdit, setAllowAmountEdit] = useState(false);
  const [paymentOptions, setPaymentOptions] = useState(null);
  const apiBaseUrl = (import.meta.env.VITE_API_BASE || "/api").replace(/\/+$/, "");

  const normalizedAmount = Number(amount);
  const manualInput = String(companyIdInput || "").trim();
  const resolvedCompanyId = company_id
    ? Number(company_id)
    : manualInput
    ? Number(manualInput)
    : null;
  const hasCompanyContext =
    Number.isFinite(resolvedCompanyId) && resolvedCompanyId > 0;
  const canGenerateRole = ["superadmin", "admin", "manager"].includes(role);
  const canSubmit =
    hasCompanyContext &&
    canGenerateRole &&
    !loading &&
    Number.isFinite(normalizedAmount) &&
    normalizedAmount > 0 &&
    String(purpose || "").trim().length;

  const fetchHistory = useCallback(async (companyId, page) => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const res = await api.get("/admin/generation-history", {
        params: {
          company_id: companyId,
          limit: String(HISTORY_LIMIT),
          page: String(page),
        },
      });
      setHistory(res.data?.items || []);
      setHistoryTotal(Number(res.data?.total || 0));
    } catch (err) {
      setHistoryError(
        err?.response?.data?.message ||
          err?.message ||
          "Не вдалося завантажити історію генерацій"
      );
      setHistory([]);
      setHistoryTotal(0);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) {
      setError("Вкажіть суму більше 0 і призначення");
      return;
    }
    if (!hasCompanyContext) {
      setError("Невідомий ID компанії");
      return;
    }
    if (!canGenerateRole) {
      setError("Недостатньо прав на генерацію посилання");
      return;
    }
    setError("");
    setWarning("");
    setPaymentOptions(null);
    setLoading(true);
    try {
      const res = await api.post(
        `/admin/companies/${resolvedCompanyId}/payment/generate`,
        {
          amount: normalizedAmount,
          purpose: purpose.trim(),
          allowAmountEdit,
        }
      );
      const responseAllowAmountEdit = Boolean(res.data?.allowAmountEdit);
      setPayment(res.data?.payment || null);
      setPaymentOptions({ static: res.data?.options?.static ?? !responseAllowAmountEdit });
      setWarning(res.data?.warning || "");
      setHistoryPage(1);
      if (hasCompanyContext) {
        fetchHistory(resolvedCompanyId, 1);
      }
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Не вдалося згенерувати посилання";
      setError(message);
      setPayment(null);
    } finally {
      setLoading(false);
    }
  };

  const copyText = async (text) => {
    if (!text) return;
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      // ignore silently
    }
  };

  const commission = useMemo(() => {
    if (!payment) return 0;
    return Number(payment.commissionPercent || 0) +
      Number(payment.commissionFixed || 0);
  }, [payment]);

  const buildHistoryLink = (linkId) => {
    if (!linkId) return "";
    return `${apiBaseUrl}/payment/payment/${linkId}`;
  };

  useEffect(() => {
    if (!hasCompanyContext) {
      setHistory([]);
      setHistoryTotal(0);
      setHistoryPage(1);
      return;
    }
    setHistoryPage(1);
    fetchHistory(resolvedCompanyId, 1);
  }, [hasCompanyContext, resolvedCompanyId, fetchHistory]);

  useEffect(() => {
    if (!hasCompanyContext || historyPage === 1) return;
    fetchHistory(resolvedCompanyId, historyPage);
  }, [historyPage, hasCompanyContext, resolvedCompanyId, fetchHistory]);

  const historyPages = Math.max(1, Math.ceil(historyTotal / HISTORY_LIMIT));
  const startIndex = (historyPage - 1) * HISTORY_LIMIT;

  return (
    <div className="main-area">
      <Topbar
        title="Сгенерувати посилання"
        subtitle="Надішліть клієнту посилання або QR та отримайте платіж"
      />
      <div className="section">
        <form className="form-grid align-end" onSubmit={handleSubmit}>
          {company_id ? (
            <div className="field">
              ID компанії
              <strong>#{company_id}</strong>
            </div>
          ) : (
            <label className="field">
              ID компанії
              <input
                className="input"
                value={companyIdInput}
                placeholder="123"
                onChange={(e) => setCompanyIdInput(e.target.value)}
              />
            </label>
          )}
          <label className="field">
            Сума
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              placeholder="напр. 150"
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <div className="field checkbox toggle-field">
            <button
              type="button"
              className={`button toggle-button ${allowAmountEdit ? "on" : "off"}`}
              onClick={() => setAllowAmountEdit((prev) => !prev)}
              aria-pressed={allowAmountEdit}
            >
              <span className="toggle-label">Редагування суми</span>
              <span className="toggle-track" aria-hidden="true">
                <span className="toggle-knob" />
              </span>
            </button>
          </div>
          <label className="field">
            Призначення
            <input
              className="input"
              value={purpose}
              placeholder="напр. Оплата послуг"
              onChange={(e) => setPurpose(e.target.value)}
            />
          </label>
          {!canGenerateRole ? (
            <div className="form-hint" style={{ color: "#b3261e" }}>
              У вас недостатньо прав на генерацію посилань
            </div>
          ) : null}
          {error ? <div className="form-hint" style={{ color: "#b3261e" }}>{error}</div> : null}
          {warning ? (
            <div className="form-hint" style={{ color: "#8a5600" }}>
              {warning}
            </div>
          ) : null}
          <div className="modal-actions">
            <button className="button" type="submit" disabled={!canSubmit}>
              {loading ? "Створюємо..." : "Згенерувати"}
            </button>
          </div>
        </form>
        {payment ? (
          <div className="box" style={{ marginTop: 20 }}>
            <h3 style={{ marginTop: 0 }}>Готове посилання</h3>
            <div className="field">
              Лінк
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <code style={{ fontSize: 14, wordBreak: "break-word" }}>{payment.linkId}</code>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => copyText(payment.linkId)}
                >
                  Копіювати
                </button>
              </div>
            </div>
            <div className="field">
              QR-ідентифікатор
              <div style={{ wordBreak: "break-word", fontFamily: "monospace" }}>
                {payment.qr_link || "—"}
              </div>
            </div>
            <div className="field">
              QR-рядок
              <textarea
                className="input"
                readOnly
                value={payment.qrlink || ""}
                style={{ height: 120 }}
              />
            </div>
        <div className="field" style={{ display: "flex", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: "#6e6a67" }}>Комісія</div>
            <strong>{formatMoney(commission)}</strong>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#6e6a67" }}>До сплати</div>
            <strong>{formatMoney(payment.finalAmount)}</strong>
          </div>
        </div>
        <div className="field">
          Статична сума
          <strong>{paymentOptions?.static ? "Так" : "Ні"}</strong>
        </div>
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="button secondary" type="button" onClick={() => setPayment(null)}>
                Згенерувати ще
              </button>
            </div>
          </div>
        ) : null}
        {hasCompanyContext ? (
          <div className="section" style={{ marginTop: 32 }}>
            <h3 style={{ marginTop: 0 }}>Історія генерацій</h3>
            {historyLoading ? (
              <div className="form-hint">Завантаження історії...</div>
            ) : historyError ? (
              <div className="form-hint" style={{ color: "#b3261e" }}>
                {historyError}
              </div>
            ) : history.length ? (
              <>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Сума</th>
                        <th>Комісія</th>
                        <th>Пояснення</th>
                        <th>Статус</th>
                        <th>Створено</th>
                        <th>Посилання</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((item, index) => {
                        const amountValue = formatOptionalMoney(item.amount);
                        const commissionValue =
                          Number(item.commission_percent || 0) +
                          Number(item.commission_fixed || 0);
                        const linkId = item.link_id;
                        const linkUrl = buildHistoryLink(linkId);
                        return (
                          <tr key={`${item.id}-${index}`}>
                            <td>{startIndex + index + 1}</td>
                            <td>{amountValue}</td>
                            <td>{formatOptionalMoney(commissionValue)}</td>
                            <td>{item.purpose || "—"}</td>
                            <td>{item.status || "—"}</td>
                            <td>{formatDateTime(item.created_at)}</td>
                            <td>
                              {linkUrl ? (
                                <a target="_blank" rel="noreferrer" href={linkUrl}>
                                  Відкрити
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div
                  className="modal-actions"
                  style={{
                    marginTop: 12,
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => setHistoryPage((prev) => Math.max(prev - 1, 1))}
                      disabled={historyPage === 1 || historyLoading}
                    >
                      Назад
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() =>
                        setHistoryPage((prev) => Math.min(prev + 1, historyPages))
                      }
                      disabled={historyPage >= historyPages || historyLoading}
                    >
                      Далі
                    </button>
                  </div>
                  <div style={{ color: "#6e6a67" }}>
                    Стр. {historyPage} / {historyPages}
                  </div>
                </div>
              </>
            ) : (
              <div className="form-hint">Поки що немає генерацій.</div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
