function encodeWin1251(str) {
  const table = {
    "А":0xC0,"Б":0xC1,"В":0xC2,"Г":0xC3,"Д":0xC4,"Е":0xC5,"Ж":0xC6,"З":0xC7,
    "И":0xC8,"Й":0xC9,"К":0xCA,"Л":0xCB,"М":0xCC,"Н":0xCD,"О":0xCE,"П":0xCF,
    "Р":0xD0,"С":0xD1,"Т":0xD2,"У":0xD3,"Ф":0xD4,"Х":0xD5,"Ц":0xD6,"Ч":0xD7,
    "Ш":0xD8,"Щ":0xD9,"Ъ":0xDA,"Ы":0xDB,"Ь":0xDC,"Э":0xDD,"Ю":0xDE,"Я":0xDF,
    "а":0xE0,"б":0xE1,"в":0xE2,"г":0xE3,"д":0xE4,"е":0xE5,"ж":0xE6,"з":0xE7,
    "и":0xE8,"й":0xE9,"к":0xEA,"л":0xEB,"м":0xEC,"н":0xED,"о":0xEE,"п":0xEF,
    "р":0xF0,"с":0xF1,"т":0xF2,"у":0xF3,"ф":0xF4,"х":0xF5,"ц":0xF6,"ч":0xF7,
    "ш":0xF8,"щ":0xF9,"ъ":0xFA,"ы":0xFB,"ь":0xFC,"э":0xFD,"ю":0xFE,"я":0xFF,
    "Ґ":0xA5,"ґ":0xB4,"І":0xB2,"і":0xB3,"Ї":0xAF,"ї":0xBF,"Є":0xAA,"є":0xBA
  };

  const bytes = [];
  for (const ch of str) {
    if (ch.charCodeAt(0) < 128) bytes.push(ch.charCodeAt(0));
    else if (table[ch]) bytes.push(table[ch]);
    else bytes.push(63);
  }
  return bytes;
}

function base64UrlEncode(bytes) {
  let binary = "";
  bytes.forEach(b => binary += String.fromCharCode(b));

  return Buffer.from(binary, "binary")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function validatePaymentData({ name, iban, amount, edrpo }) {
  if (!name || !iban || !amount || !edrpo) throw new Error("Неполные данные для платежа");
  if (!/^UA\d{25,30}$/.test(iban)) throw new Error("Некорректный IBAN");
  if (!/^(\d{8}|\d{10})$/.test(edrpo)) throw new Error("ЕДРПОУ должен быть 8 или 10 цифр");
  if (isNaN(Number(amount))) throw new Error("Сумма должна быть числом");
}


function preparePaymentData(payment) {
  return {
    name: String(payment.Company?.name || "Без названия").trim().replace(/[\u201C\u201D\u201E\u201F]/g, '"'),
    iban: String(payment.Company?.iban || "").trim(),
    amount: Number(payment.amount || 0),
    edrpo: String(payment.Company?.edrpo || "").trim(),
    purpose: String(payment.purpose || "Оплата").trim().replace(/[\u201C\u201D\u201E\u201F]/g, '"')
  };
}



function sanitizeText(value) {
  return String(value || "")
    .replace(/[\u201C\u201D\u201E\u201F«»"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function generateNbuLink({ name, iban, amount, edrpo, purpose }) {
  const safeName = sanitizeText(name);
  const safePurpose = sanitizeText(purpose || "Оплата");
  validatePaymentData({ name: safeName, iban, amount, edrpo });

  const amountNumber = Number(amount);
  const amountStr = Number.isFinite(amountNumber) && amountNumber % 1 === 0
    ? `UAH${amountNumber}`
    : `UAH${amountNumber.toFixed(2)}`;

  const qrLines = [
    "BCD",
    "002",
    "2",
    "UCT",
    "",
    safeName,
    iban,
    amountStr,
    edrpo,
    "",
    "",
    safePurpose
  ];

  const text = qrLines.join("\n");
  const encoded = base64UrlEncode(encodeWin1251(text));

  return encoded;
}




module.exports = { generateNbuLink };
