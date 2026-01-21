const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateCommission } = require("../src/service/payment.utils");

test("calculateCommission uses percent and fixed commissions", () => {
  const company = {
    use_percent_commission: true,
    use_fixed_commission: true,
    commission_percent: 10,
    commission_fixed: 5,
  };
  const result = calculateCommission(company, 200);
  assert.equal(result.commissionPercent, 20);
  assert.equal(result.commissionFixed, 5);
  assert.equal(result.finalAmount, 225);
});

test("calculateCommission respects disabled commission flags", () => {
  const company = {
    use_percent_commission: false,
    use_fixed_commission: false,
    commission_percent: 10,
    commission_fixed: 5,
  };
  const result = calculateCommission(company, 200);
  assert.equal(result.commissionPercent, 0);
  assert.equal(result.commissionFixed, 0);
  assert.equal(result.finalAmount, 200);
});
