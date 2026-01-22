const ScanHistory = require("../model/scanHistory.model");

async function logScanHistory({
  payment,
  clientIp = null,
  userAgent = null,
  platform = null,
  language = null,
  screen = null,
  timezone = null,
  referrer = null,
  device = null,
  upsert = false,
}) {
  if (!payment) return null;
  const linkId = payment.link_id;
  let isDuplicate = false;

  if (linkId && clientIp) {
    const existing = await ScanHistory.findOne({
      where: { link_id: linkId, client_ip: clientIp },
      attributes: ["id"],
    });
    isDuplicate = Boolean(existing);
    if (existing && upsert) {
      await ScanHistory.update(
        {
          user_agent: userAgent,
          platform,
          language,
          screen,
          timezone,
          referrer,
          device,
        },
        { where: { id: existing.id } }
      );
      return ScanHistory.findByPk(existing.id);
    }
  }

  return ScanHistory.create({
    payment_id: payment.id,
    company_id: payment.company_id,
    company_name: payment.company_name || payment.Company?.name || null,
    link_id: linkId,
    client_ip: clientIp,
    user_agent: userAgent,
    platform,
    language,
    screen,
    timezone,
    referrer,
    device,
    is_duplicate: isDuplicate,
  });
}

module.exports = { logScanHistory };
