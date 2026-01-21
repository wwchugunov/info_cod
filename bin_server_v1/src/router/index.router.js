const express = require('express');
const router = express.Router();

const generate = require('./payment.router');
const adminRouter = require('./admin.router');

router.use('/payment', generate);
router.use('/admin', adminRouter);

module.exports = router;
