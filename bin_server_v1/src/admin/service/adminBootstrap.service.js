const bcrypt = require("bcrypt");
const AdminUser = require("../model/adminUser.model");

async function ensureSuperAdmin() {
  const count = await AdminUser.count();
  if (count > 0) return;

  const email = String(process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.SUPERADMIN_PASSWORD || "").trim();
  const name = String(process.env.SUPERADMIN_NAME || "Super Admin").trim();

  if (!email || !password) {
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await AdminUser.create({
    email,
    name,
    role: "superadmin",
    password_hash: passwordHash,
    is_active: true,
  });
}

module.exports = { ensureSuperAdmin };
