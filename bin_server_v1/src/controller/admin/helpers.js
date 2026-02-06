const { Op, QueryTypes } = require("sequelize");
const crypto = require("crypto");
const Company = require("../../model/company.model");
const GenerationHistory = require("../../model/generationHistory.model");
const ScanHistory = require("../../model/scanHistory.model");
const AdminUser = require("../../admin/model/adminUser.model");

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

function getGenerationKey(row) {
  if (row.token_hash) return row.token_hash;
  if (row.link_id) return String(row.link_id);
  return String(row.id);
}

function getScanKey(row) {
  return row.link_id ? String(row.link_id) : "";
}

async function getGenerationDuplicateCounts(keys) {
  if (!keys.length) return {};
  const rows = await GenerationHistory.sequelize.query(
    `
      SELECT
        COALESCE(token_hash, link_id::text, id::text) AS key,
        COUNT(*)::int AS cnt
      FROM generation_history
      WHERE COALESCE(token_hash, link_id::text, id::text) IN (:keys)
      GROUP BY key;
    `,
    { replacements: { keys }, type: QueryTypes.SELECT }
  );
  return rows.reduce((acc, row) => {
    acc[row.key] = Number(row.cnt) || 0;
    return acc;
  }, {});
}

async function getScanDuplicateCounts(keys) {
  if (!keys.length) return {};
  const rows = await ScanHistory.sequelize.query(
    `
      SELECT
        link_id::text AS key,
        COUNT(*)::int AS cnt
      FROM scan_history
      WHERE link_id::text IN (:keys)
      GROUP BY key;
    `,
    { replacements: { keys }, type: QueryTypes.SELECT }
  );
  return rows.reduce((acc, row) => {
    acc[row.key] = Number(row.cnt) || 0;
    return acc;
  }, {});
}

function getCsvEncoding(req) {
  const raw = String(req.query.encoding || "").trim().toLowerCase();
  const normalized = raw.replace(/[^a-z0-9]/g, "");
  if (normalized === "win1251" || normalized === "cp1251" || normalized === "windows1251") {
    return { encoding: "win1251", charset: "windows-1251" };
  }
  if (normalized === "utf16le" || normalized === "utf16" || normalized === "ucs2") {
    return { encoding: "utf16le", charset: "utf-16le" };
  }
  if (normalized === "utf8bom") {
    return { encoding: "utf8bom", charset: "utf-8" };
  }
  if (normalized === "utf8") {
    return { encoding: "utf8", charset: "utf-8" };
  }
  return { encoding: "win1251", charset: "windows-1251" };
}

module.exports = {
  parsePagination,
  buildDateRange,
  buildHistorySqlFilters,
  getAdminCompanyId,
  translitToLatin,
  generateUniqueLogin,
  generatePassword,
  getCompanyScope,
  canAccessCompany,
  buildStringFilter,
  getAdminPermissions,
  hasPermission,
  parseNumber,
  getGenerationKey,
  getScanKey,
  getGenerationDuplicateCounts,
  getScanDuplicateCounts,
  getCsvEncoding,
};
