const GenerationHistory = require("../model/generationHistory.model");

async function logGenerationHistory({
  company,
  tokenHash = null,
  status = "success",
  amount = null,
  commissionPercent = null,
  commissionFixed = null,
  finalAmount = null,
  purpose = null,
  linkId = null,
  clientIp = null,
  userAgent = null,
  errorCode = null,
  errorMessage = null,
}) {
  if (!company) return null;

  return GenerationHistory.create({
    company_id: company.id,
    company_name: company.name,
    token_hash: tokenHash,
    amount,
    commission_percent: commissionPercent,
    commission_fixed: commissionFixed,
    final_amount: finalAmount,
    purpose,
    link_id: linkId,
    client_ip: clientIp,
    user_agent: userAgent,
    status,
    error_code: errorCode,
    error_message: errorMessage,
  });
}

module.exports = { logGenerationHistory };
