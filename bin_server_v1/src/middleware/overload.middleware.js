const RATE_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const RATE_MAX = Number(process.env.RATE_LIMIT_MAX || 30);
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_REQUESTS || 120);
const MAX_AVG_MS = Number(process.env.MAX_AVG_RESPONSE_MS || 1500);
const DISABLE_OVERLOAD = String(process.env.DISABLE_OVERLOAD || "").toLowerCase() === "1";

const rateState = new Map();
const latencySamples = [];
const MAX_LATENCY_SAMPLES = 100;
let concurrent = 0;

function getRateKey(req) {
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return token || req.ip || "unknown";
}

function recordLatency(ms) {
  latencySamples.push(ms);
  if (latencySamples.length > MAX_LATENCY_SAMPLES) {
    latencySamples.shift();
  }
}

function avgLatency() {
  if (!latencySamples.length) return 0;
  const sum = latencySamples.reduce((a, b) => a + b, 0);
  return sum / latencySamples.length;
}

function rateLimitPaymentGenerate(req, res, next) {
  if (DISABLE_OVERLOAD) {
    return next();
  }
  if (req.method !== "POST" || !req.path.startsWith("/api/payment/generate")) {
    return next();
  }
  const key = getRateKey(req);
  const now = Date.now();
  const entry = rateState.get(key);
  if (!entry || entry.resetAt <= now) {
    rateState.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return next();
  }
  if (entry.count >= RATE_MAX) {
    return res.status(429).json({
      message: "Запит тимчасово недоступний. Спробуйте пізніше.",
      retry_after_ms: entry.resetAt - now,
    });
  }
  entry.count += 1;
  return next();
}

function overloadGuard(req, res, next) {
  if (DISABLE_OVERLOAD) {
    return next();
  }
  if (!req.path.startsWith("/api/payment") && !req.path.startsWith("/payment")) {
    return next();
  }
  const start = Date.now();
  concurrent += 1;

  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    concurrent = Math.max(0, concurrent - 1);
    recordLatency(Date.now() - start);
  };

  res.on("finish", done);
  res.on("close", done);

  if (concurrent > MAX_CONCURRENT || (MAX_AVG_MS > 0 && avgLatency() > MAX_AVG_MS)) {
    res.status(503).json({ message: "Запит тимчасово недоступний. Спробуйте пізніше." });
    return;
  }

  next();
}

module.exports = {
  overloadGuard,
  rateLimitPaymentGenerate,
};
