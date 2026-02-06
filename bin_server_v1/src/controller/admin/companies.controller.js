const { Op, Sequelize } = require("sequelize");
const bcrypt = require("bcrypt");
const Company = require("../../model/company.model");
const Payment = require("../../model/generatelink");
const GenerationHistory = require("../../model/generationHistory.model");
const AdminUser = require("../../admin/model/adminUser.model");
const companyService = require("../../service/company.service");
const { calculateCommission, getDayRange } = require("../../service/payment.utils");
const { canExposeSensitive } = require("../../utils/sensitiveExposure");
const { buildTokenPreview, ensureTokenPreview } = require("../../utils/tokenPreview");
const { encryptToken, decryptToken } = require("../../utils/tokenCrypto");
const {
  parsePagination,
  getAdminCompanyId,
  getAdminPermissions,
  hasPermission,
  parseNumber,
  canAccessCompany,
  getCompanyScope,
  generateUniqueLogin,
  generatePassword,
} = require("./helpers");

async function listCompanies(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const search = String(req.query.search || "").trim();
  const searchNumber = Number(search);

  const where = {};
  const scopeWhere = {};
  const adminCompanyId = getAdminCompanyId(req);
  if (adminCompanyId) {
    const adminCompany = await Company.findByPk(adminCompanyId, {
      attributes: ["id", "edrpo"],
    });
    if (!adminCompany) {
      return res.status(403).json({ message: "Недостаточно прав" });
    }
    if (adminCompany.edrpo) {
      scopeWhere.edrpo = adminCompany.edrpo;
    } else {
      scopeWhere.id = adminCompanyId;
    }
  }
  Object.assign(where, scopeWhere);
  if (search) {
    const conditions = [
      { name: { [Op.iLike]: `%${search}%` } },
      { contact_name: { [Op.iLike]: `%${search}%` } },
      { contact_phone: { [Op.iLike]: `%${search}%` } },
      { iban: { [Op.iLike]: `%${search}%` } },
      { edrpo: { [Op.iLike]: `%${search}%` } },
      Sequelize.where(
        Sequelize.cast(Sequelize.col("internal_id"), "text"),
        { [Op.iLike]: `%${search}%` }
      ),
    ];
    if (Number.isFinite(searchNumber)) {
      conditions.push({ id: searchNumber });
      const searchCompany = await Company.findOne({
        attributes: ["edrpo"],
        where: { ...scopeWhere, id: searchNumber },
      });
      if (searchCompany?.edrpo) {
        conditions.push({ edrpo: searchCompany.edrpo });
      }
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
}

async function createCompany(req, res) {
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
    const canExpose = canExposeSensitive();
    const apiTokenPreview = buildTokenPreview(apiTokenPlain);
    return res.status(201).json({
      company,
      api_token: canExpose ? apiTokenPlain : null,
      api_token_preview: apiTokenPreview || null,
      token_is_preview: !canExpose,
      is_sub_company: isSubCompany,
      parent_company_id: parentCompanyId,
      admin_login: login,
      admin_password: canExpose ? password : null,
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
}

async function getCompany(req, res) {
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
}

async function updateCompany(req, res) {
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
}

async function deleteCompany(req, res) {
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
}

async function listCompanyTokens(req, res) {
  const permissions = await getAdminPermissions(req);
  if (!hasPermission(permissions, "token_generate")) {
    return res.status(403).json({ message: "Недостаточно прав" });
  }
  const wantsReveal = String(req.query?.reveal || "").toLowerCase() === "true" ||
    String(req.query?.reveal || "") === "1";
  const allowTokenReveal =
    String(process.env.ADMIN_ALLOW_TOKEN_REVEAL || "").toLowerCase() === "true";
  const adminCompanyId = getAdminCompanyId(req);
  const companyIds = await getCompanyScope(adminCompanyId, null);
  const where = {};
  if (companyIds && companyIds.length) {
    where.id = companyIds;
  } else if (adminCompanyId) {
    where.id = adminCompanyId;
  }

  const companies = await Company.findAll({
    where,
    attributes: ["id", "name", "api_token_last", "api_token_enc"],
    order: [["id", "ASC"]],
  });

  return res.json({
    items: companies.map((company) => ({
      id: company.id,
      name: company.name,
      api_token: wantsReveal && allowTokenReveal && canExposeSensitive()
        ? (() => {
            try {
              return company.api_token_enc ? decryptToken(company.api_token_enc) : null;
            } catch (_) {
              return null;
            }
          })()
        : null,
      api_token_preview: ensureTokenPreview(company.api_token_last) || null,
      token_is_preview: !(
        wantsReveal && allowTokenReveal && canExposeSensitive() && company.api_token_enc
      ),
      token_missing: wantsReveal && allowTokenReveal && canExposeSensitive() && !company.api_token_enc
        ? true
        : false,
    })),
  });
}

async function getCompanyToken(req, res) {
  const permissions = await getAdminPermissions(req);
  if (!hasPermission(permissions, "token_generate")) {
    return res.status(403).json({ message: "Недостаточно прав" });
  }
  const adminCompanyId = getAdminCompanyId(req);
  const companyId = Number(req.params.id);
  const wantsReveal = String(req.query?.reveal || "").toLowerCase() === "true" ||
    String(req.query?.reveal || "") === "1";
  const allowTokenReveal =
    String(process.env.ADMIN_ALLOW_TOKEN_REVEAL || "").toLowerCase() === "true";
  if (!Number.isFinite(companyId)) {
    return res.status(400).json({ message: "Некорректный ID компании" });
  }
  if (adminCompanyId && !(await canAccessCompany(adminCompanyId, companyId))) {
    return res.status(403).json({ message: "Недостаточно прав" });
  }
  const company = await Company.findByPk(companyId, {
    attributes: ["id", "api_token_last", "api_token_enc"],
  });
  if (!company) {
    return res.status(404).json({ message: "Компания не найдена" });
  }
  const apiTokenPreview = ensureTokenPreview(company.api_token_last);
  if (wantsReveal) {
    if (!allowTokenReveal || !canExposeSensitive()) {
      return res.status(403).json({ message: "Розкриття токенів вимкнено" });
    }
    if (!company.api_token_enc) {
      return res.status(409).json({
        message: "Токен не збережено. Згенеруйте новий токен.",
      });
    }
    try {
      const decrypted = decryptToken(company.api_token_enc);
      return res.json({
        api_token: decrypted,
        api_token_preview: apiTokenPreview || null,
        token_is_preview: false,
      });
    } catch (err) {
      return res.status(500).json({ message: "Не вдалося розшифрувати токен" });
    }
  }
  return res.json({
    api_token: null,
    api_token_preview: apiTokenPreview || null,
    token_is_preview: true,
  });
}

async function rotateCompanyToken(req, res) {
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
  let apiToken = null;
  let apiTokenEncrypted = null;
  let apiTokenPreview = null;
  try {
    apiToken = companyService.generateApiToken();
    apiTokenEncrypted = encryptToken(apiToken);
    apiTokenPreview = buildTokenPreview(apiToken);
  } catch (err) {
    return res.status(500).json({
      message: err?.message || "Не вдалося згенерувати токен",
    });
  }
  company.api_token = apiToken;
  company.api_token_enc = apiTokenEncrypted;
  company.api_token_last = apiTokenPreview;
  company.api_token_prefix = apiToken.slice(0, 8);
  await company.save({ allowApiTokenUpdate: true });

  const canExpose = canExposeSensitive();
  return res.json({
    api_token: canExpose ? apiToken : null,
    api_token_preview: apiTokenPreview || null,
    token_is_preview: !canExpose,
  });
}

async function createCompanyAdmin(req, res) {
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
    admin_password: canExposeSensitive() ? password : null,
  });
}

module.exports = {
  listCompanies,
  createCompany,
  getCompany,
  updateCompany,
  deleteCompany,
  listCompanyTokens,
  getCompanyToken,
  rotateCompanyToken,
  createCompanyAdmin,
};
