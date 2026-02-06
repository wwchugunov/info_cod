const { QueryTypes } = require("sequelize");
const Payment = require("../../model/generatelink");
const GenerationHistory = require("../../model/generationHistory.model");
const ScanHistory = require("../../model/scanHistory.model");
const SystemMetric = require("../../admin/model/systemMetric.model");
const {
  parsePagination,
  buildDateRange,
  buildHistorySqlFilters,
  getAdminCompanyId,
  getCompanyScope,
} = require("./helpers");

async function metrics(req, res) {
  const paymentWhere = buildDateRange(req.query, "created_at");
  const adminCompanyId = getAdminCompanyId(req);
  const companyId = Number(req.query.company_id);
  const companyIds = await getCompanyScope(
    adminCompanyId,
    Number.isFinite(companyId) ? companyId : null
  );
  if (companyIds && companyIds.length) {
    paymentWhere.company_id = companyIds;
  } else if (adminCompanyId) {
    paymentWhere.company_id = adminCompanyId;
  } else if (Number.isFinite(companyId)) {
    paymentWhere.company_id = companyId;
  }

  const [totals] = await Payment.findAll({
    where: paymentWhere,
    attributes: [
      [Payment.sequelize.fn("count", Payment.sequelize.col("id")), "count"],
      [Payment.sequelize.fn("sum", Payment.sequelize.col("amount")), "amount"],
      [
        Payment.sequelize.fn("sum", Payment.sequelize.col("commission_percent")),
        "commission_percent",
      ],
      [
        Payment.sequelize.fn("sum", Payment.sequelize.col("commission_fixed")),
        "commission_fixed",
      ],
    ],
    raw: true,
  });

  const historyWhere = buildDateRange(req.query, "created_at");
  if (companyIds && companyIds.length) {
    historyWhere.company_id = companyIds;
  } else if (adminCompanyId) {
    historyWhere.company_id = adminCompanyId;
  } else if (Number.isFinite(companyId)) {
    historyWhere.company_id = companyId;
  }
  const { sql: historySql, replacements } = buildHistorySqlFilters(
    req.query,
    companyIds,
    adminCompanyId,
    Number.isFinite(companyId) ? companyId : null
  );
  const historyCountsRows = await GenerationHistory.sequelize.query(
    `
      WITH filtered AS (
        SELECT COALESCE(token_hash, link_id::text, id::text) AS key
        FROM generation_history
        ${historySql}
      ),
      grouped AS (
        SELECT key, COUNT(*) AS cnt
        FROM filtered
        GROUP BY key
      )
      SELECT
        COALESCE(SUM(cnt), 0) AS total_count,
        COALESCE(SUM(CASE WHEN cnt = 1 THEN 1 ELSE 0 END), 0) AS unique_count,
        COALESCE(SUM(CASE WHEN cnt > 1 THEN cnt ELSE 0 END), 0) AS duplicate_count
      FROM grouped;
    `,
    { replacements, type: QueryTypes.SELECT }
  );
  const historyCounts = historyCountsRows[0] || {
    total_count: 0,
    unique_count: 0,
    duplicate_count: 0,
  };

  const scanWhere = buildDateRange(req.query, "created_at");
  if (companyIds && companyIds.length) {
    scanWhere.company_id = companyIds;
  } else if (adminCompanyId) {
    scanWhere.company_id = adminCompanyId;
  } else if (Number.isFinite(companyId)) {
    scanWhere.company_id = companyId;
  }
  const scanCount = await ScanHistory.count({ where: scanWhere });
  const scanUniqueCount = await ScanHistory.count({
    where: { ...scanWhere, is_duplicate: false },
  });
  const scanDuplicateCount = await ScanHistory.count({
    where: { ...scanWhere, is_duplicate: true },
  });

  const sumAmount = Number(totals.amount || 0);
  const sumPercent = Number(totals.commission_percent || 0);
  const sumFixed = Number(totals.commission_fixed || 0);

  return res.json({
    payments_count: Number(totals.count || 0),
    generation_count: Number(historyCounts.total_count || 0),
    generation_unique_count: Number(historyCounts.unique_count || 0),
    generation_duplicate_count: Number(historyCounts.duplicate_count || 0),
    scan_count: Number(scanCount || 0),
    scan_unique_count: Number(scanUniqueCount || 0),
    scan_duplicate_count: Number(scanDuplicateCount || 0),
    sum_amount: sumAmount,
    sum_commission_percent: sumPercent,
    sum_commission_fixed: sumFixed,
    sum_final_amount: sumAmount + sumPercent + sumFixed,
  });
}

async function metricsSeries(req, res) {
  const period = String(req.query.period || "day");
  const bucket = period === "month" ? "month" : period === "week" ? "week" : "day";
  const paymentWhere = buildDateRange(req.query, "created_at");
  const adminCompanyId = getAdminCompanyId(req);
  const companyId = Number(req.query.company_id);
  const companyIds = await getCompanyScope(
    adminCompanyId,
    Number.isFinite(companyId) ? companyId : null
  );
  if (companyIds && companyIds.length) {
    paymentWhere.company_id = companyIds;
  } else if (adminCompanyId) {
    paymentWhere.company_id = adminCompanyId;
  } else if (Number.isFinite(companyId)) {
    paymentWhere.company_id = companyId;
  }

  const rows = await Payment.findAll({
    where: paymentWhere,
    attributes: [
      [Payment.sequelize.fn("date_trunc", bucket, Payment.sequelize.col("created_at")), "bucket"],
      [Payment.sequelize.fn("count", Payment.sequelize.col("id")), "count"],
      [Payment.sequelize.fn("sum", Payment.sequelize.col("amount")), "amount"],
      [
        Payment.sequelize.fn("sum", Payment.sequelize.col("commission_percent")),
        "commission_percent",
      ],
      [
        Payment.sequelize.fn("sum", Payment.sequelize.col("commission_fixed")),
        "commission_fixed",
      ],
    ],
    group: ["bucket"],
    order: [[Payment.sequelize.literal("bucket"), "ASC"]],
    raw: true,
  });

  const data = rows.map((row) => ({
    bucket: row.bucket,
    count: Number(row.count || 0),
    amount: Number(row.amount || 0),
    commission: Number(row.commission_percent || 0) + Number(row.commission_fixed || 0),
  }));

  return res.json({ period: bucket, data });
}

async function listSystemMetrics(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const where = buildDateRange(req.query, "created_at");
  const result = await SystemMetric.findAndCountAll({
    where,
    limit,
    offset,
    order: [["created_at", "DESC"]],
  });
  return res.json({
    page,
    limit,
    total: result.count,
    items: result.rows,
  });
}

module.exports = {
  metrics,
  metricsSeries,
  listSystemMetrics,
};
