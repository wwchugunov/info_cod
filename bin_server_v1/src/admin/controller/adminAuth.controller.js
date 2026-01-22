const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const AdminUser = require("../model/adminUser.model");
const AdminSession = require("../model/adminSession.model");
const {
  issueTokens,
  rotateRefreshToken,
  hashToken,
} = require("../service/adminAuth.service");

const adminAuthController = {};

adminAuthController.login = async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return res.status(400).json({ message: "Email и пароль обязательны" });
  }

  const admin = await AdminUser.findOne({ where: { email: normalizedEmail } });
  if (!admin || admin.is_active === false) {
    return res.status(401).json({ message: "Неверные данные входа" });
  }

  const ok = await admin.verifyPassword(password);
  if (!ok) {
    return res.status(401).json({ message: "Неверные данные входа" });
  }

  admin.last_login_at = new Date();
  await admin.save();

  const tokens = await issueTokens(admin, req);
  return res.json({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    role: admin.role,
    email: admin.email,
    name: admin.name,
    company_id: admin.company_id || null,
  });
};

adminAuthController.refresh = async (req, res) => {
  const { refresh_token: refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: "refresh_token обязателен" });
  }

  try {
    const tokens = await rotateRefreshToken(refreshToken, req);
    return res.json({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });
  } catch (err) {
    return res.status(401).json({ message: "Недействительный refresh_token" });
  }
};

adminAuthController.logout = async (req, res) => {
  const { refresh_token: refreshToken } = req.body;
  if (refreshToken) {
    await AdminSession.destroy({
      where: { refresh_token_hash: hashToken(refreshToken) },
    });
  }
  return res.json({ message: "OK" });
};

adminAuthController.register = async (req, res) => {
  const { email, password, name, role } = req.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedName = String(name || "").trim();

  if (!normalizedEmail || !password || !normalizedName) {
    return res.status(400).json({ message: "Email, имя и пароль обязательны" });
  }

  const exists = await AdminUser.findOne({ where: { email: normalizedEmail } });
  if (exists) {
    return res.status(409).json({ message: "Email уже используется" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await AdminUser.create({
    email: normalizedEmail,
    name: normalizedName,
    role: role || "viewer",
    password_hash: passwordHash,
  });

  return res.status(201).json({
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    is_active: admin.is_active,
  });
};

adminAuthController.updateProfile = async (req, res) => {
  const adminId = req.admin?.sub;
  if (!adminId) {
    return res.status(401).json({ message: "Требуется авторизация" });
  }

  const payload = {};
  const email = String(req.body.email || "").trim().toLowerCase();
  const name = String(req.body.name || "").trim();
  const password = String(req.body.password || "").trim();

  if (email) {
    const exists = await AdminUser.findOne({
      where: { email, id: { [Op.ne]: adminId } },
    });
    if (exists) {
      return res.status(409).json({ message: "Email уже используется" });
    }
    payload.email = email;
  }
  if (name) {
    payload.name = name;
  }
  if (password) {
    payload.password_hash = await bcrypt.hash(password, 10);
  }

  await AdminUser.update(payload, { where: { id: adminId } });
  const updated = await AdminUser.findByPk(adminId, {
    attributes: ["id", "email", "name", "role", "is_active", "company_id"],
  });
  return res.json(updated);
};

adminAuthController.me = async (req, res) => {
  const adminId = req.admin?.sub;
  if (!adminId) {
    return res.status(401).json({ message: "Требуется авторизация" });
  }
  const admin = await AdminUser.findByPk(adminId, {
    attributes: ["id", "email", "name", "role", "is_active", "company_id", "permissions"],
  });
  if (!admin) {
    return res.status(404).json({ message: "Пользователь не найден" });
  }
  return res.json(admin);
};

module.exports = adminAuthController;
