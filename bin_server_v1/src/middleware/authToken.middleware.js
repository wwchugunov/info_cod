const { Op } = require("sequelize");
const Company = require('../model/company.model');
const bcrypt = require('bcrypt');
const crypto = require("crypto");
const { logGenerationHistory } = require("../service/generationHistory.service");

async function authToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    // 1. Відсутній заголовок Authorization
    if (!authHeader) {
      return res.status(401).json({
        error: 'AUTH_HEADER_MISSING',
        message: 'Відсутній заголовок Authorization',
      });
    }

    // 2. Перевірка формату Bearer
    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      return res.status(401).json({
        error: 'INVALID_AUTH_FORMAT',
        message: 'Невірний формат авторизації. Очікується: Authorization: Bearer <token>',
      });
    }

    // 3. Пошук компанії за токеном
    const tokenValue = String(token || '').trim();
    if (/^\$2[aby]\$/.test(tokenValue)) {
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Токен недійсний або компанію не знайдено',
      });
    }
    const tokenHash = crypto.createHash("sha256").update(tokenValue).digest("hex");
    let company = null;

    const tokenPrefix = tokenValue.slice(0, 8);
    let candidates = await Company.findAll({
      where: { api_token_prefix: tokenPrefix },
      attributes: ['id', 'name', 'api_token', 'is_active', 'api_token_prefix'],
    });
    if (!candidates.length) {
      candidates = await Company.findAll({
        where: { api_token_prefix: { [Op.or]: [null, ""] } },
        attributes: ['id', 'name', 'api_token', 'is_active', 'api_token_prefix'],
      });
    }
    for (const candidate of candidates) {
      if (await bcrypt.compare(tokenValue, candidate.api_token)) {
        company = candidate;
        break;
      }
    }
    if (!company) {
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Токен недійсний або компанію не знайдено',
      });
    }

    if (company.is_active === false) {
      await logGenerationHistory({
        company,
        tokenHash,
        status: "failed",
        amount: Number.isFinite(Number(req.body?.amount))
          ? Number(req.body.amount)
          : null,
        purpose: typeof req.body?.purpose === "string" ? req.body.purpose.trim() : null,
        clientIp: req.ip,
        userAgent: req.headers["user-agent"],
        errorCode: "COMPANY_DISABLED",
        errorMessage: "Компанія вимкнена",
      });
      return res.status(403).json({
        error: 'COMPANY_DISABLED',
        message: 'Компанія вимкнена',
      });
    }

    // 5. Передаємо компанію далі
    if (company && !company.api_token_prefix && !/^\$2[aby]\$/.test(tokenValue)) {
      await Company.update(
        { api_token_prefix: tokenValue.slice(0, 8) },
        { where: { id: company.id } }
      );
    }
    req.company = await Company.findByPk(company.id);
    req.tokenHash = tokenHash;

    next();
  } catch (err) {
    console.error('AUTH TOKEN ERROR:', {
      url: req.originalUrl,
      ip: req.ip,
      error: err.message,
    });

    return res.status(500).json({
      error: 'AUTH_INTERNAL_ERROR',
      message: 'Внутрішня помилка перевірки токена',
    });
  }
}

module.exports = authToken;
