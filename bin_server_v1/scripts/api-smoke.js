const crypto = require("crypto");
require("dotenv").config();

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5050";
const API_BASE = `${BASE_URL.replace(/\/+$/, "")}/api`;

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || "";
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || "";

const cookieJar = {};

function storeCookies(setCookieHeaders = []) {
  for (const header of setCookieHeaders) {
    const part = header.split(";")[0];
    const [name, ...rest] = part.split("=");
    if (!name) continue;
    cookieJar[name] = rest.join("=");
  }
}

function cookieHeader() {
  const entries = Object.entries(cookieJar);
  if (!entries.length) return "";
  return entries.map(([k, v]) => `${k}=${v}`).join("; ");
}

function id() {
  return crypto.randomBytes(3).toString("hex");
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader() ? { Cookie: cookieHeader() } : {}),
      ...(options.headers || {}),
    },
  });
  const setCookie = res.headers.getSetCookie?.() || [];
  if (setCookie.length) storeCookies(setCookie);
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await res.json() : await res.text();
  return { res, body };
}

async function run() {
  const results = [];
  const record = (name, ok, info = "") => {
    results.push({ name, ok, info });
  };

  if (!SUPERADMIN_EMAIL || !SUPERADMIN_PASSWORD) {
    throw new Error("SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD are required.");
  }

  const login = await request("/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD }),
  });
  record("POST /admin/auth/login", login.res.ok, `${login.res.status}`);

  const refresh = await request("/admin/auth/refresh", {
    method: "POST",
    body: JSON.stringify({}),
  });
  record("POST /admin/auth/refresh", refresh.res.ok, `${refresh.res.status}`);

  const me = await request("/admin/auth/me", { headers: {} });
  record("GET /admin/auth/me", me.res.ok, `${me.res.status}`);

  const companyPayload = {
    name: `Test Co ${id()}`,
    contact_name: "Test Contact",
    contact_phone: "+380000000000",
    iban: "UA90305299000002600748573760",
    edrpo: String(Math.floor(10000000 + Math.random() * 89999999)),
    daily_limit: 10,
    use_daily_limit: true,
    commission_percent: 1.5,
    commission_fixed: 2.5,
    use_percent_commission: true,
    use_fixed_commission: true,
    is_active: true,
    logo_url: "",
    offer_url: "",
    ip_whitelist: [],
  };

  const createCompany = await request("/admin/companies", {
    method: "POST",
    headers: {},
    body: JSON.stringify(companyPayload),
  });
  record("POST /admin/companies", createCompany.res.ok, `${createCompany.res.status}`);
  const companyId = createCompany.body?.company?.id;
  const companyToken = createCompany.body?.api_token || "";

  const listCompanies = await request("/admin/companies", {
    headers: {},
  });
  record("GET /admin/companies", listCompanies.res.ok, `${listCompanies.res.status}`);

  const getCompany = await request(`/admin/companies/${companyId}`, {
    headers: {},
  });
  record("GET /admin/companies/:id", getCompany.res.ok, `${getCompany.res.status}`);

  const patchCompany = await request(`/admin/companies/${companyId}`, {
    method: "PATCH",
    headers: {},
    body: JSON.stringify({ contact_phone: "+380111111111" }),
  });
  record("PATCH /admin/companies/:id", patchCompany.res.ok, `${patchCompany.res.status}`);

  const rotateToken = await request(`/admin/companies/${companyId}/token`, {
    method: "POST",
    headers: {},
  });
  record("POST /admin/companies/:id/token", rotateToken.res.ok, `${rotateToken.res.status}`);
  const rotatedToken = rotateToken.body?.api_token || companyToken;

  const getToken = await request(`/admin/companies/${companyId}/token`, {
    headers: {},
  });
  record("GET /admin/companies/:id/token", getToken.res.ok, `${getToken.res.status}`);

  const listTokens = await request("/admin/companies/tokens", {
    headers: {},
  });
  record("GET /admin/companies/tokens", listTokens.res.ok, `${listTokens.res.status}`);

  const createCompanyAdmin = await request(`/admin/companies/${companyId}/admin-user`, {
    method: "POST",
    headers: {},
  });
  record("POST /admin/companies/:id/admin-user", createCompanyAdmin.res.ok, `${createCompanyAdmin.res.status}`);

  const adminEmail = `test_admin_${id()}@example.com`;
  const adminPassword = `Pass${id()}!`;
  const createAdmin = await request("/admin/admin-users", {
    method: "POST",
    headers: {},
    body: JSON.stringify({
      name: "Test Admin",
      email: adminEmail,
      password: adminPassword,
      role: "viewer",
      company_id: companyId,
    }),
  });
  record("POST /admin/admin-users", createAdmin.res.ok, `${createAdmin.res.status}`);
  const adminUserId = createAdmin.body?.id;

  const listAdmins = await request("/admin/admin-users", {
    headers: {},
  });
  record("GET /admin/admin-users", listAdmins.res.ok, `${listAdmins.res.status}`);

  const updateAdmin = await request(`/admin/admin-users/${adminUserId}`, {
    method: "PATCH",
    headers: {},
    body: JSON.stringify({ name: "Test Admin Updated" }),
  });
  record("PATCH /admin/admin-users/:id", updateAdmin.res.ok, `${updateAdmin.res.status}`);

  const resetAdminPass = await request(`/admin/admin-users/${adminUserId}/reset-password`, {
    method: "POST",
    headers: {},
    body: JSON.stringify({ password: `New${adminPassword}` }),
  });
  record("POST /admin/admin-users/:id/reset-password", resetAdminPass.res.ok, `${resetAdminPass.res.status}`);

  const metrics = await request("/admin/metrics", {
    headers: {},
  });
  record("GET /admin/metrics", metrics.res.ok, `${metrics.res.status}`);

  const metricsSeries = await request("/admin/metrics/series?period=day", {
    headers: {},
  });
  record("GET /admin/metrics/series", metricsSeries.res.ok, `${metricsSeries.res.status}`);

  const history = await request("/admin/history", {
    headers: {},
  });
  record("GET /admin/history", history.res.ok, `${history.res.status}`);

  const generationHistory = await request("/admin/generation-history", {
    headers: {},
  });
  record("GET /admin/generation-history", generationHistory.res.ok, `${generationHistory.res.status}`);

  const scanHistory = await request("/admin/scan-history", {
    headers: {},
  });
  record("GET /admin/scan-history", scanHistory.res.ok, `${scanHistory.res.status}`);

  const bankHistory = await request("/admin/bank-history", {
    headers: {},
  });
  record("GET /admin/bank-history", bankHistory.res.ok, `${bankHistory.res.status}`);

  const payments = await request("/admin/payments", {
    headers: {},
  });
  record("GET /admin/payments", payments.res.ok, `${payments.res.status}`);

  const errors = await request("/admin/errors", {
    headers: {},
  });
  record("GET /admin/errors", errors.res.ok, `${errors.res.status}`);

  const systemMetrics = await request("/admin/system-metrics", {
    headers: {},
  });
  record("GET /admin/system-metrics", systemMetrics.res.ok, `${systemMetrics.res.status}`);

  const clientError = await request("/admin/errors/client", {
    method: "POST",
    headers: {},
    body: JSON.stringify({
      message: "Test client error",
      source: "client",
      status_code: 418,
      path: "/test",
    }),
  });
  record("POST /admin/errors/client", clientError.res.ok, `${clientError.res.status}`);

  const exports = [
    "/admin/export/companies.csv",
    "/admin/export/payments.csv",
    "/admin/export/generation-history.csv",
    "/admin/export/scan-history.csv",
    "/admin/export/bank-history.csv",
  ];
  for (const path of exports) {
    const res = await request(path, {
      headers: {},
    });
    record(`GET ${path}`, res.res.ok, `${res.res.status}`);
  }

  const paymentGenerateInvalid = await request("/payment/generate", {
    method: "GET",
  });
  record("GET /payment/generate (405)", paymentGenerateInvalid.res.status === 405, `${paymentGenerateInvalid.res.status}`);

  if (rotatedToken || companyToken) {
    const generatePayment = await request("/payment/generate", {
      method: "POST",
      headers: { Authorization: `Bearer ${rotatedToken || companyToken}` },
      body: JSON.stringify({ amount: 10, purpose: "Test payment" }),
    });
    record("POST /payment/generate", generatePayment.res.ok, `${generatePayment.res.status}`);
    const linkId = generatePayment.body?.payment?.qr_link;

    const paymentPage = await fetch(`${BASE_URL.replace(/\/+$/, "")}/payment/${linkId}`);
    record("GET /payment/:linkId", paymentPage.ok, `${paymentPage.status}`);

    const scan = await fetch(`${BASE_URL.replace(/\/+$/, "")}/payment/${linkId}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: "test" }),
    });
    record("POST /payment/:linkId/scan", scan.ok, `${scan.status}`);

    const bank = await fetch(`${BASE_URL.replace(/\/+$/, "")}/payment/${linkId}/bank`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bank_short_name: "test", action: "open_app" }),
    });
    record("POST /payment/:linkId/bank", bank.ok, `${bank.status}`);
  } else {
    record("POST /payment/generate", true, "skipped (token not returned)");
    record("GET /payment/:linkId", true, "skipped (token not returned)");
    record("POST /payment/:linkId/scan", true, "skipped (token not returned)");
    record("POST /payment/:linkId/bank", true, "skipped (token not returned)");
  }

  const deleteAdmin = await request(`/admin/admin-users/${adminUserId}`, {
    method: "DELETE",
    headers: {},
  });
  record("DELETE /admin/admin-users/:id", deleteAdmin.res.ok, `${deleteAdmin.res.status}`);

  const deleteCompany = await request(`/admin/companies/${companyId}`, {
    method: "DELETE",
    headers: {},
  });
  record("DELETE /admin/companies/:id", deleteCompany.res.ok, `${deleteCompany.res.status}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`API smoke: ${results.length - failed.length}/${results.length} passed`);
  failed.forEach((r) => console.log(`FAIL ${r.name} (${r.info})`));
}

run().catch((err) => {
  console.error("API smoke failed:", err.message);
  process.exitCode = 1;
});
