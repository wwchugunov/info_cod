const Company = require('../model/company.model');
const crypto = require('crypto');
const {
  isValidIban,
  isValidEdrpo,
  normalizeText,
} = require('./validation.utils');

function generateApiToken() {
  return crypto.randomBytes(32).toString('hex');
}

function parseNumber(value, fieldName) {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`Некоректне значення поля ${fieldName}`);
  }
  return num;
}

async function registerCompany(data, options = {}) {
  const {
    name,
    contact_name,
    contact_phone,
    iban,
    edrpo,
    logo_url,
    offer_url,
    daily_limit,
    use_daily_limit,
    commission_percent,
    commission_fixed,
    use_percent_commission,
    use_fixed_commission,
    turnover,
    is_active
  } = data;

  const normalizedName = normalizeText(name);
  const normalizedContactName = normalizeText(contact_name);
  const normalizedContactPhone = normalizeText(contact_phone);
  const normalizedIban = normalizeText(iban);
  const normalizedEdrpo = normalizeText(edrpo);

  if (!normalizedName || !normalizedContactName || !normalizedContactPhone || !normalizedIban || !normalizedEdrpo) {
    throw new Error('Не заповнені обовʼязкові поля');
  }
  // if (!isValidIban(normalizedIban)) {
  //   throw new Error('Некоректний IBAN');
  // }
  if (!isValidEdrpo(normalizedEdrpo)) {
    throw new Error('ЄДРПОУ повинен містити 8 або 10 цифр');
  }

  const normalizedDailyLimit = parseNumber(daily_limit, "daily_limit");
  const normalizedCommissionPercent = parseNumber(commission_percent, "commission_percent");
  const normalizedCommissionFixed = parseNumber(commission_fixed, "commission_fixed");
  const normalizedTurnover = parseNumber(turnover, "turnover");
  if (normalizedCommissionPercent !== undefined && normalizedCommissionPercent < 0) {
    throw new Error("Комісія не може бути відʼємною");
  }
  if (normalizedCommissionFixed !== undefined && normalizedCommissionFixed < 0) {
    throw new Error("Комісія не може бути відʼємною");
  }

  const parentCandidate = await Company.findOne({
    where: { edrpo: normalizedEdrpo },
    order: [["id", "ASC"]],
  });

  const api_token = generateApiToken();
  const api_token_prefix = api_token.slice(0, 8);

  const company = await Company.create({
    name: normalizedName,
    contact_name: normalizedContactName,
    contact_phone: normalizedContactPhone,
    iban: normalizedIban,
    edrpo: normalizedEdrpo,
    logo_url: logo_url || null,
    offer_url: offer_url || null,
    daily_limit: normalizedDailyLimit ?? 1000,
    use_daily_limit: use_daily_limit ?? true,
    commission_percent: normalizedCommissionPercent ?? 0,
    commission_fixed: normalizedCommissionFixed ?? 0,
    use_percent_commission: use_percent_commission ?? true,
    use_fixed_commission: use_fixed_commission ?? true,
    api_token,
    api_token_last: api_token,
    api_token_prefix,
    turnover: normalizedTurnover ?? 0,
    is_active: is_active ?? true
  }, options);

  return {
    company,
    apiTokenPlain: api_token,
    isSubCompany: Boolean(parentCandidate),
    parentCompanyId: parentCandidate ? parentCandidate.id : null,
  };
}

module.exports = { registerCompany, generateApiToken };
