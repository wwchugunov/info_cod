const http = require("http");
const https = require("https");
const { performance } = require("perf_hooks");

const BASE_URL = process.env.BASE_URL || "https://infokod.com.ua";
const COMPANY_TOKEN = process.env.COMPANY_TOKEN || "";

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
      res.on("data", () => {});
      res.on("end", () => {
        const durationMs = performance.now() - start;
        resolve({ ok: res.statusCode && res.statusCode < 400, status: res.statusCode, durationMs });
      });
    });
    req.on("error", (err) => {
      resolve({ ok: false, status: 0, durationMs: 0, error: String(err) });
    });
    if (payload) req.write(payload);
    req.end();
  });
}

async function loadTest({ concurrency, durationSec }) {
  const endAt = performance.now() + durationSec * 1000;
  let started = 0;
  let completed = 0;
  let failed = 0;
  const statuses = {};

  async function worker() {
    while (performance.now() < endAt) {
      started += 1;
      const res = await requestJson({
        method: "POST",
        url: `${BASE_URL}/api/payment/generate`,
        headers: {
          Authorization: `Bearer ${COMPANY_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: 1, purpose: "Load test" }),
      });
      if (res.ok) completed += 1;
      else failed += 1;
      const code = String(res.status || 0);
      statuses[code] = (statuses[code] || 0) + 1;
    }
  }

  const tasks = Array.from({ length: concurrency }, () => worker());
  const start = performance.now();
  await Promise.all(tasks);
  const elapsedSec = (performance.now() - start) / 1000;

  return {
    concurrency,
    durationSec,
    started,
    completed,
    failed,
    rps: elapsedSec ? completed / elapsedSec : 0,
    statuses,
  };
}

async function main() {
  if (!COMPANY_TOKEN) {
    console.error("Missing COMPANY_TOKEN");
    process.exitCode = 1;
    return;
  }

  const steps = [50, 75, 100, 150, 200, 300];
  const results = [];

  for (const concurrency of steps) {
    const res = await loadTest({ concurrency, durationSec: 10 });
    results.push(res);
    const errorStatus = Object.keys(res.statuses).find((s) => s !== "200" && s !== "201");
    if (res.failed > 0 || errorStatus) {
      results.push({ stopped_at: concurrency, reason: "errors detected" });
      break;
    }
  }

  console.log(JSON.stringify({ baseUrl: BASE_URL, results }, null, 2));
}

main();
