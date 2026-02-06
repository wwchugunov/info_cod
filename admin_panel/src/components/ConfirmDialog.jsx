import Modal from "./Modal";

export default function ConfirmDialog({ dialog, onClose }) {
  if (!dialog) return null;

  const handleCancel = () => {
    if (dialog.onCancel) {
      dialog.onCancel();
    } else if (onClose) {
      onClose();
    }
  };

  const handleConfirm = () => {
    if (dialog.onConfirm) {
      dialog.onConfirm();
    }
  };

  return (
    <Modal isOpen={Boolean(dialog)} onClose={onClose} containerClassName="dialog">
      <div className="modal-header">
        <h3>{dialog.title}</h3>
      </div>
      <p className="dialog-text">{dialog.message}</p>
      <div className="modal-actions">
        {dialog.cancelText ? (
          <button className="button secondary" onClick={handleCancel}>
            {dialog.cancelText}
          </button>
        ) : null}
        <button className="button danger" onClick={handleConfirm}>
          {dialog.confirmText}
        </button>
      </div>
    </Modal>
  );
}
