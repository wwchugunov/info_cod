const IBAN_REGEX = /^UA\d{25,30}$/;
const EDRPOU_REGEX = /^(\d{8}|\d{10})$/;

function isValidIban(iban) {
  return IBAN_REGEX.test(String(iban || "").trim());
}

function isValidEdrpo(edrpo) {
  return EDRPOU_REGEX.test(String(edrpo || "").trim());
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

module.exports = { isValidIban, isValidEdrpo, normalizeText };
