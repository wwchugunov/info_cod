import Modal from "../../components/Modal";

function CompanyFormFields({ values, onChange }) {
  if (!values) return null;
  return (
    <div className="form-grid">
      <label className="field">
        Назва
        <input
          className="input"
          value={values.name}
          onChange={(e) => onChange("name", e.target.value)}
        />
      </label>
      <label className="field">
        Контактна особа
        <input
          className="input"
          value={values.contact_name}
          onChange={(e) => onChange("contact_name", e.target.value)}
        />
      </label>
      <label className="field">
        Телефон
        <input
          className="input"
          value={values.contact_phone}
          onChange={(e) => onChange("contact_phone", e.target.value)}
        />
      </label>
      <label className="field">
        IBAN
        <input
          className="input"
          value={values.iban}
          onChange={(e) => onChange("iban", e.target.value)}
        />
      </label>
      <label className="field">
        ЄДРПОУ
        <input
          className="input"
          value={values.edrpo}
          onChange={(e) => onChange("edrpo", e.target.value)}
        />
      </label>
      <label className="field">
        Денний ліміт
        <input
          className="input"
          type="number"
          value={values.daily_limit}
          onChange={(e) => onChange("daily_limit", e.target.value)}
        />
      </label>
      <label className="field checkbox">
        <input
          type="checkbox"
          checked={values.use_daily_limit}
          onChange={(e) => onChange("use_daily_limit", e.target.checked)}
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
          value={values.commission_percent}
          onChange={(e) => onChange("commission_percent", e.target.value)}
        />
      </label>
      <label className="field">
        Комісія, фікс.
        <input
          className="input"
          type="number"
          step="0.01"
          min="0"
          value={values.commission_fixed}
          onChange={(e) => onChange("commission_fixed", e.target.value)}
        />
      </label>
      <label className="field checkbox">
        <input
          type="checkbox"
          checked={values.use_percent_commission}
          onChange={(e) => onChange("use_percent_commission", e.target.checked)}
        />
        Використовувати % комісію
      </label>
      <label className="field checkbox">
        <input
          type="checkbox"
          checked={values.use_fixed_commission}
          onChange={(e) => onChange("use_fixed_commission", e.target.checked)}
        />
        Використовувати фікс. комісію
      </label>
      <label className="field checkbox">
        <input
          type="checkbox"
          checked={values.is_active}
          onChange={(e) => onChange("is_active", e.target.checked)}
        />
        Активна
      </label>
      <label className="field">
        Лого URL
        <input
          className="input"
          value={values.logo_url}
          onChange={(e) => onChange("logo_url", e.target.value)}
        />
      </label>
      <label className="field">
        Оферта URL
        <input
          className="input"
          value={values.offer_url}
          onChange={(e) => onChange("offer_url", e.target.value)}
        />
      </label>
      <label className="field">
        IP whitelist (через кому)
        <input
          className="input"
          value={values.ip_whitelist}
          onChange={(e) => onChange("ip_whitelist", e.target.value)}
        />
      </label>
    </div>
  );
}

export default function CompanyFormModal({
  isOpen,
  title,
  subtitle,
  values,
  onChange,
  onClose,
  onSubmit,
  isSaving,
  submitLabel,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="modal-header">
        <h3>{title}</h3>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
      <CompanyFormFields values={values} onChange={onChange} />
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>
          Скасувати
        </button>
        <button className="button" onClick={onSubmit} disabled={isSaving}>
          {isSaving ? "Збереження..." : submitLabel}
        </button>
      </div>
    </Modal>
  );
}
