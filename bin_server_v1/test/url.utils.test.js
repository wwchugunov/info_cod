const test = require("node:test");
const assert = require("node:assert/strict");

test("getBaseUrl uses BASE_URL when provided", async () => {
  const original = process.env.BASE_URL;
  process.env.BASE_URL = "https://example.com/";
  const { getBaseUrl, buildPaymentLink } = require("../src/service/url.utils");
  assert.equal(getBaseUrl(), "https://example.com");
  assert.equal(buildPaymentLink("abc"), "https://example.com/api/payment/payment/abc");
  process.env.BASE_URL = original;
});

test("getBaseUrl builds from DOMEN and PORT", async () => {
  const originalBase = process.env.BASE_URL;
  const originalDomain = process.env.DOMEN;
  const originalPort = process.env.PORT;
  delete process.env.BASE_URL;
  process.env.DOMEN = "test.local";
  process.env.PORT = "8080";
  delete require.cache[require.resolve("../src/service/url.utils")];
  const { getBaseUrl } = require("../src/service/url.utils");
  assert.equal(getBaseUrl(), "http://test.local:8080");
  process.env.BASE_URL = originalBase;
  process.env.DOMEN = originalDomain;
  process.env.PORT = originalPort;
});
