const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const sequelize = require("../src/config/data_base");

async function main() {
  await sequelize.authenticate();

  const [generationCounts] = await sequelize.query(`
    WITH grouped AS (
      SELECT COALESCE(token_hash, link_id::text, id::text) AS key, COUNT(*) AS cnt
      FROM generation_history
      GROUP BY key
    )
    SELECT
      COALESCE(SUM(cnt), 0) AS total_count,
      COALESCE(SUM(CASE WHEN cnt = 1 THEN 1 ELSE 0 END), 0) AS unique_count,
      COALESCE(SUM(CASE WHEN cnt > 1 THEN cnt ELSE 0 END), 0) AS duplicate_count
    FROM grouped;
  `);

  const [scanCounts] = await sequelize.query(`
    SELECT
      COUNT(*) AS total_count,
      COUNT(*) FILTER (WHERE is_duplicate = false) AS unique_count,
      COUNT(*) FILTER (WHERE is_duplicate = true) AS duplicate_count
    FROM scan_history;
  `);

  const [bankCounts] = await sequelize.query(`
    SELECT COUNT(*) AS total_count
    FROM bank_history;
  `);

  console.log("Log check:");
  console.log(
    `Generation: total=${generationCounts[0].total_count}, unique=${generationCounts[0].unique_count}, duplicate=${generationCounts[0].duplicate_count}`
  );
  console.log(
    `Scans: total=${scanCounts[0].total_count}, unique=${scanCounts[0].unique_count}, duplicate=${scanCounts[0].duplicate_count}`
  );
  console.log(`Banks: total=${bankCounts[0].total_count}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Check failed:", err);
    process.exit(1);
  });
