const EditablePaymentLink = require("./model");

async function createEditablePaymentLink({
  company,
  amount,
  purpose,
  allowAmountEdit,
  linkId,
  expiresAt,
}) {
  if (!company) {
    throw new Error("Company not found");
  }
  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error("Некоректна сума");
  }
  const normalizedPurpose = String(purpose || "").trim();
  if (!normalizedPurpose) {
    throw new Error("Не вказано призначення");
  }
  const normalizedLinkId = String(linkId || "").trim();
  if (!normalizedLinkId) {
    throw new Error("Не вказано ID посилання");
  }

  const recordData = {
    company_id: company.id,
    amount: normalizedAmount,
    purpose: normalizedPurpose,
    allow_amount_edit: Boolean(allowAmountEdit),
    link_id: normalizedLinkId,
  };
  if (expiresAt) {
    recordData.expires_at = expiresAt;
  }
  const record = await EditablePaymentLink.create(recordData);

  return record.toJSON();
}

module.exports = { createEditablePaymentLink };
