const path = require("path");
require("dotenv").config({
  path:
    process.env.DOTENV_PATH ||
    process.env.DOTENV_CONFIG_PATH ||
    path.resolve(__dirname, "../.env"),
});
const sequelize = require("../src/config/data_base");

async function main() {
  try {
    await sequelize.authenticate();
    await sequelize.query(
      'TRUNCATE TABLE "Payments", generation_history RESTART IDENTITY CASCADE;'
    );
    console.log('Payments and generation_history truncated (cascade).');
  } catch (err) {
    console.error("Cleanup failed:", err && err.message ? err.message : err);
    if (err && err.parent && err.parent.message) {
      console.error("DB error:", err.parent.message);
    }
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
