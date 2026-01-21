function calculateCommission(company, amount) {
  const usePercent = Boolean(company.use_percent_commission);
  const useFixed = Boolean(company.use_fixed_commission);
  const commissionPercent = usePercent
    ? Number((Number(company.commission_percent) / 100) * amount)
    : 0;
  const commissionFixed = useFixed ? Number(company.commission_fixed) : 0;
  return {
    commissionPercent,
    commissionFixed,
    finalAmount: amount + commissionPercent + commissionFixed,
  };
}

function getDayRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { start, end };
}

module.exports = { calculateCommission, getDayRange };
