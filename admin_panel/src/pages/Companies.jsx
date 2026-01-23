import { useEffect, useState } from "react";
import api from "../services/api";
import Topbar from "../components/Topbar";
import useAdminInfo from "../hooks/useAdminInfo";

export default function Companies() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState(null);
  const [createSaving, setCreateSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [permissionsDialog, setPermissionsDialog] = useState(null);
  const [createdAdmin, setCreatedAdmin] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const { permissions = {}, role } = useAdminInfo();
  const permissionItems = [
    { key: "company_create", label: "Створювати компанії" },
    { key: "company_edit", label: "Редагувати компанії" },
    { key: "company_delete", label: "Видаляти компанії" },
    { key: "limit_change", label: "Змінювати ліміт" },
    { key: "limit_toggle", label: "Вимикати ліміт" },
    { key: "token_generate", label: "Генерувати токен" },
    { key: "reports_download", label: "Завантажувати звіти" },
  ];

  const load = () => {
    api
      .get("/admin/companies", { params: { search: search.trim() } })
      .then((res) => setItems(res.data.items || []))
      .catch(() => setItems([]));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      load();
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  const toggleActive = (company) => {
    api
      .patch(`/admin/companies/${company.id}`, {
        is_active: !company.is_active,
      })
      .then(() => load());
  };

  const openEdit = (company) => {
    setEditing(company);
    setForm({
      name: company.name || "",
      contact_name: company.contact_name || "",
      contact_phone: company.contact_phone || "",
      iban: company.iban || "",
      edrpo: company.edrpo || "",
      daily_limit:
        company.daily_limit === null || company.daily_limit === undefined
          ? ""
          : String(company.daily_limit),
      use_daily_limit: company.use_daily_limit !== false,
      commission_percent:
        company.commission_percent === null ||
        company.commission_percent === undefined
          ? ""
          : String(company.commission_percent),
      commission_fixed:
        company.commission_fixed === null || company.commission_fixed === undefined
          ? ""
          : String(company.commission_fixed),
      use_percent_commission: Boolean(company.use_percent_commission),
      use_fixed_commission: Boolean(company.use_fixed_commission),
      is_active: Boolean(company.is_active),
      logo_url: company.logo_url || "",
      offer_url: company.offer_url || "",
      ip_whitelist: Array.isArray(company.ip_whitelist)
        ? company.ip_whitelist.join(", ")
        : "",
    });
  };

  const closeEdit = () => {
    setEditing(null);
    setForm(null);
    setSaving(false);
  };

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateCreateField = (field, value) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const buildPayload = (data) => ({
    name: data.name.trim(),
    contact_name: data.contact_name.trim(),
    contact_phone: data.contact_phone.trim(),
    iban: data.iban.trim(),
    edrpo: data.edrpo.trim(),
    daily_limit: data.daily_limit === "" ? undefined : Number(data.daily_limit),
    use_daily_limit: data.use_daily_limit,
    commission_percent:
      data.commission_percent === "" ? undefined : Number(data.commission_percent),
    commission_fixed:
      data.commission_fixed === "" ? undefined : Number(data.commission_fixed),
    use_percent_commission: data.use_percent_commission,
    use_fixed_commission: data.use_fixed_commission,
    is_active: data.is_active,
    logo_url: data.logo_url.trim() || null,
    offer_url: data.offer_url.trim() || null,
    ip_whitelist: data.ip_whitelist
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean),
  });

  const showAlert = (message) => {
    setDialog({
      title: "Повідомлення",
      message,
      confirmText: "Ок",
      onConfirm: () => setDialog(null),
    });
  };

  const showConfirm = (title, message, onConfirm) => {
    setDialog({
      title,
      message,
      confirmText: "Видалити",
      cancelText: "Скасувати",
      onConfirm,
      onCancel: () => setDialog(null),
    });
  };

  const saveEdit = () => {
    if (!editing || !form) return;
    setSaving(true);

    const payload = buildPayload(form);

    api
      .patch(`/admin/companies/${editing.id}`, payload)
      .then(() => {
        closeEdit();
        load();
      })
      .catch((err) => {
        const message =
          err?.response?.data?.message || "Не вдалося зберегти зміни";
        showAlert(message);
        setSaving(false);
      });
  };

  const openCreate = () => {
    setCreating(true);
    setCreateForm({
      name: "",
      contact_name: "",
      contact_phone: "",
      iban: "",
      edrpo: "",
      daily_limit: "",
      use_daily_limit: true,
      commission_percent: "",
      commission_fixed: "",
      use_percent_commission: true,
      use_fixed_commission: true,
      is_active: true,
      logo_url: "",
      offer_url: "",
      ip_whitelist: "",
    });
  };

  const closeCreate = () => {
    setCreating(false);
    setCreateForm(null);
    setCreateSaving(false);
  };

  const saveCreate = () => {
    if (!createForm) return;
    setCreateSaving(true);
    const payload = buildPayload(createForm);

    api
      .post("/admin/companies", payload)
      .then((res) => {
        setRegistration(res.data || null);
        closeCreate();
        load();
      })
      .catch((err) => {
        const message =
          err?.response?.data?.message || "Не вдалося зареєструвати компанію";
        showAlert(message);
        setCreateSaving(false);
      });
  };

  const removeCompany = (company) => {
    showConfirm(
      "Видалення компанії",
      `Видалити компанію "${company.name}"? Платежі будуть видалені, історія залишиться.`,
      () => {
        setDialog(null);
        api
          .delete(`/admin/companies/${company.id}`)
          .then(() => load())
          .catch((err) => {
            const message =
              err?.response?.data?.message || "Не вдалося видалити компанію";
            showAlert(message);
          });
      }
    );
  };

  const toggleLimit = (company) => {
    api
      .patch(`/admin/companies/${company.id}`, {
        use_daily_limit: company.use_daily_limit === false,
      })
      .then(() => load())
      .catch((err) => {
        const message =
          err?.response?.data?.message || "Не вдалося оновити ліміт";
        showAlert(message);
      });
  };

  const toggleMenu = (companyId) => {
    setMenuOpenId((prev) => (prev === companyId ? null : companyId));
  };

  useEffect(() => {
    const handleClick = (event) => {
      if (!event.target.closest(".menu-wrap")) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const changeLimit = (company) => {
    const nextValue = window.prompt(
      "Новий денний ліміт:",
      company.daily_limit ?? ""
    );
    if (nextValue === null) return;
    const normalized = Number(nextValue);
    if (!Number.isFinite(normalized) || normalized < 0) {
      showAlert("Некоректний ліміт");
      return;
    }
    api
      .patch(`/admin/companies/${company.id}`, { daily_limit: normalized })
      .then(() => load())
      .catch((err) => {
        const message =
          err?.response?.data?.message || "Не вдалося оновити ліміт";
        showAlert(message);
      });
  };

  const openPermissions = (company) => {
    api
      .get("/admin/admin-users", { params: { company_id: company.id } })
      .then((res) => {
        setPermissionsDialog({
          company,
          users: (res.data || []).map((user) => ({
            ...user,
            permissions: user.permissions || {},
          })),
          saving: false,
        });
      })
      .catch(() => {
        showAlert("Не вдалося завантажити користувачів");
      });
  };

  const createCompanyAdminUser = (company) => {
    api
      .post(`/admin/companies/${company.id}/admin-user`)
      .then((res) => {
        setCreatedAdmin({
          login: res.data.admin_login,
          password: res.data.admin_password,
        });
        openPermissions(company);
      })
      .catch((err) => {
        const message =
          err?.response?.data?.message || "Не вдалося створити користувача";
        showAlert(message);
      });
  };

  const updatePermission = (userId, key, value) => {
    setPermissionsDialog((prev) => {
      if (!prev) return prev;
      const users = prev.users.map((user) =>
        user.id === userId
          ? {
              ...user,
              permissions: {
                ...user.permissions,
                [key]: value,
              },
            }
          : user
      );
      return { ...prev, users };
    });
  };

  const savePermissions = () => {
    if (!permissionsDialog) return;
    setPermissionsDialog((prev) => ({ ...prev, saving: true }));
    const requests = permissionsDialog.users.map((user) =>
      api.patch(`/admin/admin-users/${user.id}`, {
        permissions: user.permissions,
      })
    );
    Promise.all(requests)
      .then(() => {
        setPermissionsDialog(null);
      })
      .catch(() => {
        showAlert("Не вдалося зберегти права");
        setPermissionsDialog((prev) => ({ ...prev, saving: false }));
      });
  };

  const isSuperAdmin = role === "superadmin";
  const canCreate = isSuperAdmin || Boolean(permissions.company_create);
  const canEdit = isSuperAdmin || Boolean(permissions.company_edit);
  const canDelete = isSuperAdmin || Boolean(permissions.company_delete);
  const canChangeLimit = isSuperAdmin || Boolean(permissions.limit_change);
  const canToggleLimit = isSuperAdmin || Boolean(permissions.limit_toggle);
  const canConfigure = isSuperAdmin;

  return (
    <div className="main-area">
      <Topbar
        title="Компанії"
        subtitle="Керування доступом і лімітами"
        actions={
          <div className="topbar-actions">
            <input
              className="search-input"
              placeholder="ID, назва або ЄДРПОУ"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="button" onClick={load}>
              Знайти
            </button>
            <button
              className="button secondary"
              onClick={() =>
                canCreate
                  ? openCreate()
                  : showAlert("Недостатньо прав для реєстрації компанії.")
              }
            >
              Зареєструвати
            </button>
          </div>
        }
      />
      <div className="section">
        <div className="section-header">
          <strong>Список компаній</strong>
          <button className="button" onClick={load}>
            Оновити
          </button>
        </div>
        <div className="table-wrap menu-table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Назва</th>
                <th>ЄДРПОУ</th>
              <th>IBAN</th>
              <th>Ліміт (усього/залишок)</th>
              <th>Ліміт активний</th>
              <th>Активна</th>
              <th>Дії</th>
            </tr>
            </thead>
            <tbody>
              {items.map((company) => (
                <tr key={company.id}>
                  <td>{company.id}</td>
                  <td>
                    <div className="cell-stack">
                      <span>{company.name}</span>
                      {company.is_sub_company ? (
                        <>
                          <span className="badge">Дочірня</span>
                          {company.parent_company_id ? (
                            <small className="muted-text">
                              Осн. #{company.parent_company_id}
                            </small>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </td>
                  <td>{company.edrpo}</td>
                  <td>{company.iban}</td>
                  <td>
                    <div className="limit-stack">
                      <span>
                        {company.daily_limit_total ?? company.daily_limit ?? "—"} /{" "}
                        {company.daily_limit_remaining !== null &&
                        company.daily_limit_remaining !== undefined
                          ? company.daily_limit_remaining
                          : "—"}
                      </span>
                      <small>
                        Використано: {company.daily_limit_used ?? "—"}
                      </small>
                    </div>
                  </td>
                  <td>
                    <span className="badge">
                      {company.use_daily_limit === false ? "Ні" : "Так"}
                    </span>
                  </td>
                  <td>
                    <span className="badge">
                      {company.is_active ? "Так" : "Ні"}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <div className="menu-wrap">
                      <button
                        className="menu-trigger"
                        onClick={() => toggleMenu(company.id)}
                      >
                        ...
                      </button>
                      {menuOpenId === company.id ? (
                        <div className="menu-panel">
                      {canEdit ? (
                        <button
                          className="menu-item"
                          onClick={() => {
                            toggleActive(company);
                            setMenuOpenId(null);
                          }}
                        >
                          {company.is_active
                                ? "Деактивувати"
                                : "Активувати"}
                        </button>
                      ) : null}
                      {canEdit ? (
                        <button
                          className="menu-item"
                          onClick={() => {
                            openEdit(company);
                            setMenuOpenId(null);
                          }}
                        >
                          Редагувати
                        </button>
                      ) : null}
                      {canChangeLimit ? (
                        <button
                          className="menu-item"
                          onClick={() => {
                            changeLimit(company);
                            setMenuOpenId(null);
                          }}
                        >
                          Змінити ліміт
                        </button>
                      ) : null}
                      {canToggleLimit ? (
                        <button
                          className="menu-item"
                          onClick={() => {
                            toggleLimit(company);
                            setMenuOpenId(null);
                          }}
                        >
                          {company.use_daily_limit === false
                                ? "Увімкнути ліміт"
                                : "Вимкнути ліміт"}
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button
                          className="menu-item danger"
                          onClick={() => {
                            removeCompany(company);
                            setMenuOpenId(null);
                          }}
                        >
                          Видалити
                        </button>
                      ) : null}
                      {canConfigure ? (
                        <button
                          className="menu-item"
                          onClick={() => {
                            openPermissions(company);
                            setMenuOpenId(null);
                          }}
                        >
                          Налаштувати
                        </button>
                      ) : null}
                          {!canEdit &&
                          !canDelete &&
                          !canToggleLimit &&
                          !canChangeLimit &&
                          !canConfigure ? (
                            <div className="menu-empty">Немає дій</div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editing && form ? (
        <div className="modal-backdrop" onClick={closeEdit}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Редагування компанії</h3>
              <span>ID {editing.id}</span>
            </div>
            <div className="form-grid">
              <label className="field">
                Назва
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                />
              </label>
              <label className="field">
                Контактна особа
                <input
                  className="input"
                  value={form.contact_name}
                  onChange={(e) => updateField("contact_name", e.target.value)}
                />
              </label>
              <label className="field">
                Телефон
                <input
                  className="input"
                  value={form.contact_phone}
                  onChange={(e) => updateField("contact_phone", e.target.value)}
                />
              </label>
              <label className="field">
                IBAN
                <input
                  className="input"
                  value={form.iban}
                  onChange={(e) => updateField("iban", e.target.value)}
                />
              </label>
              <label className="field">
                ЄДРПОУ
                <input
                  className="input"
                  value={form.edrpo}
                  onChange={(e) => updateField("edrpo", e.target.value)}
                />
              </label>
              <label className="field">
                Денний ліміт
                <input
                  className="input"
                  type="number"
                  value={form.daily_limit}
                  onChange={(e) => updateField("daily_limit", e.target.value)}
                />
              </label>
              <label className="field checkbox">
                <input
                  type="checkbox"
                  checked={form.use_daily_limit}
                  onChange={(e) => updateField("use_daily_limit", e.target.checked)}
                />
                Ліміт активний
              </label>
              <label className="field">
                Комісія, %
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.commission_percent}
                  onChange={(e) => updateField("commission_percent", e.target.value)}
                />
              </label>
              <label className="field">
                Комісія, фікс.
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.commission_fixed}
                  onChange={(e) => updateField("commission_fixed", e.target.value)}
                />
              </label>
              <label className="field checkbox">
                <input
                  type="checkbox"
                  checked={form.use_percent_commission}
                  onChange={(e) =>
                    updateField("use_percent_commission", e.target.checked)
                  }
                />
                Використовувати % комісію
              </label>
              <label className="field checkbox">
                <input
                  type="checkbox"
                  checked={form.use_fixed_commission}
                  onChange={(e) => updateField("use_fixed_commission", e.target.checked)}
                />
                Використовувати фікс. комісію
              </label>
              <label className="field checkbox">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => updateField("is_active", e.target.checked)}
                />
                Активна
              </label>
              <label className="field">
                Лого URL
                <input
                  className="input"
                  value={form.logo_url}
                  onChange={(e) => updateField("logo_url", e.target.value)}
                />
              </label>
              <label className="field">
                Оферта URL
                <input
                  className="input"
                  value={form.offer_url}
                  onChange={(e) => updateField("offer_url", e.target.value)}
                />
              </label>
              <label className="field">
                IP whitelist (через кому)
                <input
                  className="input"
                  value={form.ip_whitelist}
                  onChange={(e) => updateField("ip_whitelist", e.target.value)}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button className="button secondary" onClick={closeEdit}>
                Скасувати
              </button>
              <button className="button" onClick={saveEdit} disabled={saving}>
                {saving ? "Збереження..." : "Зберегти"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {creating && createForm ? (
        <div className="modal-backdrop" onClick={closeCreate}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Реєстрація компанії</h3>
              <span>Новий запис</span>
            </div>
            <div className="form-grid">
              <label className="field">
                Назва
                <input
                  className="input"
                  value={createForm.name}
                  onChange={(e) => updateCreateField("name", e.target.value)}
                />
              </label>
              <label className="field">
                Контактна особа
                <input
                  className="input"
                  value={createForm.contact_name}
                  onChange={(e) =>
                    updateCreateField("contact_name", e.target.value)
                  }
                />
              </label>
              <label className="field">
                Телефон
                <input
                  className="input"
                  value={createForm.contact_phone}
                  onChange={(e) =>
                    updateCreateField("contact_phone", e.target.value)
                  }
                />
              </label>
              <label className="field">
                IBAN
                <input
                  className="input"
                  value={createForm.iban}
                  onChange={(e) => updateCreateField("iban", e.target.value)}
                />
              </label>
              <label className="field">
                ЄДРПОУ
                <input
                  className="input"
                  value={createForm.edrpo}
                  onChange={(e) => updateCreateField("edrpo", e.target.value)}
                />
              </label>
              <label className="field">
                Денний ліміт
                <input
                  className="input"
                  type="number"
                  value={createForm.daily_limit}
                  onChange={(e) =>
                    updateCreateField("daily_limit", e.target.value)
                  }
                />
              </label>
              <label className="field checkbox">
                <input
                  type="checkbox"
                  checked={createForm.use_daily_limit}
                  onChange={(e) =>
                    updateCreateField("use_daily_limit", e.target.checked)
                  }
                />
                Ліміт активний
              </label>
              <label className="field">
                Комісія, %
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={createForm.commission_percent}
                  onChange={(e) =>
                    updateCreateField("commission_percent", e.target.value)
                  }
                />
              </label>
              <label className="field">
                Комісія, фікс.
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={createForm.commission_fixed}
                  onChange={(e) =>
                    updateCreateField("commission_fixed", e.target.value)
                  }
                />
              </label>
              <label className="field checkbox">
                <input
                  type="checkbox"
                  checked={createForm.use_percent_commission}
                  onChange={(e) =>
                    updateCreateField("use_percent_commission", e.target.checked)
                  }
                />
                Використовувати % комісію
              </label>
              <label className="field checkbox">
                <input
                  type="checkbox"
                  checked={createForm.use_fixed_commission}
                  onChange={(e) =>
                    updateCreateField("use_fixed_commission", e.target.checked)
                  }
                />
                Використовувати фікс. комісію
              </label>
              <label className="field checkbox">
                <input
                  type="checkbox"
                  checked={createForm.is_active}
                  onChange={(e) =>
                    updateCreateField("is_active", e.target.checked)
                  }
                />
                Активна
              </label>
              <label className="field">
                Лого URL
                <input
                  className="input"
                  value={createForm.logo_url}
                  onChange={(e) =>
                    updateCreateField("logo_url", e.target.value)
                  }
                />
              </label>
              <label className="field">
                Оферта URL
                <input
                  className="input"
                  value={createForm.offer_url}
                  onChange={(e) =>
                    updateCreateField("offer_url", e.target.value)
                  }
                />
              </label>
              <label className="field">
                IP whitelist (через кому)
                <input
                  className="input"
                  value={createForm.ip_whitelist}
                  onChange={(e) =>
                    updateCreateField("ip_whitelist", e.target.value)
                  }
                />
              </label>
            </div>
            <div className="modal-actions">
              <button className="button secondary" onClick={closeCreate}>
                Скасувати
              </button>
              <button
                className="button"
                onClick={saveCreate}
                disabled={createSaving}
              >
                {createSaving ? "Реєстрація..." : "Зареєструвати"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {registration ? (
        <div className="modal-backdrop" onClick={() => setRegistration(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Компанію зареєстровано</h3>
              <span>ID {registration.company?.id || "—"}</span>
            </div>
            <div className="form-grid">
              <div className="field">
                Назва
                <strong>{registration.company?.name || "—"}</strong>
              </div>
              <div className="field">
                ЄДРПОУ
                <strong>{registration.company?.edrpo || "—"}</strong>
              </div>
              <div className="field">
                Тип
                <strong>
                  {registration.is_sub_company
                    ? `Дочірня (осн. #${registration.parent_company_id})`
                    : "Основна"}
                </strong>
              </div>
              <div className="field">
                API токен
                <div
                  style={{
                    background: "#f6f2ea",
                    padding: "10px 12px",
                    borderRadius: 12,
                    wordBreak: "break-all",
                    fontFamily: "monospace",
                    color: "#1c1a19",
                  }}
                >
                  {registration.api_token || "Токен не повертається в прод"}
                </div>
              </div>
              <div className="field">
                Логін
                <strong>{registration.admin_login || "—"}</strong>
              </div>
              <div className="field">
                Пароль
                <div
                  style={{
                    background: "#f6f2ea",
                    padding: "10px 12px",
                    borderRadius: 12,
                    wordBreak: "break-all",
                    fontFamily: "monospace",
                    color: "#1c1a19",
                  }}
                >
                  {registration.admin_password || "Пароль не повертається в прод"}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="button"
                onClick={() => setRegistration(null)}
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {permissionsDialog ? (
        <div className="modal-backdrop" onClick={() => setPermissionsDialog(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Права користувачів</h3>
              <span>{permissionsDialog.company?.name || "Компанія"}</span>
            </div>
            {permissionsDialog.users.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Користувач</th>
                      {permissionItems.map((item) => (
                        <th key={item.key}>{item.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {permissionsDialog.users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div className="cell-stack">
                            <span>{user.name || user.email}</span>
                            <small className="muted-text">{user.email}</small>
                          </div>
                        </td>
                        {permissionItems.map((item) => (
                          <td key={item.key}>
                            <input
                              type="checkbox"
                              checked={Boolean(user.permissions?.[item.key])}
                              onChange={(e) =>
                                updatePermission(user.id, item.key, e.target.checked)
                              }
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="form-hint">Користувачів не знайдено.</p>
            )}
            <div className="modal-actions">
              {canConfigure &&
              permissionsDialog.company &&
              !permissionsDialog.users.length ? (
                <button
                  className="button secondary"
                  onClick={() => createCompanyAdminUser(permissionsDialog.company)}
                >
                  Створити користувача
                </button>
              ) : null}
              <button
                className="button secondary"
                onClick={() => setPermissionsDialog(null)}
              >
                Скасувати
              </button>
              <button
                className="button"
                onClick={savePermissions}
                disabled={permissionsDialog.saving}
              >
                {permissionsDialog.saving ? "Збереження..." : "Зберегти"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {createdAdmin ? (
        <div className="modal-backdrop" onClick={() => setCreatedAdmin(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Користувача створено</h3>
              <span>Збережіть доступи</span>
            </div>
            <div className="form-grid">
              <div className="field">
                Логін
                <div
                  style={{
                    background: "#f6f2ea",
                    padding: "10px 12px",
                    borderRadius: 12,
                    wordBreak: "break-all",
                    fontFamily: "monospace",
                    color: "#1c1a19",
                  }}
                >
                  {createdAdmin.login}
                </div>
              </div>
              <div className="field">
                Пароль
                <div
                  style={{
                    background: "#f6f2ea",
                    padding: "10px 12px",
                    borderRadius: 12,
                    wordBreak: "break-all",
                    fontFamily: "monospace",
                    color: "#1c1a19",
                  }}
                >
                  {createdAdmin.password || "Пароль не повертається в прод"}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="button" onClick={() => setCreatedAdmin(null)}>
                Готово
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {dialog ? (
        <div className="modal-backdrop" onClick={() => setDialog(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{dialog.title}</h3>
            </div>
            <p className="dialog-text">{dialog.message}</p>
            <div className="modal-actions">
              {dialog.cancelText ? (
                <button
                  className="button secondary"
                  onClick={dialog.onCancel}
                >
                  {dialog.cancelText}
                </button>
              ) : null}
              <button className="button danger" onClick={dialog.onConfirm}>
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
