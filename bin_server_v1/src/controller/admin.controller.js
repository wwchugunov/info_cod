const { Op, QueryTypes } = require("sequelize");
const Company = require("../model/company.model");
const Payment = require("../model/generatelink");
const GenerationHistory = require("../model/generationHistory.model");
const ScanHistory = require("../model/scanHistory.model");
const BankHistory = require("../model/bankHistory.model");
const AdminUser = require("../admin/model/adminUser.model");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { toCsv } = require("../service/csv.utils");
const companyService = require("../service/company.service");
const { calculateCommission, getDayRange } = require("../service/payment.utils");
const ErrorLog = require("../admin/model/errorLog.model");
const SystemMetric = require("../admin/model/systemMetric.model");

function parsePagination(query) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 200);
  return { page, limit, offset: (page - 1) * limit };
}

function buildDateRange(query, field = "created_at") {
  const where = {};
  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;

  if (from && !Number.isNaN(from.getTime())) {
    where[field] = { ...(where[field] || {}), [Op.gte]: from };
  }
  if (to && !Number.isNaN(to.getTime())) {
    where[field] = { ...(where[field] || {}), [Op.lte]: to };
  }

  return where;
}

function buildHistorySqlFilters(query, companyIds, adminCompanyId, companyId) {
  const clauses = [];
  const replacements = {};
  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;

  if (from && !Number.isNaN(from.getTime())) {
    clauses.push("created_at >= :from");
    replacements.from = from;
  }
  if (to && !Number.isNaN(to.getTime())) {
    clauses.push("created_at <= :to");
    replacements.to = to;
  }
  if (companyIds && companyIds.length) {
    if (companyIds.length === 1) {
      clauses.push("company_id = :company_id");
      replacements.company_id = companyIds[0];
    } else {
      clauses.push("company_id = ANY(:company_ids)");
      replacements.company_ids = companyIds;
    }
  } else if (adminCompanyId) {
    clauses.push("company_id = :company_id");
    replacements.company_id = adminCompanyId;
  } else if (Number.isFinite(companyId)) {
    clauses.push("company_id = :company_id");
    replacements.company_id = companyId;
  }
  if (query.status) {
    clauses.push("status = :status");
    replacements.status = String(query.status);
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    replacements,
  };
}

function getAdminCompanyId(req) {
  if (req.admin?.role === "superadmin") {
    return null;
  }
  const id = Number(req.admin?.company_id);
  return Number.isFinite(id) ? id : null;
}

function translitToLatin(value) {
  const map = {
    а: "a", б: "b", в: "v", г: "g", ґ: "g", д: "d", е: "e", є: "e", ж: "zh",
    з: "z", и: "y", і: "i", ї: "i", й: "y", к: "k", л: "l", м: "m", н: "n",
    о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
    ч: "ch", ш: "sh", щ: "shch", ь: "", ю: "yu", я: "ya",
  };
  return String(value || "")
    .trim()
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function generateUniqueLogin(base) {
  let slug = translitToLatin(base) || "company";
  let candidate = slug;
  let counter = 1;
  while (await AdminUser.findOne({ where: { email: candidate } })) {
    counter += 1;
    candidate = `${slug}-${counter}`;
  }
  return candidate;
}

function generatePassword() {
  return crypto.randomBytes(12).toString("base64url");
}

async function getCompanyScope(adminCompanyId, requestedCompanyId) {
  if (!adminCompanyId) {
    return requestedCompanyId ? [requestedCompanyId] : null;
  }
  const adminCompany = await Company.findByPk(adminCompanyId, {
    attributes: ["id", "edrpo"],
  });
  if (!adminCompany) {
    return [];
  }
  if (!adminCompany.edrpo) {
    return [adminCompanyId];
  }
  const rows = await Company.findAll({
    where: { edrpo: adminCompany.edrpo },
    attributes: ["id"],
    raw: true,
  });
  const ids = rows.map((row) => Number(row.id)).filter(Number.isFinite);
  if (requestedCompanyId && ids.includes(requestedCompanyId)) {
    return [requestedCompanyId];
  }
  return ids;
}

async function canAccessCompany(adminCompanyId, targetCompanyId) {
  if (!adminCompanyId) return true;
  const adminCompany = await Company.findByPk(adminCompanyId, {
    attributes: ["id", "edrpo"],
  });
  const targetCompany = await Company.findByPk(targetCompanyId, {
    attributes: ["id", "edrpo"],
  });
  if (!adminCompany || !targetCompany) return false;
  if (adminCompany.edrpo) {
    return adminCompany.edrpo === targetCompany.edrpo;
  }
  return adminCompany.id === targetCompany.id;
}

function buildStringFilter(value) {
  if (!value) return null;
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed : null;
}

async function getAdminPermissions(req) {
  if (!req.admin?.sub) return {};
  const admin = await AdminUser.findByPk(req.admin.sub, {
    attributes: ["id", "role", "permissions", "company_id"],
  });
  if (!admin) return {};
  if (admin.role === "superadmin") {
    return { __all: true };
  }
  return admin.permissions || {};
}

function hasPermission(permissions, key) {
  return Boolean(permissions?.__all || permissions?.[key]);
}

function parseNumber(value, fieldName) {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`Некорректное значение поля ${fieldName}`);
  }
  return num;
}

const adminController = {};

adminController.listCompanies = async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const search = String(req.query.search || "").trim();
  const searchNumber = Number(search);

  const where = {};
  const adminCompanyId = getAdminCompanyId(req);
  if (adminCompanyId) {
    const adminCompany = await Company.findByPk(adminCompanyId, {
      attributes: ["id", "edrpo"],
    });
    if (!adminCompany) {
      return res.status(403).json({ message: "Недостаточно прав" });
    }
    if (adminCompany.edrpo) {
      where.edrpo = adminCompany.edrpo;
    } else {
      where.id = adminCompanyId;
    }
  }
  if (search) {
    const conditions = [
      { name: { [Op.iLike]: `%${search}%` } },
      { contact_name: { [Op.iLike]: `%${search}%` } },
      { contact_phone: { [Op.iLike]: `%${search}%` } },
      { iban: { [Op.iLike]: `%${search}%` } },
      { edrpo: { [Op.iLike]: `%${search}%` } },
      { internal_id: { [Op.iLike]: `%${search}%` } },
    ];
    if (Number.isFinite(searchNumber)) {
      conditions.push({ id: searchNumber });
    }
    where[Op.or] = conditions;
  }

  const result = await Company.findAndCountAll({
    where,
    limit,
    offset,
    order: [["created_at", "DESC"]],
  });

  const items = result.rows.map((company) => company.toJSON());
  const edrpos = [
    ...new Set(items.map((company) => company.edrpo).filter(Boolean)),
  ];
  const parentRows = edrpos.length
    ? await Company.findAll({
        attributes: [
          "edrpo",
          [Company.sequelize.fn("min", Company.sequelize.col("id")), "parent_id"],
        ],
        where: { edrpo: edrpos },
        group: ["edrpo"],
        raw: true,
      })
    : [];
  const parentMap = parentRows.reduce((acc, row) => {
    acc[row.edrpo] = Number(row.parent_id);
    return acc;
  }, {});
  const companyIds = items.map((company) => company.id);
  const { start, end } = getDayRange();
  const counts = companyIds.length
    ? await Payment.findAll({
        attributes: [
          "company_id",
          [Payment.sequelize.fn("count", Payment.sequelize.col("id")), "count"],
        ],
        where: {
          company_id: companyIds,
          created_at: { [Op.gte]: start, [Op.lt]: end },
        },
        group: ["company_id"],
        raw: true,
      })
    : [];

  const countsMap = counts.reduce((acc, row) => {
    acc[Number(row.company_id)] = Number(row.count || 0);
    return acc;
  }, {});

  for (const company of items) {
    const total = Number(company.daily_limit || 0);
    const used = countsMap[company.id] || 0;
    const enabled = company.use_daily_limit !== false;
    company.daily_limit_total = total;
    company.daily_limit_used = used;
    company.daily_limit_remaining = enabled ? Math.max(total - used, 0) : null;
    const parentId = parentMap[company.edrpo];
    company.parent_company_id = parentId || null;
    company.is_sub_company = Boolean(parentId && company.id !== parentId);
  }

  return res.json({
    page,
    limit,
    total: result.count,
    items,
  });
};

adminController.createCompany = async (req, res) => {
  const adminCompanyId = getAdminCompanyId(req);
  const permissions = await getAdminPermissions(req);
  if (!hasPermission(permissions, "company_create")) {
    return res.status(403).json({ message: "Недостаточно прав" });
  }
  if (adminCompanyId) {
    const adminCompany = await Company.findByPk(adminCompanyId, {
      attributes: ["id", "edrpo"],
    });
    if (!adminCompany) {
      return res.status(403).json({ message: "Недостаточно прав" });
    }
    const normalizedEdrpo = String(req.body.edrpo || "").trim();
    if (!adminCompany.edrpo || adminCompany.edrpo !== normalizedEdrpo) {
      return res.status(403).json({ message: "Недостаточно прав" });
    }
  }
  try {
    const {
      company,
      apiTokenPlain,
      isSubCompany,
      parentCompanyId,
    } = await companyService.registerCompany(req.body);
    const login = await generateUniqueLogin(company.name);
    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);
    await AdminUser.create({
      email: login,
      name: company.name,
      role: "viewer",
      company_id: company.id,
      password_hash: passwordHash,
    });
    return res.status(201).json({
      company,
      api_token: apiTokenPlain,
      is_sub_company: isSubCompany,
      parent_company_id: parentCompanyId,
      admin_login: login,
      admin_password: password,
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

adminController.getCompany = async (req, res) => {
  const adminCompanyId = getAdminCompanyId(req);
  const targetId = Number(req.params.id);
  if (adminCompanyId && !(await canAccessCompany(adminCompanyId, targetId))) {
    return res.status(403).json({ message: "Недостаточно прав" });
  }
  const company = await Company.findByPk(req.params.id);
  if (!company) {
    return res.status(404).json({ message: "Компания не найдена" });
  }
  return res.json(company);
};

adminController.updateCompany = async (req, res) => {
  const adminCompanyId = getAdminCompanyId(req);
  const permissions = await getAdminPermissions(req);
  const targetId = Number(req.params.id);
  if (adminCompanyId && !(await canAccessCompany(adminCompanyId, targetId))) {
    return res.status(403).json({ message: "Недостаточно прав" });
  }
  const allowed = [
    "name",
    "contact_name",
    "contact_phone",
    "iban",
    "edrpo",
    "daily_limit",
    "use_daily_limit",
    "commission_percent",
    "commission_fixed",
    "use_percent_commission",
    "use_fixed_commission",
    "is_active",
    "logo_url",
    "offer_url",
    "ip_whitelist",
  ];
  const commissionKeys = new Set([
    "commission_percent",
    "commission_fixed",
    "use_percent_commission",
    "use_fixed_commission",
  ]);

  const payload = {};
  const canEdit = hasPermission(permissions, "company_edit");
  const canChangeLimit = hasPermission(permissions, "limit_change");
  const canToggleLimit = hasPermission(permissions, "limit_toggle");
  let commissionChanged = false;

  if (!canEdit && !canChangeLimit && !canToggleLimit) {
    return res.status(403).json({ message: "Недостаточно прав" });
  }

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      if (!canEdit) {
        if (key === "daily_limit" && canChangeLimit) {
          payload[key] = req.body[key];
        } else if (key === "use_daily_limit" && canToggleLimit) {
          payload[key] = req.body[key];
        }
      } else {
        payload[key] = req.body[key];
      }
      if (commissionKeys.has(key)) {
        commissionChanged = true;
      }
    }
  }

  if (!Object.keys(payload).length) {
    return res.status(403).json({ message: "Недостаточно прав" });
  }

  try {
    if (Object.prototype.hasOwnProperty.call(payload, "daily_limit")) {
      payload.daily_limit = parseNumber(payload.daily_limit, "daily_limit");
    }
    if (Object.prototype.hasOwnProperty.call(payload, "commission_percent")) {
      payload.commission_percent = parseNumber(payload.commission_percent, "commission_percent");
    }
    if (Object.prototype.hasOwnProperty.call(payload, "commission_fixed")) {
      payload.commission_fixed = parseNumber(payload.commission_fixed, "commission_fixed");
    }
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
  if (
    Object.prototype.hasOwnProperty.call(payload, "commission_percent") &&
    payload.commission_percent < 0
  ) {
    return res.status(400).json({ message: "Комиссия не может быть отрицательной" });
  }
  if (
    Object.prototype.hasOwnProperty.call(payload, "commission_fixed") &&
    payload.commission_fixed < 0
  ) {
    return res.status(400).json({ message: "Комиссия не может быть отрицательной" });
  }

  const [count] = await Company.update(payload, {
    where: { id: req.params.id },
  });

  if (!count) {
    return res.status(404).json({ message: "Компания не найдена" });
  }

  const company = await Company.findByPk(req.params.id);
  if (company && commissionChanged) {
    const payments = await Payment.findAll({
      where: { company_id: company.id, status: "pending" },
      attributes: ["id", "amount"],
    });
    for (const payment of payments) {
      const { commissionPercent, commissionFixed } = calculateCommission(
        company,
        Number(payment.amount || 0)
      );
      await Payment.update(
        {
          commission_percent: commissionPercent,
          commission_fixed: commissionFixed,
        },
        { where: { id: payment.id } }
      );
    }
  }
  return res.json(company);
};

adminController.deleteCompany = async (req, res) => {
  const companyId = Number(req.params.id);
  if (!Number.isFinite(companyId)) {
    return res.status(400).json({ message: "Некорректный ID компании" });
  }
  const adminCompanyId = getAdminCompanyId(req);
  const permissions = await getAdminPermissions(req);
  if (!hasPermission(permissions, "company_delete")) {
    return res.status(403).json({ message: "Недостаточно прав" });
  }
  if (adminCompanyId && !(await canAccessCompany(adminCompanyId, companyId))) {
    return res.status(403).json({ message: "Недостаточно прав" });
  }

  const company = await Company.findByPk(companyId);
  if (!company) {
    return res.status(404).json({ message: "Компания не найдена" });
  }

  await Company.sequelize.transaction(async (transaction) => {
    await GenerationHistory.update(
      { company_name: company.name },
      { where: { company_id: companyId }, transaction }
    );
    await Payment.update(
      { company_id: null, company_name: company.name },
      { where: { company_id: companyId }, transaction }
    );
    await Company.destroy({ where: { id: companyId }, transaction });
  });

  return res.json({ ok: true });
};

adminController.listPayments = async (req, res) => {
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
  } else {
    where[Op.or] = [
      { status: { [Op.in]: ["pending", "delivered"] } },
      { status: { [Op.is]: null } },
    ];
  }
  if (req.query.status) {
    where.status = req.query.status;
  }

  const includeCompany =
    req.admin && req.admin.role !== "viewer"
      ? [{ model: Company, attributes: ["id", "name", "edrpo", "iban"] }]
      : [];

  const result = await Payment.findAndCountAll({
    where,
    limit,
    offset,
    order: [["created_at", "DESC"]],
    include: includeCompany,
    distinct: true,
  });

  return res.json({
    page,
    limit,
    total: result.count,
    items: result.rows,
  });
};

adminController.listGenerationHistory = async (req, res) => {
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

  return res.json({
    page,
    limit,
    total,
    unique_count: Number(counts.unique_count || 0),
    duplicate_count: Number(counts.duplicate_count || 0),
    items,
  });
};

adminController.listScanHistory = async (req, res) => {
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
  });

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
    items: result.rows,
  });
};

adminController.listBankHistory = async (req, res) => {
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
};

adminController.metrics = async (req, res) => {
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
};

adminController.metricsSeries = async (req, res) => {
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
};

adminController.exportCompanies = async (req, res) => {
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
    "daily_limit",
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
    c.daily_limit,
    c.commission_percent,
    c.commission_fixed,
    c.use_percent_commission,
    c.use_fixed_commission,
    c.is_active,
    c.created_at,
  ]);
  const csv = `\ufeff${toCsv(headers, rows)}`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=\"companies.csv\"");
  return res.send(csv);
};

adminController.exportPayments = async (req, res) => {
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
  const csv = `\ufeff${toCsv(headers, rows)}`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=\"payments.csv\"");
  return res.send(csv);
};

adminController.exportGenerationHistory = async (req, res) => {
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
  ]);
  const csv = `\ufeff${toCsv(headers, rows)}`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=\"generation-history.csv\"");
  return res.send(csv);
};

adminController.exportScanHistory = async (req, res) => {
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
  });
  const headers = [
    "id",
    "payment_id",
    "company_id",
    "company_name",
    "link_id",
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
  ];
  const rows = history.map((h) => [
    h.id,
    h.payment_id,
    h.company_id,
    h.company_name,
    h.link_id,
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
  ]);
  const csv = `\ufeff${toCsv(headers, rows)}`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=\"scan-history.csv\"");
  return res.send(csv);
};

adminController.exportBankHistory = async (req, res) => {
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
  const csv = `\ufeff${toCsv(headers, rows)}`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=\"bank-history.csv\"");
  return res.send(csv);
};

adminController.rotateCompanyToken = async (req, res) => {
  const permissions = await getAdminPermissions(req);
  if (!hasPermission(permissions, "token_generate")) {
    return res.status(403).json({ message: "Недостаточно прав" });
  }
  const companyId = Number(req.params.id);
  if (!Number.isFinite(companyId)) {
    return res.status(400).json({ message: "Некорректный ID компании" });
  }
  const adminCompanyId = getAdminCompanyId(req);
  if (adminCompanyId) {
    const adminCompany = await Company.findByPk(adminCompanyId, {
      attributes: ["id", "edrpo"],
    });
    const targetCompany = await Company.findByPk(companyId, {
      attributes: ["id", "edrpo"],
    });
    if (!adminCompany || !targetCompany) {
      return res.status(404).json({ message: "Компания не найдена" });
    }
    if (adminCompany.edrpo && adminCompany.edrpo !== targetCompany.edrpo) {
      return res.status(403).json({ message: "Недостаточно прав" });
    }
    if (!adminCompany.edrpo && adminCompanyId !== companyId) {
      return res.status(403).json({ message: "Недостаточно прав" });
    }
  }

  const company = await Company.findByPk(companyId);
  if (!company) {
    return res.status(404).json({ message: "Компания не найдена" });
  }
  const apiToken = companyService.generateApiToken();
  company.api_token = apiToken;
  company.api_token_prefix = apiToken.slice(0, 8);
  await company.save({ allowApiTokenUpdate: true });

  return res.json({ api_token: apiToken });
};

adminController.createCompanyAdmin = async (req, res) => {
  const companyId = Number(req.params.id);
  if (!Number.isFinite(companyId)) {
    return res.status(400).json({ message: "Некорректный ID компании" });
  }
  const company = await Company.findByPk(companyId);
  if (!company) {
    return res.status(404).json({ message: "Компания не найдена" });
  }
  const login = await generateUniqueLogin(company.name);
  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await AdminUser.create({
    email: login,
    name: company.name,
    role: "admin",
    company_id: company.id,
    password_hash: passwordHash,
  });
  return res.status(201).json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    company_id: user.company_id,
    admin_login: login,
    admin_password: password,
  });
};

adminController.listErrors = async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const where = buildDateRange(req.query, "created_at");
  const source = buildStringFilter(req.query.source);
  if (source) {
    where.source = source;
  }
  const statusCode = Number(req.query.status_code);
  if (Number.isFinite(statusCode)) {
    where.status_code = statusCode;
  }
  const result = await ErrorLog.findAndCountAll({
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
};

adminController.logClientError = async (req, res) => {
  const payload = req.body || {};
  const message = String(payload.message || "Client error").slice(0, 2000);
  const stack = payload.stack ? String(payload.stack).slice(0, 8000) : null;
  const details = {
    url: payload.url || null,
    line: payload.line || null,
    column: payload.column || null,
    type: payload.type || null,
  };
  await ErrorLog.create({
    source: "client",
    level: "error",
    message,
    stack,
    status_code: null,
    method: null,
    path: details.url,
    query: null,
    ip: req.ip || null,
    user_agent: req.headers["user-agent"] || null,
    details,
  });
  return res.json({ ok: true });
};

adminController.listSystemMetrics = async (req, res) => {
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
};

module.exports = adminController;
