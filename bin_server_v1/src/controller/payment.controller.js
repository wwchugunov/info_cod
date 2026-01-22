const paymentService = require("../service/payment.service");
const Payment = require("../model/generatelink");
const Company = require("../model/company.model");

const paymentController = {};

paymentController.generatePayment = async (req, res) => {
  try {
    const { amount, purpose } = req.body;
    const company = req.company;

    if (!amount || !purpose) {
      return res
        .status(400)
        .json({ message: "Не указаны сумма или назначение платежа" });
    }

    const paymentInfo = await paymentService.createPayment(
      company,
      Number(amount),
      purpose
    );

    res.status(201).json({
      message: "Successfully",
      payment: paymentInfo,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};



paymentController.getPaymentByLink = async (req, res) => {
  try {
    const { linkId } = req.params;

    const payment = await Payment.findOne({
      where: { link_id: linkId },
      include: [{ model: Company }],
    });

    // Если платежа нет или ссылка истекла
    if (!payment || payment.expires_at < new Date()) {
      return res.render("no-payment"); // Рендерим шаблон ошибки
    }

    // Увеличиваем счетчик переходов
    await payment.increment("views_count");

    const paymentInfo = await paymentService.createPayment(
      payment.Company,
      Number(payment.amount),
      payment.purpose,
      payment.Company.iban
    );

    const paymentCode = paymentInfo.qrlink;
    const paymentUrl = `https://bank.gov.ua/qr/${paymentCode}`;

    res.render("payment", {
      linkId: payment.link_id,
      purpose: payment.purpose,
      originalAmount: Number(payment.amount),
      commissionPercent: Number(payment.commission_percent),
      commissionFixed: Number(payment.commission_fixed),
      finalAmount:
        Number(payment.amount) +
        Number(payment.commission_percent) +
        Number(payment.commission_fixed),
      qrlink: paymentInfo.qrlink,
      nbu_link: paymentInfo.qr_link,
      paymentUrl,
      paymentCode,
      company: {
        name: payment.Company.name,
        logo_url: payment.Company.logo_url || null,
        offer_url: payment.Company.offer_url || null,
        edrpo: payment.Company.edrpo,
        iban: payment.Company.iban,
      },
    });

  } catch (err) {
    console.error(err);
    // Если ошибка сервера, показываем тоже страницу ошибки
    res.status(500).render("no-payment");
  }
};


module.exports = paymentController;
