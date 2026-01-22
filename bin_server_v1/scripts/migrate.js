const fs = require("fs");
const path = require("path");

const mainSequelize = require("../src/config/data_base");
const adminSequelize = require("../src/config/admin_db");

const MIGRATION_TABLE = "schema_migrations";

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { db: "all", dryRun: false };
  for (const arg of args) {
    if (arg.startsWith("--db=")) {
      options.db = arg.split("=")[1];
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }
  return options;
}

function listMigrations(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".js"))
    .sort()
    .map((file) => ({
      name: file,
      filePath: path.join(dir, file),
    }));
}

async function ensureMigrationsTable(sequelize) {
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (\n` +
      `  id SERIAL PRIMARY KEY,\n` +
      `  name VARCHAR(255) UNIQUE NOT NULL,\n` +
      `  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n` +
      `);`
  );
}

async function getApplied(sequelize) {
  const [rows] = await sequelize.query(
    `SELECT name FROM ${MIGRATION_TABLE} ORDER BY name;`
  );
  return new Set(rows.map((row) => row.name));
}

async function runMigration(sequelize, migration, options) {
  const mod = require(migration.filePath);
  if (!mod || typeof mod.up !== "function") {
    throw new Error(`Migration ${migration.name} does not export up()`);
  }
  if (options.dryRun) {
    console.log(`[dry-run] ${migration.name}`);
    return;
  }
  const queryInterface = sequelize.getQueryInterface();
  await sequelize.transaction(async (transaction) => {
    await mod.up({ sequelize, queryInterface, transaction });
    await sequelize.query(
      `INSERT INTO ${MIGRATION_TABLE} (name) VALUES (:name);`,
      { replacements: { name: migration.name }, transaction }
    );
  });
  console.log(`Applied ${migration.name}`);
}

async function runMigrations({ sequelize, migrationsDir, label, options }) {
  console.log(`\n== ${label} ==`);
  await sequelize.authenticate();
  await ensureMigrationsTable(sequelize);
  const applied = await getApplied(sequelize);
  const migrations = listMigrations(migrationsDir).filter(
    (migration) => !applied.has(migration.name)
  );

  if (!migrations.length) {
    console.log("No pending migrations");
    return;
  }

  for (const migration of migrations) {
    await runMigration(sequelize, migration, options);
  }
}

async function main() {
  const options = parseArgs();
  const targets = options.db === "all" ? ["main", "admin"] : [options.db];

  try {
    if (targets.includes("main")) {
      await runMigrations({
        sequelize: mainSequelize,
        migrationsDir: path.join(__dirname, "..", "migrations", "main"),
        label: "MAIN DB",
        options,
      });
    }
    if (targets.includes("admin")) {
      await runMigrations({
        sequelize: adminSequelize,
        migrationsDir: path.join(__dirname, "..", "migrations", "admin"),
        label: "ADMIN DB",
        options,
      });
    }
  } catch (err) {
    console.error("Migration failed:", err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    await mainSequelize.close().catch(() => {});
    await adminSequelize.close().catch(() => {});
  }
}

main();
