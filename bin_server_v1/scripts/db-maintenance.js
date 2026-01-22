const path = require("path");

require("dotenv").config({
  path:
    process.env.DOTENV_PATH ||
    process.env.DOTENV_CONFIG_PATH ||
    path.resolve(__dirname, "../.env"),
});

const mainSequelize = require("../src/config/data_base");
const adminSequelize = require("../src/config/admin_db");

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    paymentsDays: null,
    logsDays: null,
    metricsDays: null,
    dryRun: false,
  };
  for (const arg of args) {
    if (arg.startsWith("--payments-days=")) {
      options.paymentsDays = Number(arg.split("=")[1]);
    } else if (arg.startsWith("--logs-days=")) {
      options.logsDays = Number(arg.split("=")[1]);
    } else if (arg.startsWith("--metrics-days=")) {
      options.metricsDays = Number(arg.split("=")[1]);
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }
  return options;
}

async function countRows(sequelize, sql, replacements) {
  const [rows] = await sequelize.query(sql, { replacements });
  const value = rows?.[0]?.count || rows?.[0]?.cnt || 0;
  return Number(value) || 0;
}

async function deleteRows(sequelize, sql, replacements, dryRun) {
  if (dryRun) return 0;
  const [result] = await sequelize.query(sql, { replacements });
  return result?.rowCount ?? 0;
}

async function cleanupMain(sequelize, options) {
  const report = [];
  if (Number.isFinite(options.paymentsDays)) {
    const replacements = { days: options.paymentsDays };
    const count = await countRows(
      sequelize,
      'SELECT COUNT(*)::int AS count FROM "Payments" WHERE expires_at < NOW() - (:days || \' days\')::interval;',
      replacements
    );
    const deleted = await deleteRows(
      sequelize,
      'DELETE FROM "Payments" WHERE expires_at < NOW() - (:days || \' days\')::interval;',
      replacements,
      options.dryRun
    );
    report.push({ name: "Payments", count, deleted });
  }

  if (Number.isFinite(options.logsDays)) {
    const replacements = { days: options.logsDays };
    const tables = ["generation_history", "scan_history", "bank_history"];
    for (const table of tables) {
      const count = await countRows(
        sequelize,
        `SELECT COUNT(*)::int AS count FROM ${table} WHERE created_at < NOW() - (:days || ' days')::interval;`,
        replacements
      );
      const deleted = await deleteRows(
        sequelize,
        `DELETE FROM ${table} WHERE created_at < NOW() - (:days || ' days')::interval;`,
        replacements,
        options.dryRun
      );
      report.push({ name: table, count, deleted });
    }
  }
  return report;
}

async function cleanupAdmin(sequelize, options) {
  const report = [];
  if (Number.isFinite(options.metricsDays)) {
    const replacements = { days: options.metricsDays };
    const count = await countRows(
      sequelize,
      'SELECT COUNT(*)::int AS count FROM system_metrics WHERE created_at < NOW() - (:days || \' days\')::interval;',
      replacements
    );
    const deleted = await deleteRows(
      sequelize,
      'DELETE FROM system_metrics WHERE created_at < NOW() - (:days || \' days\')::interval;',
      replacements,
      options.dryRun
    );
    report.push({ name: "system_metrics", count, deleted });
  }

  if (Number.isFinite(options.logsDays)) {
    const replacements = { days: options.logsDays };
    const count = await countRows(
      sequelize,
      'SELECT COUNT(*)::int AS count FROM error_logs WHERE created_at < NOW() - (:days || \' days\')::interval;',
      replacements
    );
    const deleted = await deleteRows(
      sequelize,
      'DELETE FROM error_logs WHERE created_at < NOW() - (:days || \' days\')::interval;',
      replacements,
      options.dryRun
    );
    report.push({ name: "error_logs", count, deleted });
  }
  return report;
}

async function main() {
  const options = parseArgs();
  if (
    !Number.isFinite(options.paymentsDays) &&
    !Number.isFinite(options.logsDays) &&
    !Number.isFinite(options.metricsDays)
  ) {
    console.error(
      "No cleanup parameters provided. Use --payments-days, --logs-days, or --metrics-days."
    );
    process.exitCode = 1;
    return;
  }

  try {
    await mainSequelize.authenticate();
    await adminSequelize.authenticate();

    const mainReport = await cleanupMain(mainSequelize, options);
    const adminReport = await cleanupAdmin(adminSequelize, options);

    console.log("Cleanup report:");
    for (const item of [...mainReport, ...adminReport]) {
      const label = options.dryRun ? "would delete" : "deleted";
      console.log(`${item.name}: ${label} ${item.deleted} of ${item.count}`);
    }
  } catch (err) {
    console.error("Cleanup failed:", err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    await mainSequelize.close().catch(() => {});
    await adminSequelize.close().catch(() => {});
  }
}

main();
