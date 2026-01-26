const companyService = require('../service/company.service');
const { canExposeSensitive } = require("../utils/sensitiveExposure");

const userController = {};

userController.registerCompany = async (req, res) => {
  try {
    const {
      company,
      apiTokenPlain,
      isSubCompany,
      parentCompanyId,
    } = await companyService.registerCompany(req.body);

    const expose = canExposeSensitive();
    res.status(201).json({
      message: 'Компания успешно зарегистрирована',
      company: {
        id: company.id,
        name: company.name,
        contact_name: company.contact_name,
        contact_phone: company.contact_phone,
        api_token: expose ? apiTokenPlain : null,
        ip_whitelist: company.ip_whitelist || [],
        daily_limit: company.daily_limit,
        commission_percent: Number(company.commission_percent || 0),
        commission_fixed: Number(company.commission_fixed || 0),
        use_percent_commission: company.use_percent_commission ?? false,
        use_fixed_commission: company.use_fixed_commission ?? false,
        is_active: company.is_active ?? true,
        iban: company.iban,
        edrpo: company.edrpo,
        logo_url: company.logo_url || null,
        offer_url: company.offer_url || null,
        registration_date: company.registration_date,
        internal_id: company.internal_id,
        turnover: Number(company.turnover || 0),
        is_sub_company: isSubCompany,
        parent_company_id: parentCompanyId
      }
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

module.exports = userController;
