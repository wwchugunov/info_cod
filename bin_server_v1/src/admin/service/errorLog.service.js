const ErrorLog = require("../model/errorLog.model");

async function logError({
  source = "server",
  level = "error",
  message,
  stack = null,
  statusCode = null,
  method = null,
  path = null,
  query = null,
  ip = null,
  userAgent = null,
  details = null,
}) {
  if (!message) return null;
  return ErrorLog.create({
    source,
    level,
    message,
    stack,
    status_code: statusCode,
    method,
    path,
    query,
    ip,
    user_agent: userAgent,
    details,
  });
}

module.exports = { logError };
