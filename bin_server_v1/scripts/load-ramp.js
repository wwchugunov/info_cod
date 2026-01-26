const http = require("http");
const https = require("https");
const { performance } = require("perf_hooks");

const BASE_URL = process.env.BASE_URL || "https://infokod.com.ua";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const COMPANY_TOKEN = process.env.COMPANY_TOKEN || "";
const CPU_LIMIT = Number(process.env.CPU_LIMIT || 85);

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

  async function worker() {
    while (performance.now() < endAt) {
      started += 1;
      const res = await requestJson({ method, url, headers, body });
      if (res.ok) {
        completed += 1;
        latencies.push(res.durationMs);
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
  };
}

async function getAdminToken() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return "";
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

async function getLatestMetrics(adminToken) {
  const res = await requestJson({
    method: "GET",
    url: `${BASE_URL}/api/admin/system-metrics?limit=1`,
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!res.ok) return null;
  try {
    const data = JSON.parse(res.body);
    const item = data.items && data.items[0];
    return item || null;
  } catch {
    return null;
  }
}

async function createPayment(companyToken) {
  const res = await requestJson({
    method: "POST",
    url: `${BASE_URL}/api/payment/generate`,
    headers: {
      Authorization: `Bearer ${companyToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount: 1, purpose: "Load test" }),
  });
  if (!res.ok) return "";
  try {
    const data = JSON.parse(res.body);
    return data.payment?.qr_link || "";
  } catch {
    return "";
  }
}

async function runRamp({ name, method, path, headers, body, steps, durationSec, adminToken }) {
  const results = [];
  for (const concurrency of steps) {
    const result = await loadTest({ name, method, path, headers, body, durationSec, concurrency });
    results.push(result);
    await sleep(12000);
    const metrics = await getLatestMetrics(adminToken);
    if (metrics && Number(metrics.cpu_usage_percent) >= CPU_LIMIT) {
      results.push({
        name: `${name}_cpu_guard`,
        cpu_usage_percent: Number(metrics.cpu_usage_percent),
        stopped: true,
      });
      break;
    }
  }
  return results;
}

async function main() {
  const adminToken = await getAdminToken();
  if (!adminToken) {
    console.error("Failed to obtain admin token");
    process.exitCode = 1;
    return;
  }
  if (!COMPANY_TOKEN) {
    console.error("Missing COMPANY_TOKEN");
    process.exitCode = 1;
    return;
  }

  const linkId = await createPayment(COMPANY_TOKEN);
  const paymentPath = linkId ? `/payment/${linkId}` : null;

  const results = [];
  results.push(
    ...(await runRamp({
      name: "payment_generate",
      method: "POST",
      path: "/api/payment/generate",
      headers: {
        Authorization: `Bearer ${COMPANY_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: 1, purpose: "Load test" }),
      steps: [5, 10, 20, 30, 40],
      durationSec: 15,
      adminToken,
    }))
  );

  if (paymentPath) {
    results.push(
      ...(await runRamp({
        name: "payment_page",
        method: "GET",
        path: paymentPath,
        headers: {},
        body: null,
        steps: [10, 25, 50, 100],
        durationSec: 15,
        adminToken,
      }))
    );
  }

  results.push(
    ...(await runRamp({
      name: "admin_scan_history",
      method: "GET",
      path: "/api/admin/scan-history?limit=50&page=1",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: null,
      steps: [5, 10, 20],
      durationSec: 10,
      adminToken,
    }))
  );

  console.log(JSON.stringify({ baseUrl: BASE_URL, cpuLimit: CPU_LIMIT, results }, null, 2));
}

main();
