const https = require("https");
const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.BASE_URL || "https://infokod.com.ua";
const HOST_HEADER = process.env.HOST_HEADER || "";
const CA_CERT_PATH = process.env.CA_CERT_PATH || "";
const ALLOW_INSECURE_TLS =
  String(process.env.ALLOW_INSECURE_TLS || "").toLowerCase() === "true";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const REPORT_PATH =
  process.env.REPORT_PATH || path.resolve(__dirname, "..", "..", "TESTING_REPORT.md");
const CHECKLIST_PATH =
  process.env.CHECKLIST_PATH ||
  path.resolve(__dirname, "..", "..", "TESTING_CHECKLIST.md");

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Missing ADMIN_EMAIL or ADMIN_PASSWORD env vars.");
  process.exit(1);
}

function formatError(err) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  return err.message || String(err);
}

function buildUrl(pathname) {
  if (/^https?:\/\//i.test(pathname)) return new URL(pathname);
  return new URL(pathname, BASE_URL);
}

function parseSetCookie(jar, setCookies) {
  if (!setCookies) return;
  const entries = Array.isArray(setCookies) ? setCookies : [setCookies];
  for (const entry of entries) {
    if (!entry) continue;
    const [pair] = entry.split(";");
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (!key) continue;
    if (!value) {
      delete jar[key];
    } else {
      jar[key] = value;
    }
  }
}

function jarHeader(jar) {
  const parts = [];
  for (const [key, value] of Object.entries(jar || {})) {
    if (!value) continue;
    parts.push(`${key}=${value}`);
  }
  return parts.join("; ");
}

function requestJson({ method, path: reqPath, body, jar, headers = {} }) {
  const url = buildUrl(reqPath);
  const payload = body ? Buffer.from(JSON.stringify(body), "utf8") : null;
  const hostHeader = HOST_HEADER || url.hostname;
  const ca =
    CA_CERT_PATH && fs.existsSync(CA_CERT_PATH)
      ? fs.readFileSync(CA_CERT_PATH)
      : undefined;
  const opts = {
    method: method || "GET",
    hostname: url.hostname,
    port: url.port || 443,
    path: `${url.pathname}${url.search}`,
    headers: {
      Host: hostHeader,
      ...headers,
      ...(payload ? { "Content-Type": "application/json" } : {}),
      ...(payload ? { "Content-Length": payload.length } : {}),
    },
    servername: hostHeader,
    ...(ca ? { ca } : {}),
    ...(ALLOW_INSECURE_TLS ? { rejectUnauthorized: false } : {}),
  };
  if (jar && Object.keys(jar).length) {
    opts.headers.Cookie = jarHeader(jar);
  }
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks);
        const text = raw.toString("utf8");
        if (jar) {
          parseSetCookie(jar, res.headers["set-cookie"]);
        }
        let json = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = null;
        }
        resolve({
          status: res.statusCode || 0,
          headers: res.headers || {},
          body: text,
          json,
        });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function randomDigits(length) {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += Math.floor(Math.random() * 10);
  }
  return out;
}

function mod97(input) {
  let remainder = 0;
  for (const ch of input) {
    const digit = ch.charCodeAt(0) - 48;
    remainder = (remainder * 10 + digit) % 97;
  }
  return remainder;
}

function ibanCheckDigits(country, bban) {
  const rearranged = `${bban}${country}00`;
  const converted = rearranged
    .toUpperCase()
    .split("")
    .map((ch) => {
      if (ch >= "A" && ch <= "Z") {
        return String(ch.charCodeAt(0) - 55);
      }
      return ch;
    })
    .join("");
  const remainder = mod97(converted);
  const check = 98 - remainder;
  return String(check).padStart(2, "0");
}

function generateValidUaIban() {
  const bban = randomDigits(25);
  const check = ibanCheckDigits("UA", bban);
  return `UA${check}${bban}`;
}

function nowTag() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "");
}

async function run() {
  const results = {};
  const notes = {};
  const created = {
    companies: [],
    users: [],
  };

  const setResult = (id, status, note) => {
    results[id] = status;
    if (note) notes[id] = note;
  };

  const assert = (condition, message) => {
    if (!condition) throw new Error(message || "Assertion failed");
  };

  const superadminJar = {};

  // 6.1.1 Login success
  try {
    const res = await requestJson({
      method: "POST",
      path: "/api/admin/auth/login",
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      jar: superadminJar,
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.json?.role === "superadmin", "Role is not superadmin");
    setResult("6.1.1", "PASS");
  } catch (err) {
    setResult("6.1.1", "FAIL", formatError(err));
    console.error("Login failed, aborting:", formatError(err));
    return finalize(results, notes);
  }

  // 6.1.2 Login invalid
  try {
    const res = await requestJson({
      method: "POST",
      path: "/api/admin/auth/login",
      body: { email: ADMIN_EMAIL, password: "wrong-password" },
      jar: {},
    });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
    setResult("6.1.2", "PASS");
  } catch (err) {
    setResult("6.1.2", "FAIL", formatError(err));
  }

  // 6.1.3 Logout & session invalid
  try {
    const res = await requestJson({
      method: "POST",
      path: "/api/admin/auth/logout",
      jar: superadminJar,
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const resMe = await requestJson({
      method: "GET",
      path: "/api/admin/auth/me",
      jar: superadminJar,
    });
    assert(resMe.status === 401, `Expected 401, got ${resMe.status}`);
    setResult("6.1.3", "PASS");
  } catch (err) {
    setResult("6.1.3", "FAIL", formatError(err));
  }

  // Re-login after logout for further tests
  try {
    await requestJson({
      method: "POST",
      path: "/api/admin/auth/login",
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      jar: superadminJar,
    });
  } catch (err) {
    console.error("Re-login failed:", formatError(err));
    return finalize(results, notes);
  }

  const suffix = nowTag();
  const companyPayload = {
    name: `TEST COMPANY ${suffix}`,
    contact_name: "Test Contact",
    contact_phone: "+380501234567",
    iban: generateValidUaIban(),
    edrpo: randomDigits(8),
    daily_limit: 5,
    use_daily_limit: true,
    commission_percent: 0,
    commission_fixed: 0,
    use_percent_commission: true,
    use_fixed_commission: true,
    is_active: true,
  };

  let testCompany = null;
  // 6.3.10 Create company
  try {
    const res = await requestJson({
      method: "POST",
      path: "/api/admin/companies",
      body: companyPayload,
      jar: superadminJar,
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(res.json?.company?.id, "Company id missing");
    testCompany = res.json.company;
    created.companies.push(testCompany.id);
    setResult("6.3.10", "PASS");
  } catch (err) {
    setResult("6.3.10", "FAIL", formatError(err));
  }

  // 6.3.11 Validation checks
  try {
    const resBadIban = await requestJson({
      method: "POST",
      path: "/api/admin/companies",
      body: { ...companyPayload, iban: "UA0000" },
      jar: superadminJar,
    });
    const resBadEdrpo = await requestJson({
      method: "POST",
      path: "/api/admin/companies",
      body: { ...companyPayload, edrpo: "12" },
      jar: superadminJar,
    });
    assert(resBadIban.status === 400, `Expected 400, got ${resBadIban.status}`);
    assert(resBadEdrpo.status === 400, `Expected 400, got ${resBadEdrpo.status}`);
    setResult("6.3.11", "PASS");
  } catch (err) {
    setResult("6.3.11", "FAIL", formatError(err));
  }

  if (!testCompany) {
    console.error("No test company, skipping dependent tests.");
    return finalize(results, notes);
  }

  // 6.3.14 Edit company
  try {
    const res = await requestJson({
      method: "PATCH",
      path: `/api/admin/companies/${testCompany.id}`,
      body: { contact_name: "Updated Contact" },
      jar: superadminJar,
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const resGet = await requestJson({
      method: "GET",
      path: `/api/admin/companies/${testCompany.id}`,
      jar: superadminJar,
    });
    assert(resGet.json?.contact_name === "Updated Contact", "Contact name not updated");
    setResult("6.3.14", "PASS");
  } catch (err) {
    setResult("6.3.14", "FAIL", formatError(err));
  }

  // 6.3.12 Commission settings + 6.5.22 calculation
  try {
    await requestJson({
      method: "PATCH",
      path: `/api/admin/companies/${testCompany.id}`,
      body: {
        commission_percent: 1.5,
        commission_fixed: 2,
        use_percent_commission: true,
        use_fixed_commission: true,
      },
      jar: superadminJar,
    });
    const resPayment = await requestJson({
      method: "POST",
      path: `/api/admin/companies/${testCompany.id}/payment/generate`,
      body: { amount: 10, purpose: "Test commission", allowAmountEdit: false },
      jar: superadminJar,
    });
    assert(resPayment.status === 201, `Expected 201, got ${resPayment.status}`);
    const payment = resPayment.json?.payment;
    const expectedCommission = 0.15 + 2;
    const expectedFinal = 10 + expectedCommission;
    assert(
      Math.abs(Number(payment.commissionPercent) - 0.15) < 0.01,
      "Commission percent mismatch"
    );
    assert(
      Math.abs(Number(payment.commissionFixed) - 2) < 0.01,
      "Commission fixed mismatch"
    );
    assert(
      Math.abs(Number(payment.finalAmount) - expectedFinal) < 0.01,
      "Final amount mismatch"
    );
    setResult("6.3.12", "PASS");
    setResult("6.5.22", "PASS");
  } catch (err) {
    setResult("6.3.12", "FAIL", formatError(err));
    setResult("6.5.22", "FAIL", formatError(err));
  }

  // 6.3.13 Daily limit
  try {
    const resList = await requestJson({
      method: "GET",
      path: `/api/admin/companies?search=${encodeURIComponent(testCompany.name)}`,
      jar: superadminJar,
    });
    const listed = (resList.json?.items || []).find(
      (item) => Number(item.id) === Number(testCompany.id)
    );
    const used = Number(listed?.daily_limit_used || 0);
    const nextLimit = used + 1;
    await requestJson({
      method: "PATCH",
      path: `/api/admin/companies/${testCompany.id}`,
      body: { daily_limit: nextLimit, use_daily_limit: true },
      jar: superadminJar,
    });
    const resA = await requestJson({
      method: "POST",
      path: `/api/admin/companies/${testCompany.id}/payment/generate`,
      body: { amount: 1, purpose: "Limit test A" },
      jar: superadminJar,
    });
    const resB = await requestJson({
      method: "POST",
      path: `/api/admin/companies/${testCompany.id}/payment/generate`,
      body: { amount: 1, purpose: "Limit test B" },
      jar: superadminJar,
    });
    assert(resA.status === 201, `Expected 201, got ${resA.status}`);
    assert(resB.status === 400, `Expected 400, got ${resB.status}`);
    setResult("6.3.13", "PASS");
  } catch (err) {
    setResult("6.3.13", "FAIL", formatError(err));
  } finally {
    await requestJson({
      method: "PATCH",
      path: `/api/admin/companies/${testCompany.id}`,
      body: { daily_limit: 5, use_daily_limit: true },
      jar: superadminJar,
    }).catch(() => {});
  }

  // 6.4 Users: create
  const userPassword = `TestPass!${Math.floor(Math.random() * 10000)}`;
  const viewerEmail = `test.viewer.${suffix}@infokod.com.ua`;
  const managerEmail = `test.manager.${suffix}@infokod.com.ua`;
  const adminEmail = `test.admin.${suffix}@infokod.com.ua`;

  const createAdminUser = async (payload) => {
    const res = await requestJson({
      method: "POST",
      path: "/api/admin/admin-users",
      body: payload,
      jar: superadminJar,
    });
    return res;
  };

  let viewerUser = null;
  let managerUser = null;
  let adminUser = null;

  try {
    const resViewer = await createAdminUser({
      name: "Test Viewer",
      email: viewerEmail,
      password: userPassword,
      role: "viewer",
      company_id: testCompany.id,
    });
    const resManager = await createAdminUser({
      name: "Test Manager",
      email: managerEmail,
      password: userPassword,
      role: "manager",
      company_id: testCompany.id,
    });
    const resAdmin = await createAdminUser({
      name: "Test Admin",
      email: adminEmail,
      password: userPassword,
      role: "admin",
      company_id: testCompany.id,
    });
    assert(resViewer.status === 201, `Viewer create ${resViewer.status}`);
    assert(resManager.status === 201, `Manager create ${resManager.status}`);
    assert(resAdmin.status === 201, `Admin create ${resAdmin.status}`);
    viewerUser = resViewer.json;
    managerUser = resManager.json;
    adminUser = resAdmin.json;
    created.users.push(viewerUser.id, managerUser.id, adminUser.id);
    setResult("6.4.16", "PASS");
  } catch (err) {
    setResult("6.4.16", "FAIL", formatError(err));
  }

  // 6.4.17 Unique email
  try {
    const resDup = await createAdminUser({
      name: "Dup User",
      email: viewerEmail,
      password: userPassword,
      role: "viewer",
      company_id: testCompany.id,
    });
    assert(resDup.status === 409, `Expected 409, got ${resDup.status}`);
    setResult("6.4.17", "PASS");
    setResult("8.1.55", "PASS");
  } catch (err) {
    setResult("6.4.17", "FAIL", formatError(err));
    setResult("8.1.55", "FAIL", formatError(err));
  }

  // 6.2.7 & 6.2.8: forbidden access for viewer
  if (viewerUser) {
    try {
      const viewerJar = {};
      await requestJson({
        method: "POST",
        path: "/api/admin/auth/login",
        body: { email: viewerEmail, password: userPassword },
        jar: viewerJar,
      });
      const resForbidden = await requestJson({
        method: "GET",
        path: "/api/admin/admin-users",
        jar: viewerJar,
      });
      assert(resForbidden.status === 403, `Expected 403, got ${resForbidden.status}`);
      const resCreate = await requestJson({
        method: "POST",
        path: "/api/admin/companies",
        body: {
          ...companyPayload,
          name: `Blocked Company ${suffix}`,
          edrpo: testCompany.edrpo,
        },
        jar: viewerJar,
      });
      assert(resCreate.status === 403, `Expected 403, got ${resCreate.status}`);
      setResult("6.2.7", "PASS");
      setResult("6.2.8", "PASS");
    } catch (err) {
      setResult("6.2.7", "FAIL", formatError(err));
      setResult("6.2.8", "FAIL", formatError(err));
    }
  }

  // 6.2.9 Permission edit
  try {
    if (!viewerUser) throw new Error("No viewer user");
    await requestJson({
      method: "PATCH",
      path: `/api/admin/admin-users/${viewerUser.id}`,
      body: { permissions: { company_create: true } },
      jar: superadminJar,
    });
    const viewerJar = {};
    await requestJson({
      method: "POST",
      path: "/api/admin/auth/login",
      body: { email: viewerEmail, password: userPassword },
      jar: viewerJar,
    });
    const resCreate = await requestJson({
      method: "POST",
      path: "/api/admin/companies",
      body: {
        ...companyPayload,
        name: `Perm Company ${suffix}`,
        edrpo: testCompany.edrpo,
        iban: generateValidUaIban(),
      },
      jar: viewerJar,
    });
    assert(resCreate.status === 201, `Expected 201, got ${resCreate.status}`);
    const createdCompanyId = resCreate.json?.company?.id;
    if (createdCompanyId) {
      created.companies.push(createdCompanyId);
    }
    setResult("6.2.9", "PASS");
  } catch (err) {
    setResult("6.2.9", "FAIL", formatError(err));
  }

  // 6.4.18 Change role
  try {
    if (!managerUser) throw new Error("No manager user");
    await requestJson({
      method: "PATCH",
      path: `/api/admin/admin-users/${managerUser.id}`,
      body: { role: "admin" },
      jar: superadminJar,
    });
    const jar = {};
    await requestJson({
      method: "POST",
      path: "/api/admin/auth/login",
      body: { email: managerEmail, password: userPassword },
      jar,
    });
    const resMe = await requestJson({
      method: "GET",
      path: "/api/admin/auth/me",
      jar,
    });
    assert(resMe.json?.role === "admin", "Role not updated");
    setResult("6.4.18", "PASS");
  } catch (err) {
    setResult("6.4.18", "FAIL", formatError(err));
  }

  // 6.4.19 Deactivate user
  try {
    if (!adminUser) throw new Error("No admin user");
    await requestJson({
      method: "PATCH",
      path: `/api/admin/admin-users/${adminUser.id}`,
      body: { is_active: false },
      jar: superadminJar,
    });
    const jar = {};
    const resLogin = await requestJson({
      method: "POST",
      path: "/api/admin/auth/login",
      body: { email: adminEmail, password: userPassword },
      jar,
    });
    assert(resLogin.status === 401, `Expected 401, got ${resLogin.status}`);
    setResult("6.4.19", "PASS");
    await requestJson({
      method: "PATCH",
      path: `/api/admin/admin-users/${adminUser.id}`,
      body: { is_active: true },
      jar: superadminJar,
    });
  } catch (err) {
    setResult("6.4.19", "FAIL", formatError(err));
  }

  // 6.4.20 Reset password
  try {
    if (!adminUser) throw new Error("No admin user");
    const newPassword = `ResetPass!${Math.floor(Math.random() * 10000)}`;
    await requestJson({
      method: "POST",
      path: `/api/admin/admin-users/${adminUser.id}/reset-password`,
      body: { password: newPassword },
      jar: superadminJar,
    });
    const jar = {};
    const resLogin = await requestJson({
      method: "POST",
      path: "/api/admin/auth/login",
      body: { email: adminEmail, password: newPassword },
      jar,
    });
    assert(resLogin.status === 200, `Expected 200, got ${resLogin.status}`);
    setResult("6.4.20", "PASS");
  } catch (err) {
    setResult("6.4.20", "FAIL", formatError(err));
  }

  // 6.5.21/25 Payment generation and repeat
  let paymentLinkId = null;
  try {
    const res1 = await requestJson({
      method: "POST",
      path: `/api/admin/companies/${testCompany.id}/payment/generate`,
      body: { amount: 12, purpose: "Test payment 1", allowAmountEdit: true },
      jar: superadminJar,
    });
    const res2 = await requestJson({
      method: "POST",
      path: `/api/admin/companies/${testCompany.id}/payment/generate`,
      body: { amount: 12, purpose: "Test payment 2", allowAmountEdit: true },
      jar: superadminJar,
    });
    assert(res1.status === 201, `Expected 201, got ${res1.status}`);
    assert(res2.status === 201, `Expected 201, got ${res2.status}`);
    const id1 = res1.json?.payment?.linkUuid || res1.json?.payment?.qr_link;
    const id2 = res2.json?.payment?.linkUuid || res2.json?.payment?.qr_link;
    assert(id1 && id2, "Missing link ids");
    assert(id1 !== id2, "Duplicate link ids");
    paymentLinkId = id1;
    setResult("6.5.21", "PASS");
    setResult("6.5.25", "PASS");
  } catch (err) {
    setResult("6.5.21", "FAIL", formatError(err));
    setResult("6.5.25", "FAIL", formatError(err));
  }

  // 6.5.24 invalid payment payload
  try {
    const res = await requestJson({
      method: "POST",
      path: `/api/admin/companies/${testCompany.id}/payment/generate`,
      body: { amount: 10, purpose: "" },
      jar: superadminJar,
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    setResult("6.5.24", "PASS");
  } catch (err) {
    setResult("6.5.24", "FAIL", formatError(err));
  }

  // 7.1 public page checks
  try {
    if (!paymentLinkId) throw new Error("No payment link id");
    const res = await requestJson({
      method: "GET",
      path: `/payment/${paymentLinkId}`,
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const html = res.body || "";
    assert(html.includes(testCompany.name), "Company name missing in page");
    assert(html.includes(testCompany.iban), "IBAN missing in page");
    setResult("7.1.40", "PASS");
    setResult("7.1.41", "PASS");
    setResult("7.1.42", "PASS");
    setResult("7.1.43", "PASS");
  } catch (err) {
    setResult("7.1.40", "FAIL", formatError(err));
    setResult("7.1.41", "FAIL", formatError(err));
    setResult("7.1.42", "FAIL", formatError(err));
    setResult("7.1.43", "FAIL", formatError(err));
  }

  // 6.6 Reports export + 6.6.28 permission
  try {
    const res = await requestJson({
      method: "GET",
      path: "/api/admin/export/companies.csv",
      jar: superadminJar,
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body && res.body.length > 10, "Empty report body");
    setResult("6.6.26", "PASS");
    setResult("6.6.29", "PASS");
  } catch (err) {
    setResult("6.6.26", "FAIL", formatError(err));
    setResult("6.6.29", "FAIL", formatError(err));
  }

  if (viewerUser) {
    try {
      const viewerJar = {};
      await requestJson({
        method: "POST",
        path: "/api/admin/auth/login",
        body: { email: viewerEmail, password: userPassword },
        jar: viewerJar,
      });
      const res = await requestJson({
        method: "GET",
        path: "/api/admin/export/companies.csv",
        jar: viewerJar,
      });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
      setResult("6.6.28", "PASS");
    } catch (err) {
      setResult("6.6.28", "FAIL", formatError(err));
    }
  }

  // 6.7 Analytics basic
  try {
    const res = await requestJson({
      method: "GET",
      path: "/api/admin/metrics",
      jar: superadminJar,
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Number.isFinite(Number(res.json?.payments_count)), "payments_count NaN");
    setResult("6.7.30", "PASS");
  } catch (err) {
    setResult("6.7.30", "FAIL", formatError(err));
  }

  // 8.1.52 invalid input -> 400
  try {
    const res = await requestJson({
      method: "POST",
      path: "/api/admin/companies",
      body: {},
      jar: superadminJar,
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    setResult("8.1.52", "PASS");
  } catch (err) {
    setResult("8.1.52", "FAIL", formatError(err));
  }

  // 8.1.53 unauth -> 401
  try {
    const res = await requestJson({
      method: "GET",
      path: "/api/admin/companies",
      jar: {},
    });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
    setResult("8.1.53", "PASS");
  } catch (err) {
    setResult("8.1.53", "FAIL", formatError(err));
  }

  // 8.1.54 not found
  try {
    const res = await requestJson({
      method: "GET",
      path: "/api/admin/companies/99999999",
      jar: superadminJar,
    });
    assert(res.status === 404, `Expected 404, got ${res.status}`);
    setResult("8.1.54", "PASS");
  } catch (err) {
    setResult("8.1.54", "FAIL", formatError(err));
  }

  // 6.3.15 delete test company (cleanup)
  try {
    const res = await requestJson({
      method: "DELETE",
      path: `/api/admin/companies/${testCompany.id}`,
      jar: superadminJar,
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    setResult("6.3.15", "PASS");
    created.companies = created.companies.filter((id) => id !== testCompany.id);
  } catch (err) {
    setResult("6.3.15", "FAIL", formatError(err));
  }

  // Cleanup users
  for (const userId of created.users) {
    await requestJson({
      method: "DELETE",
      path: `/api/admin/admin-users/${userId}`,
      jar: superadminJar,
    }).catch(() => {});
  }
  // Cleanup companies
  for (const companyId of created.companies) {
    await requestJson({
      method: "DELETE",
      path: `/api/admin/companies/${companyId}`,
      jar: superadminJar,
    }).catch(() => {});
  }

  finalize(results, notes);
}

function finalize(results, notes) {
  const checklist = fs.existsSync(CHECKLIST_PATH)
    ? fs.readFileSync(CHECKLIST_PATH, "utf8")
    : "";

  const lines = checklist.split("\n");
  const output = [];
  const summary = { PASS: 0, FAIL: 0, MANUAL: 0, BLOCKED: 0 };

  const formatLine = (id, text) => {
    const status = results[id] || "MANUAL";
    summary[status] = (summary[status] || 0) + 1;
    const note = notes[id] ? ` — ${notes[id]}` : "";
    return `- [${status}] **${id}** ${text}${note}`;
  };

  for (const line of lines) {
    const match = line.match(/^\s*-\s*\[\s*\]\s*\*\*(\d+\.\d+\.\d+)\*\*\s*(.*)$/);
    if (match) {
      output.push(formatLine(match[1], match[2]));
    } else if (/^##\s|\s*#\s/.test(line) || /^\s*$/.test(line)) {
      output.push(line);
    } else {
      output.push(line);
    }
  }

  output.unshift(
    `Summary: PASS ${summary.PASS || 0}, FAIL ${summary.FAIL || 0}, MANUAL ${summary.MANUAL || 0}.`
  );
  output.unshift(`Base URL: ${BASE_URL}`);
  output.unshift(`Date: ${new Date().toISOString()}`);
  output.unshift("");
  output.unshift(`# Test Report`);

  fs.writeFileSync(REPORT_PATH, output.join("\n"));
  console.log(`Report saved to ${REPORT_PATH}`);
}

run().catch((err) => {
  console.error("Checklist runner failed:", formatError(err));
  process.exit(1);
});
