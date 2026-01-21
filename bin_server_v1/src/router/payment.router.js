const express = require('express');
const router = express.Router();
const paymentController = require('../controller/payment.controller');
const authToken = require('../middleware/authToken.middleware');

router.post('/generate', authToken, paymentController.generatePayment);

router.get('/payment', (req, res) => {
  res.render('no-payment');
});

router.get('/payment/:linkId', paymentController.getPaymentByLink);

module.exports = router;
