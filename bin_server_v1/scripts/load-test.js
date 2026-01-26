const http = require("http");
const https = require("https");
const { performance } = require("perf_hooks");

const BASE_URL = process.env.BASE_URL || "https://infokod.com.ua";
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "").trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ADMIN_TOKEN_ENV = process.env.ADMIN_TOKEN || "";
const COMPANY_TOKEN = String(process.env.COMPANY_TOKEN || "").trim();

function ensureEnv(entries) {
  const missing = entries.filter(([, value]) => !value).map(([name]) => name);
  if (!missing.length) return true;
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestJson({ method, url, headers, body }) {
  return new Promise((resolve) => {
    const target = new URL(url);
    const lib = target.protocol === "https:" ? https : http;
    const payload = body ? Buffer.from(body, "utf8") : null;
    const options = {
      method,
      hostname: target.hostname,
      port: target.port || (target.protocol === "https:" ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      headers: {
        ...(headers || {}),
        ...(payload ? { "Content-Length": payload.length } : {}),
      },
    };

    const start = performance.now();
    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const durationMs = performance.now() - start;
        const raw = Buffer.concat(chunks);
        const text = raw.toString("utf8");
        resolve({
          ok: res.statusCode && res.statusCode < 400,
          status: res.statusCode,
          body: text,
          sizeBytes: raw.length,
          durationMs,
        });
      });
    });
    req.on("error", (err) => {
      resolve({ ok: false, status: 0, body: String(err), sizeBytes: 0, durationMs: 0 });
    });
    if (payload) req.write(payload);
    req.end();
  });
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function loadTest({ name, method, path, headers, body, durationSec, concurrency }) {
  const url = `${BASE_URL}${path}`;
  const endAt = performance.now() + durationSec * 1000;
  let started = 0;
  let completed = 0;
  let failed = 0;
  const latencies = [];
  const sizes = [];

  async function worker() {
    while (performance.now() < endAt) {
      started += 1;
      const res = await requestJson({ method, url, headers, body });
      if (res.ok) {
        completed += 1;
        latencies.push(res.durationMs);
        sizes.push(res.sizeBytes);
      } else {
        failed += 1;
      }
    }
  }

  const tasks = Array.from({ length: concurrency }, () => worker());
  const start = performance.now();
  await Promise.all(tasks);
  const elapsedSec = (performance.now() - start) / 1000;

  const avg = latencies.length
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length
    : 0;
  const avgSize = sizes.length
    ? sizes.reduce((a, b) => a + b, 0) / sizes.length
    : 0;

  return {
    name,
    method,
    path,
    durationSec,
    concurrency,
    started,
    completed,
    failed,
    rps: elapsedSec ? completed / elapsedSec : 0,
    latencyAvgMs: avg,
    latencyP50Ms: percentile(latencies, 50),
    latencyP95Ms: percentile(latencies, 95),
    latencyP99Ms: percentile(latencies, 99),
    avgResponseBytes: avgSize,
  };
}

async function getAdminToken() {
  if (ADMIN_TOKEN_ENV) return ADMIN_TOKEN_ENV;
  const res = await requestJson({
    method: "POST",
    url: `${BASE_URL}/api/admin/auth/login`,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) return "";
  try {
    const data = JSON.parse(res.body);
    return data.access_token || "";
  } catch {
    return "";
  }
}

async function run() {
  if (
    !ensureEnv([
      ["ADMIN_EMAIL", ADMIN_EMAIL],
      ["ADMIN_PASSWORD", ADMIN_PASSWORD],
      ["COMPANY_TOKEN", COMPANY_TOKEN],
    ])
  ) {
    process.exitCode = 1;
    return;
  }

  const adminToken = await getAdminToken();
  if (!adminToken) {
    console.error("Failed to obtain admin token");
    process.exitCode = 1;
    return;
  }

  const results = [];

  results.push(
    await loadTest({
      name: "payment_generate_c10",
      method: "POST",
      path: "/api/payment/generate",
      headers: {
        Authorization: `Bearer ${COMPANY_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: 1, purpose: "Load test" }),
      durationSec: 20,
      concurrency: 10,
    })
  );

  results.push(
    await loadTest({
      name: "payment_generate_c25",
      method: "POST",
      path: "/api/payment/generate",
      headers: {
        Authorization: `Bearer ${COMPANY_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: 1, purpose: "Load test" }),
      durationSec: 20,
      concurrency: 25,
    })
  );

  results.push(
    await loadTest({
      name: "admin_scan_history",
      method: "GET",
      path: "/api/admin/scan-history?limit=50&page=1",
      headers: { Authorization: `Bearer ${adminToken}` },
      durationSec: 10,
      concurrency: 5,
    })
  );

  results.push(
    await loadTest({
      name: "admin_system_metrics",
      method: "GET",
      path: "/api/admin/system-metrics?limit=1",
      headers: { Authorization: `Bearer ${adminToken}` },
      durationSec: 10,
      concurrency: 2,
    })
  );

  console.log(JSON.stringify({ baseUrl: BASE_URL, results }, null, 2));
}

run();
