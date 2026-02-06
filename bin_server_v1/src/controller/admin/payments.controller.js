const { Op } = require("sequelize");
const Company = require("../../model/company.model");
const Payment = require("../../model/generatelink");
const paymentService = require("../../service/payment.service");
const { logGenerationHistory } = require("../../service/generationHistory.service");
const { createEditablePaymentLink } = require("../../modules/editablePaymentLinks/service");
const {
  parsePagination,
  buildDateRange,
  getAdminCompanyId,
  getCompanyScope,
  canAccessCompany,
} = require("./helpers");

async function listPayments(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const where = buildDateRange(req.query, "created_at");

  const adminCompanyId = getAdminCompanyId(req);
  const companyId = Number(req.query.company_id);
  const companyIds = await getCompanyScope(
    adminCompanyId,
    Number.isFinite(companyId) ? companyId : null
  );
  if (companyIds && companyIds.length) {
    where.company_id = companyIds;
  } else if (adminCompanyId) {
    where.company_id = adminCompanyId;
  } else if (Number.isFinite(companyId)) {
    where.company_id = companyId;
  }
  if (req.query.status) {
    where.status = req.query.status;
  } else {
    where[Op.or] = [
      { status: { [Op.in]: ["pending", "delivered"] } },
      { status: { [Op.is]: null } },
    ];
  }
  if (req.query.status) {
    where.status = req.query.status;
  }

  const includeCompany =
    req.admin && req.admin.role !== "viewer"
      ? [{ model: Company, attributes: ["id", "name", "edrpo", "iban"] }]
      : [];

  const result = await Payment.findAndCountAll({
    where,
    limit,
    offset,
    order: [["created_at", "DESC"]],
    include: includeCompany,
    distinct: true,
  });

  return res.json({
    page,
    limit,
    total: result.count,
    items: result.rows,
  });
}

async function generateCompanyPayment(req, res) {
  const companyId = Number(req.params.id);
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return res.status(400).json({ message: "Некоректний ID компанії" });
  }
  const adminCompanyId = getAdminCompanyId(req);
  if (adminCompanyId && !(await canAccessCompany(adminCompanyId, companyId))) {
    return res.status(403).json({ message: "Недостатньо прав" });
  }
  const company = await Company.findByPk(companyId);
  if (!company) {
    return res.status(404).json({ message: "Компанія не знайдена" });
  }
  const { amount, purpose } = req.body || {};
  const normalizedPurpose =
    typeof purpose === "string" ? purpose.trim() : purpose || null;
  const requestedAllowAmountEdit = Boolean(req.body?.allowAmountEdit);
  try {
    const paymentInfo = await paymentService.createPayment(
      company,
      Number(amount),
      normalizedPurpose,
      company.iban,
      req.ip,
      req.headers["user-agent"],
      null
    );
    let allowAmountEdit = false;
    let warning = null;
    if (requestedAllowAmountEdit) {
      try {
        const paymentLinkId = paymentInfo.linkUuid || paymentInfo.qr_link || null;
        await createEditablePaymentLink({
          company,
          amount: paymentInfo.originalAmount,
          purpose: normalizedPurpose,
          allowAmountEdit: true,
          linkId: paymentLinkId,
          expiresAt: paymentInfo.expiresAt,
        });
        allowAmountEdit = true;
      } catch (error) {
        allowAmountEdit = false;
        console.error("Failed to enable editable link:", error?.message || error);
        warning =
          "Редагування суми недоступне: перевірте, що застосована міграція MAIN DB `20260205_create_editable_payment_links.js` (npm run migrate:main) і сервер перезапущений.";
      }
    }
    return res.status(201).json({
      message: "Successfully",
      payment: paymentInfo,
      options: {
        static: !allowAmountEdit,
      },
      allowAmountEdit,
      ...(warning ? { warning } : {}),
    });
  } catch (err) {
    await logGenerationHistory({
      company,
      tokenHash: null,
      status: "failed",
      amount: Number.isFinite(Number(amount)) ? Number(amount) : null,
      purpose: normalizedPurpose,
      clientIp: req.ip,
      userAgent: req.headers["user-agent"] || null,
      errorCode: err?.code || "GENERATE_FAILED",
      errorMessage: err?.message || "Невідома помилка",
    }).catch(() => {});
    return res.status(400).json({ message: err.message });
  }
}

module.exports = {
  listPayments,
  generateCompanyPayment,
};
