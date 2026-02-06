import Modal from "../../components/Modal";

export default function CompanyPermissionsModal({
  dialog,
  permissionItems,
  onUpdatePermission,
  onSave,
  onClose,
  onCreateUser,
  canConfigure,
}) {
  if (!dialog) return null;

  return (
    <Modal isOpen={Boolean(dialog)} onClose={onClose}>
      <div className="modal-header">
        <h3>Права користувачів</h3>
        <span>{dialog.company?.name || "Компанія"}</span>
      </div>
      {dialog.users.length ? (
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
              {dialog.users.map((user) => (
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
                          onUpdatePermission(user.id, item.key, e.target.checked)
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
        {canConfigure && dialog.company && !dialog.users.length ? (
          <button className="button secondary" onClick={() => onCreateUser(dialog.company)}>
            Створити користувача
          </button>
        ) : null}
        <button className="button secondary" onClick={onClose}>
          Скасувати
        </button>
        <button className="button" onClick={onSave} disabled={dialog.saving}>
          {dialog.saving ? "Збереження..." : "Зберегти"}
        </button>
      </div>
    </Modal>
  );
}
