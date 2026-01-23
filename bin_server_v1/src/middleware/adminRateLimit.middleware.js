const RATE_WINDOW_MS = Number(process.env.ADMIN_AUTH_RATE_WINDOW_MS || 60000);
const RATE_MAX = Number(process.env.ADMIN_AUTH_RATE_MAX || 10);

const state = new Map();

function getKey(req) {
  const ip = req.ip || req.connection?.remoteAddress || "unknown";
  return ip;
}

function adminAuthRateLimit(req, res, next) {
  const now = Date.now();
  const key = getKey(req);
  const entry = state.get(key);
  if (!entry || entry.resetAt <= now) {
    state.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return next();
  }
  if (entry.count >= RATE_MAX) {
    return res.status(429).json({
      message: "Слишком много попыток. Повторите позже.",
      retry_after_ms: entry.resetAt - now,
    });
  }
  entry.count += 1;
  return next();
}

module.exports = { adminAuthRateLimit };
