const path = require("path");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const sequelize = require("../src/config/data_base");
const adminSequelize = require("../src/config/admin_db");
const Company = require("../src/model/company.model");
const Payment = require("../src/model/generatelink");
const GenerationHistory = require("../src/model/generationHistory.model");
const ScanHistory = require("../src/model/scanHistory.model");
const BankHistory = require("../src/model/bankHistory.model");
const AdminUser = require("../src/admin/model/adminUser.model");

const TEST_PASSWORD = process.env.TEST_ADMIN_PASSWORD;
const TEST_COMPANY_TOKEN = process.env.TEST_COMPANY_TOKEN;

if (!TEST_PASSWORD) {
  throw new Error(
    "TEST_ADMIN_PASSWORD must be set before running scripts/seed.js (e.g. TEST_ADMIN_PASSWORD=Secret npm run seed)."
  );
}
if (!TEST_COMPANY_TOKEN) {
  throw new Error(
    "TEST_COMPANY_TOKEN must be set before running scripts/seed.js."
  );
}

async function ensureAdminUser({ email, name, role, companyId }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const existing = await AdminUser.findOne({ where: { email: normalizedEmail } });
  if (existing) return existing;

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  return AdminUser.create({
    email: normalizedEmail,
    name,
    role,
    company_id: companyId || null,
    password_hash: passwordHash,
    is_active: true,
  });
}

async function ensureCompany() {
  const edrpo = "12345678";
  const existing = await Company.findOne({ where: { edrpo } });
  if (existing) {
    return { company: existing, apiTokenPlain: null };
  }

  const apiToken = TEST_COMPANY_TOKEN;
  const company = await Company.create({
    name: "Test Company",
    contact_name: "Test Owner",
    contact_phone: "+380000000000",
    iban: "UA663077700000026208121463098",
    edrpo,
    daily_limit: 1000,
    use_daily_limit: true,
    commission_percent: 1.5,
    commission_fixed: 2.5,
    use_percent_commission: true,
    use_fixed_commission: true,
    api_token: apiToken,
    api_token_prefix: apiToken.slice(0, 8),
    is_active: true,
  });

  return { company, apiTokenPlain: apiToken };
}

async function seedLogs(company, tokenPlain) {
  const now = Date.now();
  const payment = await Payment.create({
    company_id: company.id,
    company_name: company.name,
    amount: 100,
    purpose: "Seed payment",
    iban: company.iban,
    commission_percent: 1.5,
    commission_fixed: 2.5,
    link_id: uuidv4(),
    status: "pending",
    client_ip: "127.0.0.1",
    expires_at: new Date(now + 24 * 60 * 60 * 1000),
  });

  const tokenHash = tokenPlain
    ? crypto.createHash("sha256").update(tokenPlain).digest("hex")
    : null;

  await GenerationHistory.bulkCreate([
    {
      company_id: company.id,
      company_name: company.name,
      token_hash: tokenHash,
      amount: 100,
      commission_percent: 1.5,
      commission_fixed: 2.5,
      final_amount: 104,
      purpose: "Seed generation",
      link_id: payment.link_id,
      client_ip: "127.0.0.1",
      user_agent: "seed-agent",
      status: "success",
    },
    {
      company_id: company.id,
      company_name: company.name,
      token_hash: tokenHash,
      amount: 100,
      commission_percent: 1.5,
      commission_fixed: 2.5,
      final_amount: 104,
      purpose: "Seed generation duplicate",
      link_id: payment.link_id,
      client_ip: "127.0.0.1",
      user_agent: "seed-agent",
      status: "success",
    },
  ]);

  await ScanHistory.bulkCreate([
    {
      payment_id: payment.id,
      company_id: company.id,
      company_name: company.name,
      link_id: payment.link_id,
      client_ip: "127.0.0.1",
      user_agent: "seed-agent",
      platform: "desktop",
      language: "uk-UA",
      screen: "1920x1080@1",
      timezone: "Europe/Kyiv",
      referrer: "seed",
      device: "desktop",
      is_duplicate: false,
    },
    {
      payment_id: payment.id,
      company_id: company.id,
      company_name: company.name,
      link_id: payment.link_id,
      client_ip: "127.0.0.1",
      user_agent: "seed-agent",
      platform: "desktop",
      language: "uk-UA",
      screen: "1920x1080@1",
      timezone: "Europe/Kyiv",
      referrer: "seed",
      device: "desktop",
      is_duplicate: true,
    },
  ]);

  await BankHistory.create({
    payment_id: payment.id,
    company_id: company.id,
    company_name: company.name,
    link_id: payment.link_id,
    bank_short_name: "mono",
    bank_name: "Monobank",
    bank_package_android: "com.ftband.mono",
    bank_package_ios: "mono",
    platform: "android",
    action: "open_app",
    client_ip: "127.0.0.1",
    user_agent: "seed-agent",
  });
}

async function main() {
  await sequelize.authenticate();
  await adminSequelize.authenticate();

  const { company, apiTokenPlain } = await ensureCompany();

  const adminUsers = await Promise.all([
    ensureAdminUser({
      email: "superadmin@test.local",
      name: "Super Admin",
      role: "superadmin",
      companyId: null,
    }),
    ensureAdminUser({
      email: "admin@test.local",
      name: "Admin",
      role: "admin",
      companyId: company.id,
    }),
    ensureAdminUser({
      email: "manager@test.local",
      name: "Manager",
      role: "manager",
      companyId: company.id,
    }),
    ensureAdminUser({
      email: "viewer@test.local",
      name: "Viewer",
      role: "viewer",
      companyId: company.id,
    }),
  ]);

  await seedLogs(company, apiTokenPlain || TEST_COMPANY_TOKEN);

  console.log("Seed complete.");
  console.log(`Company ID: ${company.id}`);
  if (apiTokenPlain) {
    console.log(`Company API token: ${apiTokenPlain}`);
  } else {
    console.log("Company API token: not changed (existing company)");
  }
  console.log(`Admin password: ${TEST_PASSWORD}`);
  console.log(
    `Admin users: ${adminUsers.map((user) => user.email).join(", ")}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
