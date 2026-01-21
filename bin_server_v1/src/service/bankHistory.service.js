const BankHistory = require("../model/bankHistory.model");

async function logBankHistory({
  payment,
  bankShortName = null,
  bankName = null,
  bankPackageAndroid = null,
  bankPackageIos = null,
  platform = null,
  action = null,
  clientIp = null,
  userAgent = null,
}) {
  if (!payment) return null;
  return BankHistory.create({
    payment_id: payment.id,
    company_id: payment.company_id,
    company_name: payment.company_name || payment.Company?.name || null,
    link_id: payment.link_id,
    bank_short_name: bankShortName,
    bank_name: bankName,
    bank_package_android: bankPackageAndroid,
    bank_package_ios: bankPackageIos,
    platform,
    action,
    client_ip: clientIp,
    user_agent: userAgent,
  });
}

module.exports = { logBankHistory };
