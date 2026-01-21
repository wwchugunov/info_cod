const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isValidIban,
  isValidEdrpo,
  normalizeText,
} = require("../src/service/validation.utils");

test("isValidIban validates UA IBANs", () => {
  assert.equal(isValidIban("UA1234567890123456789012345"), true);
  assert.equal(isValidIban("UA123"), false);
  assert.equal(isValidIban(""), false);
});

test("isValidEdrpo validates 8 or 10 digits", () => {
  assert.equal(isValidEdrpo("12345678"), true);
  assert.equal(isValidEdrpo("1234567890"), true);
  assert.equal(isValidEdrpo("1234"), false);
});

test("normalizeText trims strings", () => {
  assert.equal(normalizeText("  test "), "test");
  assert.equal(normalizeText(null), "");
});
