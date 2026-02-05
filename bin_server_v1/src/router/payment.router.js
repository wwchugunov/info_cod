const express = require('express');
const router = express.Router();
const paymentController = require('../controller/payment.controller');
const authToken = require('../middleware/authToken.middleware');

router.post('/generate', authToken, paymentController.generatePayment);




router.all('/generate', (req, res) => {
  return res.status(405).json({
    message: "Неправильный тип запроса",
    allowed: ["POST"],
  });
});

router.get('/payment', (req, res) => {
  res.render('no-payment');
});

router.get('/payment/:linkId', paymentController.getPaymentByLink);
router.post('/payment/:linkId/scan', paymentController.logScan);
router.post('/payment/:linkId/bank', paymentController.logBank);

module.exports = router;
