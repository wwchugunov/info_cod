const path = require("path");
const bcrypt = require("bcrypt");

require("dotenv").config({
  path:
    process.env.DOTENV_PATH ||
    process.env.DOTENV_CONFIG_PATH ||
    path.resolve(__dirname, "../.env"),
});

const AdminUser = require("../src/admin/model/adminUser.model");
const sequelize = require("../src/config/admin_db");

async function main() {
  const email = String(process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.SUPERADMIN_PASSWORD || "").trim();
  const name = String(process.env.SUPERADMIN_NAME || "admin").trim();

  if (!email || !password) {
    console.error("SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD are required.");
    process.exitCode = 1;
    return;
  }

  try {
    await sequelize.authenticate();
    await sequelize.sync();

    const exists = await AdminUser.findOne({ where: { email } });
    if (exists) {
      await exists.update({
        name,
        role: "superadmin",
        is_active: true,
        password_hash: await bcrypt.hash(password, 10),
      });
      console.log("Updated superadmin:", email);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await AdminUser.create({
      email,
      name,
      role: "superadmin",
      password_hash: passwordHash,
      is_active: true,
    });

    console.log("Created superadmin:", admin.email);
  } catch (err) {
    console.error("Failed to create superadmin:", err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    await sequelize.close().catch(() => {});
  }
}

main();
