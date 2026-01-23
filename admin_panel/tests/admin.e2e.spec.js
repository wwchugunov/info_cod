import { test, expect } from "@playwright/test";

const apiBase = process.env.E2E_API_BASE || "http://localhost:5050/api";
const email = process.env.E2E_EMAIL || "";
const password = process.env.E2E_PASSWORD || "";

async function apiRequest(request, path, options = {}) {
  const { cookieHeader, ...fetchOptions } = options;
  const res = await request.fetch(`${apiBase}${path}`, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(fetchOptions.headers || {}),
    },
  });
  const contentType = res.headers()["content-type"] || "";
  const body = contentType.includes("application/json")
    ? await res.json()
    : await res.text();
  return { res, body };
}

test.describe.serial("Admin UI", () => {
  let cookieHeader = "";
  let authCookies = [];
  let apiCompanyId = "";

  test.beforeAll(async ({ request }) => {
    if (!email || !password) {
      throw new Error("E2E_EMAIL and E2E_PASSWORD are required.");
    }
    const login = await apiRequest(request, "/admin/auth/login", {
      method: "POST",
      data: { email, password },
    });
    const setCookies = login.res.headersArray
      ? login.res.headersArray().filter((h) => h.name === "set-cookie").map((h) => h.value)
      : [];
    authCookies = setCookies
      .map((header) => header.split(";")[0])
      .map((pair) => {
        const [name, ...rest] = pair.split("=");
        return { name, value: rest.join("=") };
      })
      .filter((item) => item.name);
    cookieHeader = authCookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const companyPayload = {
      name: `E2E Company ${Date.now()}`,
      contact_name: "E2E Contact",
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
    const company = await apiRequest(request, "/admin/companies", {
      method: "POST",
      cookieHeader,
      data: companyPayload,
    });
    apiCompanyId = String(company.body?.company?.id || "");
  });

  test.afterAll(async ({ request }) => {
    if (apiCompanyId) {
      await apiRequest(request, `/admin/companies/${apiCompanyId}`, {
        method: "DELETE",
        cookieHeader,
      });
    }
  });

  test.beforeEach(async ({ page }, testInfo) => {
    if (testInfo.title === "login screen works") {
      await page.context().clearCookies();
      return;
    }
    if (authCookies.length) {
      await page.context().addCookies(
        authCookies.map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
          url: "http://localhost",
          path: "/api/admin",
        }))
      );
    }
  });

  test("login screen works", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/admin/login");
    await page.getByPlaceholder("Е-пошта").fill(email);
    await page.getByPlaceholder("Пароль").fill(password);
    await page.getByRole("button", { name: "Увійти" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("navigate core pages", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await expect(page.getByRole("heading", { name: "Огляд" })).toBeVisible();

    const links = [
      "Компанії",
      "Генерації",
      "Історія",
      "Сканування",
      "Звіти",
      "API",
      "Користувачі",
      "Помилки",
      "Навантаження",
      "Налаштування",
    ];
    for (const name of links) {
      await page.getByRole("link", { name }).click();
      await expect(page.locator(".topbar h1")).toBeVisible();
    }
  });

  test("dashboard filters", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await page.getByRole("combobox").selectOption("week");
    await page.getByRole("button", { name: "Застосувати" }).click();
    await expect(page.locator(".card-grid .card").first()).toBeVisible();
  });

  test("companies CRUD via UI", async ({ page }) => {
    const companyName = `UI Company ${Date.now()}`;

    await page.goto("/admin/companies");
    await page.getByRole("button", { name: "Зареєструвати" }).click();

    const modal = page.locator(".modal");
    await modal.getByLabel("Назва").fill(companyName);
    await modal.getByLabel("Контактна особа").fill("UI Contact");
    await modal.getByLabel("Телефон").fill("+380111111111");
    await modal.getByLabel("IBAN").fill("UA90305299000002600748573760");
    await modal.getByLabel("ЄДРПОУ").fill("12345678");
    await modal.getByRole("button", { name: "Зареєструвати" }).click();

    await expect(page.getByRole("heading", { name: "Компанію зареєстровано" })).toBeVisible();
    await page.getByRole("button", { name: "Готово" }).click();

    await page.getByPlaceholder("ID, назва або ЄДРПОУ").fill(companyName);
    await page.getByRole("button", { name: "Знайти" }).click();

    const row = page.getByRole("row", { name: new RegExp(companyName) });
    await expect(row).toBeVisible();
    await row.locator(".menu-trigger").click();
    await row.getByRole("button", { name: "Редагувати" }).click();
    const editModal = page.locator(".modal");
    await editModal.getByLabel("Назва").fill(`${companyName} Updated`);
    await editModal.getByRole("button", { name: "Зберегти" }).click();

    page.on("dialog", async (dialog) => {
      await dialog.accept("5");
    });
    await row.locator(".menu-trigger").click();
    await row.getByRole("button", { name: "Змінити ліміт" }).click();

    await row.locator(".menu-trigger").click();
    await row.getByRole("button", { name: /Вимкнути ліміт|Увімкнути ліміт/ }).click();

    await row.locator(".menu-trigger").click();
    await row.getByRole("button", { name: "Налаштувати" }).click();
    await page.getByRole("button", { name: "Скасувати" }).click();

    await row.locator(".menu-trigger").click();
    await row.getByRole("button", { name: "Видалити" }).click();
    await page.locator(".dialog").getByRole("button", { name: "Видалити" }).click();
  });

  test("admin users CRUD via UI", async ({ page }) => {
    const adminEmail = `ui_admin_${Date.now()}@example.com`;
    await page.goto("/admin/users");
    await page.getByPlaceholder("Ім'я").fill("UI Admin");
    await page.getByPlaceholder("Е-пошта").fill(adminEmail);
    await page.getByPlaceholder("Пароль").fill("Pass123!");
    await page.getByRole("button", { name: "Створити" }).click();

    const row = page.getByRole("row", { name: new RegExp(adminEmail) });
    await row.getByRole("button", { name: "Редагувати" }).click();
    await page.getByLabel("Ім'я").fill("UI Admin Updated");
    await page.getByRole("button", { name: "Зберегти" }).click();

    await row.getByRole("button", { name: /Вимкнути|Увімкнути/ }).click();

    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });
    await row.getByRole("button", { name: "Видалити" }).click();
  });

  test("api docs token rotation", async ({ page }) => {
    await page.goto("/admin/api");
    await page.getByPlaceholder("ID компанії").fill(apiCompanyId);
    await page.getByRole("button", { name: "Згенерувати токен" }).click();
    await expect(page.getByText("Новий токен згенеровано")).toBeVisible();
  });

  test("reports downloads", async ({ page }) => {
    await page.goto("/admin/reports");
    await page.getByRole("button", { name: "Застосувати" }).click();

    const downloadButtons = page.getByRole("button", { name: "Завантажити CSV" });
    const count = await downloadButtons.count();
    for (let i = 0; i < count; i += 1) {
      await Promise.all([
        page.waitForEvent("download"),
        downloadButtons.nth(i).click(),
      ]);
    }

    await page.getByRole("button", { name: "XLSX" }).click();
    await page.getByRole("button", { name: "PDF з графіком" }).click();
  });

  test("history, scans, errors, load", async ({ page }) => {
    await page.goto("/admin/history");
    await page.getByRole("button", { name: "Застосувати" }).click();
    await page.getByRole("button", { name: "Далі" }).click();

    await page.goto("/admin/scans");
    await page.getByRole("button", { name: "Застосувати" }).click();

    await page.goto("/admin/errors");
    await page.getByRole("button", { name: "Застосувати" }).click();

    await page.goto("/admin/load");
    await expect(page.getByRole("heading", { name: "Навантаження" })).toBeVisible();
  });

  test("logout", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Вийти" }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
