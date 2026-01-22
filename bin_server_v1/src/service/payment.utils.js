function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function calculateCommission(company, amount) {
  const usePercent = Boolean(company.use_percent_commission);
  const useFixed = Boolean(company.use_fixed_commission);
  const commissionPercentRaw = usePercent
    ? Number((Number(company.commission_percent) / 100) * amount)
    : 0;
  const commissionFixedRaw = useFixed ? Number(company.commission_fixed) : 0;
  const commissionPercent = round2(commissionPercentRaw);
  const commissionFixed = round2(commissionFixedRaw);
  return {
    commissionPercent,
    commissionFixed,
    finalAmount: round2(amount + commissionPercent + commissionFixed),
  };
}

function getDayRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { start, end };
}

module.exports = { calculateCommission, getDayRange };
