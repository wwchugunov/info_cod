const { Op } = require("sequelize");
const Company = require("../../model/company.model");
const Payment = require("../../model/generatelink");
const GenerationHistory = require("../../model/generationHistory.model");
const ScanHistory = require("../../model/scanHistory.model");
const BankHistory = require("../../model/bankHistory.model");
const { toCsvBuffer } = require("../../service/csv.utils");
const {
  buildDateRange,
  getAdminCompanyId,
  getCompanyScope,
  getAdminPermissions,
  hasPermission,
  getGenerationKey,
  getGenerationDuplicateCounts,
  getScanKey,
  getScanDuplicateCounts,
  getCsvEncoding,
} = require("./helpers");

async function exportCompanies(req, res) {
  const permissions = await getAdminPermissions(req);
  if (!hasPermission(permissions, "reports_download")) {
    return res.status(403).json({ message: "Недостаточно прав" });
  }
  const search = String(req.query.search || "").trim();
  const where = {};
  const adminCompanyId = getAdminCompanyId(req);
  if (adminCompanyId) {
    const adminCompany = await Company.findByPk(adminCompanyId, {
      attributes: ["id", "edrpo"],
    });
    if (adminCompany?.edrpo) {
      where.edrpo = adminCompany.edrpo;
    } else {
      where.id = adminCompanyId;
    }
  }
  if (search) {
    const searchNumber = Number(search);
    const conditions = [
      { name: { [Op.iLike]: `%${search}%` } },
      { contact_name: { [Op.iLike]: `%${search}%` } },
      { contact_phone: { [Op.iLike]: `%${search}%` } },
      { iban: { [Op.iLike]: `%${search}%` } },
      { edrpo: { [Op.iLike]: `%${search}%` } },
    ];
    if (Number.isFinite(searchNumber)) {
      conditions.push({ id: searchNumber });
    }
    where[Op.or] = conditions;
  }

  const companies = await Company.findAll({ where, order: [["created_at", "DESC"]] });
  const headers = [
    "id",
    "name",
    "contact_name",
    "contact_phone",
    "iban",
    "edrpo",
    "commission_percent",
    "commission_fixed",
    "use_percent_commission",
    "use_fixed_commission",
    "is_active",
    "created_at",
  ];
  const rows = companies.map((c) => [
    c.id,
    c.name,
    c.contact_name,
    c.contact_phone,
    c.iban,
    c.edrpo,
    c.commission_percent,
    c.commission_fixed,
    c.use_percent_commission,
    c.use_fixed_commission,
    c.is_active,
    c.created_at,
  ]);
  const csvOptions = getCsvEncoding(req);
  const csv = toCsvBuffer(headers, rows, csvOptions);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", `text/csv; charset=${csvOptions.charset}`);
  res.setHeader("Content-Disposition", "attachment; filename=\"companies.csv\"");
  return res.send(csv);
}

async function exportPayments(req, res) {
  const permissions = await getAdminPermissions(req);
  if (!hasPermission(permissions, "reports_download")) {
    return res.status(403).json({ message: "Недостаточно прав" });
  }
  const where = buildDateRange(req.query, "created_at");
  const adminCompanyId = getAdminCompanyId(req);
  const companyId = Number(req.query.company_id);
  const companyIds = await getCompanyScope(
    adminCompanyId,
    Number.isFinite(companyId) ? companyId : null
  );
  if (companyIds && companyIds.length) {
    where.company_id = companyIds;
  } else if (adminCompanyId) {
    where.company_id = adminCompanyId;
  } else if (Number.isFinite(companyId)) {
    where.company_id = companyId;
  }

  const payments = await Payment.findAll({
    where,
    order: [["created_at", "DESC"]],
  });
  const headers = [
    "id",
    "company_id",
    "company_name",
    "amount",
    "commission_percent",
    "commission_fixed",
    "link_id",
    "status",
    "views_count",
    "client_ip",
    "created_at",
    "expires_at",
  ];
  const rows = payments.map((p) => [
    p.id,
    p.company_id,
    p.company_name,
    p.amount,
    p.commission_percent,
    p.commission_fixed,
    p.link_id,
    p.status,
    p.views_count,
    p.client_ip,
    p.created_at,
    p.expires_at,
  ]);
  const csvOptions = getCsvEncoding(req);
  const csv = toCsvBuffer(headers, rows, csvOptions);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", `text/csv; charset=${csvOptions.charset}`);
  res.setHeader("Content-Disposition", "attachment; filename=\"payments.csv\"");
  return res.send(csv);
}

async function exportGenerationHistory(req, res) {
  const permissions = await getAdminPermissions(req);
  if (!hasPermission(permissions, "reports_download")) {
    return res.status(403).json({ message: "Недостаточно прав" });
  }
  const where = buildDateRange(req.query, "created_at");
  const adminCompanyId = getAdminCompanyId(req);
  const companyId = Number(req.query.company_id);
  const companyIds = await getCompanyScope(
    adminCompanyId,
    Number.isFinite(companyId) ? companyId : null
  );
  if (companyIds && companyIds.length) {
    where.company_id = companyIds;
  } else if (adminCompanyId) {
    where.company_id = adminCompanyId;
  } else if (Number.isFinite(companyId)) {
    where.company_id = companyId;
  }
  if (req.query.status) {
    where.status = req.query.status;
  }

  const history = await GenerationHistory.findAll({
    where,
    order: [["created_at", "DESC"]],
  });
  const headers = [
    "id",
    "company_id",
    "company_name",
    "token_hash",
    "amount",
    "commission_percent",
    "commission_fixed",
    "final_amount",
    "purpose",
    "link_id",
    "client_ip",
    "user_agent",
    "created_at",
    "status",
    "error_code",
    "error_message",
    "duplicate_count",
  ];
  const rows = history.map((h) => [
    h.id,
    h.company_id,
    h.company_name,
    h.token_hash,
    h.amount,
    h.commission_percent,
    h.commission_fixed,
    h.final_amount,
    h.purpose,
    h.link_id,
    h.client_ip,
    h.user_agent,
    h.created_at,
    h.status,
    h.error_code,
    h.error_message,
    1,
  ]);
  const generationKeys = history.map((row) => getGenerationKey(row)).filter(Boolean);
  const generationCounts = await getGenerationDuplicateCounts(generationKeys);
  const rowsWithCounts = rows.map((row, index) => {
    const key = getGenerationKey(history[index]);
    const duplicateCount = generationCounts[key] || 1;
    const updated = [...row];
    updated[updated.length - 1] = duplicateCount;
    return updated;
  });
  const csvOptions = getCsvEncoding(req);
  const csv = toCsvBuffer(headers, rowsWithCounts, csvOptions);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", `text/csv; charset=${csvOptions.charset}`);
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=\"generation-history.csv\""
  );
  return res.send(csv);
}

async function exportScanHistory(req, res) {
  const permissions = await getAdminPermissions(req);
  if (!hasPermission(permissions, "reports_download")) {
    return res.status(403).json({ message: "Недостаточно прав" });
  }
  const where = buildDateRange(req.query, "created_at");
  const adminCompanyId = getAdminCompanyId(req);
  const companyId = Number(req.query.company_id);
  const companyIds = await getCompanyScope(
    adminCompanyId,
    Number.isFinite(companyId) ? companyId : null
  );
  if (companyIds && companyIds.length) {
    where.company_id = companyIds;
  } else if (adminCompanyId) {
    where.company_id = adminCompanyId;
  } else if (Number.isFinite(companyId)) {
    where.company_id = companyId;
  }
  if (req.query.is_duplicate === "true") {
    where.is_duplicate = true;
  } else if (req.query.is_duplicate === "false") {
    where.is_duplicate = false;
  }

  const history = await ScanHistory.findAll({
    where,
    order: [["created_at", "DESC"]],
    include: [
      {
        model: Payment,
        attributes: ["id", "amount", "commission_percent", "commission_fixed"],
        include: [
          {
            model: Company,
            attributes: ["name"],
          },
        ],
      },
    ],
  });
  const headers = [
    "id",
    "payment_id",
    "company_id",
    "company_name",
    "link_id",
    "amount",
    "commission",
    "final_amount",
    "client_ip",
    "user_agent",
    "platform",
    "language",
    "screen",
    "timezone",
    "referrer",
    "device",
    "is_duplicate",
    "created_at",
    "duplicate_count",
  ];
  const rows = history.map((h) => {
    const payment = h.Payment || null;
    const amount = payment ? Number(payment.amount || 0) : null;
    const commission = payment
      ? Number(payment.commission_percent || 0) + Number(payment.commission_fixed || 0)
      : null;
    const finalAmount = amount !== null && commission !== null ? amount + commission : null;
    const companyName =
      payment?.Company?.name || payment?.company_name || h.company_name;
    return [
      h.id,
      h.payment_id,
      h.company_id,
      companyName,
      h.link_id,
      amount,
      commission,
      finalAmount,
      h.client_ip,
      h.user_agent,
      h.platform,
      h.language,
      h.screen,
      h.timezone,
      h.referrer,
      h.device,
      h.is_duplicate,
      h.created_at,
      1,
    ];
  });
  const scanKeys = history.map((row) => getScanKey(row));
  const scanCounts = await getScanDuplicateCounts(scanKeys);
  const rowsWithCounts = rows.map((row, index) => {
    const key = getScanKey(history[index]);
    const duplicateCount = scanCounts[key] || 1;
    const updated = [...row];
    updated[updated.length - 1] = duplicateCount;
    return updated;
  });
  const csvOptions = getCsvEncoding(req);
  const csv = toCsvBuffer(headers, rowsWithCounts, csvOptions);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", `text/csv; charset=${csvOptions.charset}`);
  res.setHeader("Content-Disposition", "attachment; filename=\"scan-history.csv\"");
  return res.send(csv);
}

async function exportBankHistory(req, res) {
  const permissions = await getAdminPermissions(req);
  if (!hasPermission(permissions, "reports_download")) {
    return res.status(403).json({ message: "Недостаточно прав" });
  }
  const where = buildDateRange(req.query, "created_at");
  const adminCompanyId = getAdminCompanyId(req);
  const companyId = Number(req.query.company_id);
  const companyIds = await getCompanyScope(
    adminCompanyId,
    Number.isFinite(companyId) ? companyId : null
  );
  if (companyIds && companyIds.length) {
    where.company_id = companyIds;
  } else if (adminCompanyId) {
    where.company_id = adminCompanyId;
  } else if (Number.isFinite(companyId)) {
    where.company_id = companyId;
  }
  if (req.query.bank_short_name) {
    where.bank_short_name = String(req.query.bank_short_name);
  }

  const history = await BankHistory.findAll({
    where,
    order: [["created_at", "DESC"]],
  });
  const headers = [
    "id",
    "payment_id",
    "company_id",
    "company_name",
    "link_id",
    "bank_short_name",
    "bank_name",
    "bank_package_android",
    "bank_package_ios",
    "platform",
    "action",
    "client_ip",
    "user_agent",
    "created_at",
  ];
  const rows = history.map((h) => [
    h.id,
    h.payment_id,
    h.company_id,
    h.company_name,
    h.link_id,
    h.bank_short_name,
    h.bank_name,
    h.bank_package_android,
    h.bank_package_ios,
    h.platform,
    h.action,
    h.client_ip,
    h.user_agent,
    h.created_at,
  ]);
  const csvOptions = getCsvEncoding(req);
  const csv = toCsvBuffer(headers, rows, csvOptions);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", `text/csv; charset=${csvOptions.charset}`);
  res.setHeader("Content-Disposition", "attachment; filename=\"bank-history.csv\"");
  return res.send(csv);
}

module.exports = {
  exportCompanies,
  exportPayments,
  exportGenerationHistory,
  exportScanHistory,
  exportBankHistory,
};
