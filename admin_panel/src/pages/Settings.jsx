import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar";
import api from "../services/api";
import { clearTokens, getRefreshToken, isTokenAuthMode } from "../services/auth";
import useAdminInfo from "../hooks/useAdminInfo";

export default function Settings() {
  const [form, setForm] = useState({ password: "" });
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { role } = useAdminInfo();

  const saveProfile = async () => {
    setSaving(true);
    setStatus("");
    try {
      await api.patch("/admin/auth/profile", {
        password: form.password,
      });
      setStatus("Дані оновлено. Увійдіть знову.");
      clearTokens();
    } catch (err) {
      const message =
        err?.response?.data?.message || "Не вдалося оновити профіль";
      setStatus(message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (isTokenAuthMode()) {
        const refreshToken = getRefreshToken();
        await api.post("/admin/auth/logout", { refresh_token: refreshToken });
      } else {
        await api.post("/admin/auth/logout");
      }
    } catch {
      // ignore logout errors
    }
    clearTokens();
    navigate("/login", { replace: true });
  };

  return (
    <div className="main-area">
      <Topbar title="Налаштування" subtitle="Доступ і конфігурація" />
      <div className="section" style={{ marginBottom: 16 }}>
        <div className="section-header">
          <strong>Профіль</strong>
        </div>
        <div className="filter-row">
          <input
            className="input"
            placeholder="Новий пароль"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <button className="button" onClick={saveProfile} disabled={saving}>
            {saving ? "Збереження..." : "Зберегти"}
          </button>
        </div>
        {status ? <p className="form-hint">{status}</p> : null}
      </div>
      <div className="section">
        <div className="section-header">
          <strong>Сесія</strong>
        </div>
        <p style={{ color: "#6e6a67" }}>
          Для виходу з панелі очистьте токени.
        </p>
        <button className="button secondary" onClick={handleLogout}>
          Вийти
        </button>
      </div>
      {role === "superadmin" ? (
        <div className="section">
          <div className="section-header">
            <strong>Інструкції для суперадміністратора</strong>
          </div>
          <div className="card-grid">
            <div className="card">
              <h3>Ролі та доступ</h3>
              <p style={{ color: "#6e6a67", lineHeight: 1.6 }}>
                Суперадміністратор має повний доступ до всіх розділів, компаній і
                адмін‑користувачів. Адміністратор працює тільки в рамках своєї
                компанії та повʼязаних компаній з однаковим ЄДРПОУ. Менеджер має
                доступ тільки до перегляду даних у межах своєї компанії та
                повʼязаних компаній. Переглядач (viewer) бачить тільки списки
                та історію без можливості змінювати налаштування.
              </p>
              <p style={{ color: "#6e6a67", lineHeight: 1.6 }}>
                Доступ до розділів також регулюється роллю: наприклад, розділи
                «Помилки», «Навантаження», «Адмін‑користувачі» доступні тільки
                суперадміністратору.
              </p>
            </div>
            <div className="card">
              <h3>Скоп даних (що бачить користувач)</h3>
              <p style={{ color: "#6e6a67", lineHeight: 1.6 }}>
                Усі списки (платежі, історії генерацій, сканування, банківська
                історія, метрики, звіти) фільтруються за компанією з токена
                користувача. Якщо у компанії є ЄДРПОУ, система дозволяє бачити
                також дочірні компанії з тим самим ЄДРПОУ. Суперадміністратор
                бачить всі компанії без обмежень.
              </p>
              <p style={{ color: "#6e6a67", lineHeight: 1.6 }}>
                Якщо у запиті вказано конкретний `company_id`, дані будуть
                показані тільки для цього `company_id` у рамках дозволеного
                доступу.
              </p>
            </div>
            <div className="card">
              <h3>Права (permissions)</h3>
              <p style={{ color: "#6e6a67", lineHeight: 1.6 }}>
                Права зберігаються у профілі адмін‑користувача і доповнюють роль.
                За замовчуванням у нового користувача права порожні. Основні
                ключі:
              </p>
              <ul style={{ color: "#6e6a67", lineHeight: 1.6 }}>
                <li>company_create — створення компаній.</li>
                <li>company_edit — редагування даних компанії.</li>
                <li>company_delete — видалення компаній.</li>
                <li>limit_change — зміна денного ліміту.</li>
                <li>limit_toggle — увімкнення/вимкнення ліміту.</li>
                <li>token_generate — ротація API токена.</li>
                <li>reports_download — завантаження звітів.</li>
              </ul>
              <p style={{ color: "#6e6a67", lineHeight: 1.6 }}>
                Якщо права немає, дія блокується навіть при достатній ролі.
              </p>
            </div>
            <div className="card">
              <h3>Створення компанії за замовчуванням</h3>
              <p style={{ color: "#6e6a67", lineHeight: 1.6 }}>
                При створенні компанії система:
              </p>
              <ul style={{ color: "#6e6a67", lineHeight: 1.6 }}>
                <li>створює компанію з активним статусом;</li>
                <li>генерує API‑токен і зберігає його у зашифрованому вигляді;</li>
                <li>встановлює денний ліміт 1000 та комісію 0;</li>
                <li>включає відсоткову та фіксовану комісію;</li>
                <li>визначає дочірню компанію за збігом ЄДРПОУ;</li>
                <li>
                  створює адмін‑логін і пароль з мінімальною роллю (viewer).
                </li>
              </ul>
              <p style={{ color: "#6e6a67", lineHeight: 1.6 }}>
                Після створення суперадміністратор може підвищити роль або
                видати необхідні права у розділі «Адмін‑користувачі».
              </p>
            </div>
            <div className="card">
              <h3>Як працюють операції</h3>
              <p style={{ color: "#6e6a67", lineHeight: 1.6 }}>
                Генерація платежу створює запис у платежах зі статусом
                «pending» та запис в історії генерацій. При відкритті сторінки
                платежу збільшується лічильник переглядів і створюється запис у
                історії сканувань. Переходи у банк фіксуються у банківській
                історії. Статус платежу може змінюватися на «delivered» при
                підтвердженні оплати.
              </p>
            </div>
            <div className="card">
              <h3>Звіти та експорт</h3>
              <p style={{ color: "#6e6a67", lineHeight: 1.6 }}>
                Експорт CSV/XLSX доступний лише при праві
                <strong> reports_download</strong>. CSV формується з роздільником
                «;», що коректно відкривається у Excel з кирилицею. PDF містить
                підсумки та графік по вибраному періоду.
              </p>
            </div>
            <div className="card">
              <h3>Безпека і токени</h3>
              <p style={{ color: "#6e6a67", lineHeight: 1.6 }}>
                API‑токени зберігаються у зашифрованому вигляді, пошук відбувається
                по префіксу токена. Адмін‑сесії працюють через JWT access/refresh
                токени з обмеженим часом життя. Профільні зміни вимагають
                повторного входу.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
