const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const AdminUser = require("../model/adminUser.model");

const adminUsersController = {};

adminUsersController.list = async (req, res) => {
  const where = {};
  if (req.query.company_id) {
    const companyId = Number(req.query.company_id);
    if (Number.isFinite(companyId)) {
      where.company_id = companyId;
    }
  }
  const users = await AdminUser.findAll({
    where,
    order: [["created_at", "DESC"]],
    attributes: [
      "id",
      "email",
      "name",
      "role",
      "is_active",
      "company_id",
      "permissions",
      "created_at",
    ],
  });
  return res.json(users);
};

adminUsersController.create = async (req, res) => {
  const { email, password, name, role, company_id } = req.body;
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
  const user = await AdminUser.create({
    email: normalizedEmail,
    name: normalizedName,
    role: role || "viewer",
    company_id: company_id || null,
    password_hash: passwordHash,
  });

  return res.status(201).json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    is_active: user.is_active,
    company_id: user.company_id,
  });
};

adminUsersController.update = async (req, res) => {
  const allowed = ["name", "role", "is_active", "email", "company_id", "permissions"];
  const payload = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      payload[key] = req.body[key];
    }
  }

  if (payload.email) {
    payload.email = String(payload.email || "").trim().toLowerCase();
    const exists = await AdminUser.findOne({
      where: { email: payload.email, id: { [Op.ne]: req.params.id } },
    });
    if (exists) {
      return res.status(409).json({ message: "Email уже используется" });
    }
  } else if (Object.prototype.hasOwnProperty.call(payload, "email")) {
    delete payload.email;
  }

  const [count] = await AdminUser.update(payload, {
    where: { id: req.params.id },
  });
  if (!count) {
    return res.status(404).json({ message: "Пользователь не найден" });
  }
  const user = await AdminUser.findByPk(req.params.id, {
    attributes: ["id", "email", "name", "role", "is_active", "company_id"],
  });
  return res.json(user);
};

adminUsersController.resetPassword = async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ message: "Пароль обязателен" });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const [count] = await AdminUser.update(
    { password_hash: passwordHash },
    { where: { id: req.params.id } }
  );
  if (!count) {
    return res.status(404).json({ message: "Пользователь не найден" });
  }
  return res.json({ message: "OK" });
};

adminUsersController.remove = async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isFinite(userId)) {
    return res.status(400).json({ message: "Некорректный ID" });
  }
  if (req.admin?.sub && Number(req.admin.sub) === userId) {
    return res.status(400).json({ message: "Нельзя удалить текущего пользователя" });
  }
  const count = await AdminUser.destroy({ where: { id: userId } });
  if (!count) {
    return res.status(404).json({ message: "Пользователь не найден" });
  }
  return res.json({ ok: true });
};

module.exports = adminUsersController;
