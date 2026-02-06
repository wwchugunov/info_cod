export default function Modal({
  isOpen,
  onClose,
  children,
  containerClassName = "modal",
}) {
  if (!isOpen) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={containerClassName} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
