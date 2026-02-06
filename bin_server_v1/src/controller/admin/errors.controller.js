const ErrorLog = require("../../admin/model/errorLog.model");
const {
  parsePagination,
  buildDateRange,
  buildStringFilter,
} = require("./helpers");

async function listErrors(req, res) {
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
}

async function logClientError(req, res) {
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
}

module.exports = {
  listErrors,
  logClientError,
};
