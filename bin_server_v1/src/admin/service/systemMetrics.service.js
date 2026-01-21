const os = require("os");
const { monitorEventLoopDelay } = require("perf_hooks");
const SystemMetric = require("../model/systemMetric.model");

const stats = {
  bytesIn: 0,
  bytesOut: 0,
  reqCount: 0,
  errorCount: 0,
  totalDurationMs: 0,
};

const loopDelay = monitorEventLoopDelay({ resolution: 10 });
loopDelay.enable();

let prevCpu = process.cpuUsage();
let prevTime = process.hrtime.bigint();

function recordRequestMetrics(req, res, next) {
  const start = process.hrtime.bigint();
  const inBytes = Number(req.headers["content-length"]) || 0;
  stats.bytesIn += inBytes;
  stats.reqCount += 1;

  res.on("finish", () => {
    const outBytes = Number(res.getHeader("content-length")) || 0;
    stats.bytesOut += outBytes;
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    stats.totalDurationMs += durationMs;
    if (res.statusCode >= 400) {
      stats.errorCount += 1;
    }
  });

  next();
}

async function sampleSystemMetrics(intervalMs = 10000) {
  const now = process.hrtime.bigint();
  const elapsedUs = Number(now - prevTime) / 1000;
  const cpuUsage = process.cpuUsage(prevCpu);
  prevCpu = process.cpuUsage();
  prevTime = now;

  const cpuTotalUs = cpuUsage.user + cpuUsage.system;
  const cpuPercent = elapsedUs > 0
    ? (cpuTotalUs / elapsedUs) * 100 / os.cpus().length
    : 0;

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const procMem = process.memoryUsage();
  const avgResponse = stats.reqCount
    ? stats.totalDurationMs / stats.reqCount
    : 0;

  const intervalSeconds = intervalMs / 1000;
  const rps = intervalSeconds > 0 ? stats.reqCount / intervalSeconds : 0;

  await SystemMetric.create({
    cpu_usage_percent: Number(cpuPercent.toFixed(2)),
    load_1: os.loadavg()[0],
    load_5: os.loadavg()[1],
    load_15: os.loadavg()[2],
    mem_total: totalMem,
    mem_used: usedMem,
    mem_free: freeMem,
    process_rss: procMem.rss,
    heap_used: procMem.heapUsed,
    heap_total: procMem.heapTotal,
    event_loop_lag_ms: loopDelay.mean / 1e6,
    bytes_in: stats.bytesIn,
    bytes_out: stats.bytesOut,
    req_count: stats.reqCount,
    error_count: stats.errorCount,
    avg_response_ms: Number(avgResponse.toFixed(2)),
    rps: Number(rps.toFixed(2)),
  });

  stats.bytesIn = 0;
  stats.bytesOut = 0;
  stats.reqCount = 0;
  stats.errorCount = 0;
  stats.totalDurationMs = 0;
  loopDelay.reset();
}

function startSystemMetricsSampler({ intervalMs = 10000 } = {}) {
  setInterval(() => {
    sampleSystemMetrics(intervalMs).catch(() => {});
  }, intervalMs);
}

module.exports = { recordRequestMetrics, startSystemMetricsSampler };
