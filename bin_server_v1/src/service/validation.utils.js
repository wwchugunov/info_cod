const IBAN_REGEX = /^UA\d{25,30}$/;
const EDRPOU_REGEX = /^(\d{8}|\d{10})$/;

function isValidIbanChecksum(iban) {
  const normalized = String(iban || "").replace(/\s+/g, "").toUpperCase();
  if (!IBAN_REGEX.test(normalized)) {
    return false;
  }
  const rearranged = normalized.slice(4) + normalized.slice(0, 4);
  let numeric = "";
  for (const ch of rearranged) {
    if (ch >= "A" && ch <= "Z") {
      numeric += String(ch.charCodeAt(0) - 55);
    } else {
      numeric += ch;
    }
  }
  let mod = 0;
  for (const digit of numeric) {
    mod = (mod * 10 + (digit.charCodeAt(0) - 48)) % 97;
  }
  return mod === 1;
}

function isValidIban(iban) {
  return isValidIbanChecksum(iban);
}

function isValidEdrpo(edrpo) {
  return EDRPOU_REGEX.test(String(edrpo || "").trim());
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

module.exports = { isValidIban, isValidEdrpo, normalizeText };
