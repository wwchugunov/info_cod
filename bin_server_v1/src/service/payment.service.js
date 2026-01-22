const { v4: uuidv4 } = require("uuid");
const { Op } = require("sequelize");
const Payment = require("../model/generatelink");
const { generateNbuLink } = require("./nbu.service");
const { calculateCommission, getDayRange } = require("./payment.utils");
const { buildPaymentLink } = require("./url.utils");
const { isValidIban, normalizeText } = require("./validation.utils");
const { logGenerationHistory } = require("./generationHistory.service");

function createError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

async function createPayment(
  company,
  amount,
  purpose,
  iban,
  client_ip = null,
  user_agent = null,
  tokenHash = null
) {
  if (!company) {
    throw createError("COMPANY_MISSING", "Компания не указана");
  }
  const normalizedAmount = Number(amount);
  const normalizedPurpose = normalizeText(purpose);
  const effectiveIban = iban || company.iban;
  if (!effectiveIban) {
    throw createError("IBAN_MISSING", "IBAN не указан");
  }
  if (!isValidIban(effectiveIban)) {
    throw createError("IBAN_INVALID", "Некорректный IBAN");
  }
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw createError("AMOUNT_INVALID", "Некорректная сумма платежа");
  }
  if (!normalizedPurpose) {
    throw createError("PURPOSE_MISSING", "Не указано назначение платежа");
  }
  if (normalizedPurpose.length > 255) {
    throw createError("PURPOSE_TOO_LONG", "Слишком длинное назначение платежа");
  }
  const { start: startOfDay, end: endOfDay } = getDayRange();

  const dailyLimitEnabled = company.use_daily_limit !== false;
  const dailyLimit = Number(company.daily_limit);
  if (dailyLimitEnabled && Number.isFinite(dailyLimit) && dailyLimit > 0) {
    const countToday = await Payment.count({
      where: {
        company_id: company.id,
        created_at: { [Op.gte]: startOfDay, [Op.lt]: endOfDay },
      },
    });

    if (countToday >= dailyLimit) {
      throw createError("DAILY_LIMIT_REACHED", "Превышен лимит генераций на сегодня");
    }
  }
  const { commissionPercent, commissionFixed, finalAmount } =
    calculateCommission(company, normalizedAmount);
  const linkId = uuidv4();

  await Payment.create({
    company_id: company.id,
    company_name: company.name,
    amount: normalizedAmount,
    purpose: normalizedPurpose,
    iban: effectiveIban,
    commission_percent: commissionPercent,
    commission_fixed: commissionFixed,
    link_id: linkId,
    status: "pending",
    client_ip,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  await logGenerationHistory({
    company,
    tokenHash,
    status: "success",
    amount: normalizedAmount,
    commissionPercent,
    commissionFixed,
    finalAmount,
    purpose: normalizedPurpose,
    linkId,
    clientIp: client_ip,
    userAgent: user_agent,
  });



  const nbuLink = generateNbuLink({
    name: company.name,
    iban: effectiveIban,
    edrpo: company.edrpo,
    amount: finalAmount,
    purpose: normalizedPurpose
  });

  const qrlink = nbuLink;
  return {
    originalAmount: normalizedAmount,
    commissionPercent,
    commissionFixed,
    finalAmount,
    linkId: buildPaymentLink(linkId),
    qr_link: linkId,
    qrlink,
  };

}



module.exports = { createPayment };
