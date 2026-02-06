const { QueryTypes } = require("sequelize");
const Payment = require("../../model/generatelink");
const GenerationHistory = require("../../model/generationHistory.model");
const ScanHistory = require("../../model/scanHistory.model");
const BankHistory = require("../../model/bankHistory.model");
const {
  parsePagination,
  buildDateRange,
  buildHistorySqlFilters,
  getAdminCompanyId,
  getCompanyScope,
  getGenerationKey,
  getGenerationDuplicateCounts,
  getScanKey,
  getScanDuplicateCounts,
} = require("./helpers");

async function listGenerationHistory(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
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

  const { sql: historySql, replacements } = buildHistorySqlFilters(
    req.query,
    companyIds,
    adminCompanyId,
    Number.isFinite(companyId) ? companyId : null
  );
  const countsRows = await GenerationHistory.sequelize.query(
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
  const counts = countsRows[0] || {
    total_count: 0,
    unique_count: 0,
    duplicate_count: 0,
  };

  const duplicateFilter = req.query.is_duplicate;
  let items = [];
  let total = Number(counts.total_count || 0);
  if (duplicateFilter === "true" || duplicateFilter === "false") {
    const matchClause = duplicateFilter === "true" ? "> 1" : "= 1";
    const rows = await GenerationHistory.sequelize.query(
      `
        WITH filtered AS (
          SELECT id, COALESCE(token_hash, link_id::text, id::text) AS key
          FROM generation_history
          ${historySql}
        ),
        grouped AS (
          SELECT key, COUNT(*) AS cnt
          FROM filtered
          GROUP BY key
        ),
        matched AS (
          SELECT f.id
          FROM filtered f
          JOIN grouped g ON g.key = f.key
          WHERE g.cnt ${matchClause}
        )
        SELECT gh.*
        FROM generation_history gh
        JOIN matched m ON m.id = gh.id
        ORDER BY gh.created_at DESC
        LIMIT :limit OFFSET :offset;
      `,
      {
        replacements: { ...replacements, limit, offset },
        type: QueryTypes.SELECT,
      }
    );
    const totalRows = await GenerationHistory.sequelize.query(
      `
        WITH filtered AS (
          SELECT id, COALESCE(token_hash, link_id::text, id::text) AS key
          FROM generation_history
          ${historySql}
        ),
        grouped AS (
          SELECT key, COUNT(*) AS cnt
          FROM filtered
          GROUP BY key
        ),
        matched AS (
          SELECT f.id
          FROM filtered f
          JOIN grouped g ON g.key = f.key
          WHERE g.cnt ${matchClause}
        )
        SELECT COUNT(*)::int AS count
        FROM matched;
      `,
      { replacements, type: QueryTypes.SELECT }
    );
    items = rows;
    total = Number(totalRows[0]?.count || 0);
  } else {
    const result = await GenerationHistory.findAndCountAll({
      where,
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });
    items = result.rows;
    total = result.count;
  }

  const generationKeys = items.map((item) => getGenerationKey(item)).filter(Boolean);
  let generationCounts = {};
  try {
    generationCounts = await getGenerationDuplicateCounts(generationKeys);
  } catch (err) {
    console.error("Failed to load generation duplicate counts:", err?.message || err);
  }
  items = items.map((item) => {
    const obj = item.toJSON ? item.toJSON() : item;
    const key = getGenerationKey(obj);
    return { ...obj, duplicate_count: generationCounts[key] || 1 };
  });

  return res.json({
    page,
    limit,
    total,
    unique_count: Number(counts.unique_count || 0),
    duplicate_count: Number(counts.duplicate_count || 0),
    items,
  });
}

async function listScanHistory(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
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

  const result = await ScanHistory.findAndCountAll({
    where,
    limit,
    offset,
    order: [["created_at", "DESC"]],
    include: [
      {
        model: Payment,
        attributes: ["id", "amount", "commission_percent", "commission_fixed"],
      },
    ],
  });

  let items = result.rows.map((row) => {
    const data = row.toJSON ? row.toJSON() : row;
    const payment = data.Payment || null;
    const amount = payment ? Number(payment.amount || 0) : null;
    const commission = payment
      ? Number(payment.commission_percent || 0) + Number(payment.commission_fixed || 0)
      : null;
    const finalAmount = amount !== null && commission !== null ? amount + commission : null;
    return {
      ...data,
      amount,
      commission,
      final_amount: finalAmount,
    };
  });
  const scanKeys = items.map((item) => getScanKey(item));
  let scanCounts = {};
  try {
    scanCounts = await getScanDuplicateCounts(scanKeys);
  } catch (err) {
    console.error("Failed to load scan duplicate counts:", err?.message || err);
  }
  items = items.map((item) => ({
    ...item,
    duplicate_count: scanCounts[getScanKey(item)] || 1,
  }));

  const baseWhere = { ...where };
  delete baseWhere.is_duplicate;

  const uniqueCount = await ScanHistory.count({
    where: { ...baseWhere, is_duplicate: false },
  });
  const duplicateCount = await ScanHistory.count({
    where: { ...baseWhere, is_duplicate: true },
  });

  return res.json({
    page,
    limit,
    total: result.count,
    unique_count: uniqueCount,
    duplicate_count: duplicateCount,
    items,
  });
}

async function listHistory(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const adminCompanyId = getAdminCompanyId(req);
  const companyId = Number(req.query.company_id);
  const companyIds = await getCompanyScope(
    adminCompanyId,
    Number.isFinite(companyId) ? companyId : null
  );
  const type = String(req.query.type || "").trim();

  const baseClauses = [];
  const replacements = { limit, offset };
  const from = req.query.from ? new Date(req.query.from) : null;
  const to = req.query.to ? new Date(req.query.to) : null;

  if (from && !Number.isNaN(from.getTime())) {
    baseClauses.push("created_at >= :from");
    replacements.from = from;
  }
  if (to && !Number.isNaN(to.getTime())) {
    baseClauses.push("created_at <= :to");
    replacements.to = to;
  }
  if (companyIds && companyIds.length) {
    if (companyIds.length === 1) {
      baseClauses.push("company_id = :company_id");
      replacements.company_id = companyIds[0];
    } else {
      baseClauses.push("company_id = ANY(:company_ids)");
      replacements.company_ids = companyIds;
    }
  } else if (adminCompanyId) {
    baseClauses.push("company_id = :company_id");
    replacements.company_id = adminCompanyId;
  } else if (Number.isFinite(companyId)) {
    baseClauses.push("company_id = :company_id");
    replacements.company_id = companyId;
  }

  const generationClauses = [...baseClauses];
  if (req.query.status) {
    generationClauses.push("status = :status");
    replacements.status = String(req.query.status);
  }

  const baseWhere = baseClauses.length ? `WHERE ${baseClauses.join(" AND ")}` : "";
  const generationWhere = generationClauses.length
    ? `WHERE ${generationClauses.join(" AND ")}`
    : "";

  const connection = GenerationHistory.sequelize;

  if (type === "generation") {
    const items = await connection.query(
      `
        SELECT
          'generation'::text AS kind,
          id,
          company_id,
          company_name,
          amount,
          commission_percent,
          commission_fixed,
          final_amount,
          purpose,
          link_id,
          client_ip,
          user_agent,
          status,
          error_code,
          error_message,
          COUNT(*) OVER (PARTITION BY COALESCE(token_hash, link_id::text, id::text))::int AS duplicate_count,
          NULL::boolean AS is_duplicate,
          NULL::text AS platform,
          NULL::text AS device,
          NULL::text AS language,
          created_at
        FROM generation_history
        ${generationWhere}
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset;
      `,
      { replacements, type: QueryTypes.SELECT }
    );
    const countRows = await connection.query(
      `SELECT COUNT(*)::int AS count FROM generation_history ${generationWhere};`,
      { replacements, type: QueryTypes.SELECT }
    );
    return res.json({
      page,
      limit,
      total: Number(countRows[0]?.count || 0),
      items,
    });
  }

  if (type === "scan") {
    const items = await connection.query(
      `
        SELECT
          'scan'::text AS kind,
          id,
          company_id,
          company_name,
          NULL::numeric AS amount,
          NULL::numeric AS commission_percent,
          NULL::numeric AS commission_fixed,
          NULL::numeric AS final_amount,
          NULL::text AS purpose,
          link_id,
          client_ip,
          user_agent,
          NULL::text AS status,
          NULL::text AS error_code,
          NULL::text AS error_message,
          COUNT(*) OVER (PARTITION BY link_id)::int AS duplicate_count,
          is_duplicate,
          platform,
          device,
          language,
          created_at
        FROM scan_history
        ${baseWhere}
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset;
      `,
      { replacements, type: QueryTypes.SELECT }
    );
    const countRows = await connection.query(
      `SELECT COUNT(*)::int AS count FROM scan_history ${baseWhere};`,
      { replacements, type: QueryTypes.SELECT }
    );
    return res.json({
      page,
      limit,
      total: Number(countRows[0]?.count || 0),
      items,
    });
  }

  const countRows = await connection.query(
    `
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT id FROM generation_history ${generationWhere}
        UNION ALL
        SELECT id FROM scan_history ${baseWhere}
      ) AS combined;
    `,
    { replacements, type: QueryTypes.SELECT }
  );
  const items = await connection.query(
    `
      SELECT *
      FROM (
        SELECT
          'generation'::text AS kind,
          id,
          company_id,
          company_name,
          amount,
          commission_percent,
          commission_fixed,
          final_amount,
          purpose,
          link_id,
          client_ip,
          user_agent,
          status,
          error_code,
          error_message,
          COUNT(*) OVER (PARTITION BY COALESCE(token_hash, link_id::text, id::text))::int AS duplicate_count,
          NULL::boolean AS is_duplicate,
          NULL::text AS platform,
          NULL::text AS device,
          NULL::text AS language,
          created_at
        FROM generation_history
        ${generationWhere}
        UNION ALL
        SELECT
          'scan'::text AS kind,
          id,
          company_id,
          company_name,
          NULL::numeric AS amount,
          NULL::numeric AS commission_percent,
          NULL::numeric AS commission_fixed,
          NULL::numeric AS final_amount,
          NULL::text AS purpose,
          link_id,
          client_ip,
          user_agent,
          NULL::text AS status,
          NULL::text AS error_code,
          NULL::text AS error_message,
          COUNT(*) OVER (PARTITION BY link_id)::int AS duplicate_count,
          is_duplicate,
          platform,
          device,
          language,
          created_at
        FROM scan_history
        ${baseWhere}
      ) AS combined
      ORDER BY created_at DESC
      LIMIT :limit OFFSET :offset;
    `,
    { replacements, type: QueryTypes.SELECT }
  );

  return res.json({
    page,
    limit,
    total: Number(countRows[0]?.count || 0),
    items,
  });
}

async function listBankHistory(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
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

  const result = await BankHistory.findAndCountAll({
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
  listGenerationHistory,
  listScanHistory,
  listHistory,
  listBankHistory,
};
