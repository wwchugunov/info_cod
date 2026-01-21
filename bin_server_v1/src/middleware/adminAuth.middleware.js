const jwt = require("jsonwebtoken");
const AdminUser = require("../admin/model/adminUser.model");

function getTokenFromHeaders(req) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type === "Bearer" && token) {
    return token;
  }
  return "";
}

function requireAdmin(roles = []) {
  return async (req, res, next) => {
    const token = getTokenFromHeaders(req);
    if (!token) {
      return res.status(401).json({ message: "Требуется авторизация" });
    }

    try {
      const payload = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
      const admin = await AdminUser.findByPk(payload.sub, {
        attributes: ["id", "role", "is_active"],
      });
      if (!admin || admin.is_active === false) {
        return res.status(401).json({ message: "Пользователь не активен" });
      }
      req.admin = { ...payload, role: admin.role };
      if (roles.length && !roles.includes(admin.role)) {
        return res.status(403).json({ message: "Недостаточно прав" });
      }
      return next();
    } catch (err) {
      return res.status(401).json({ message: "Недействительный токен" });
    }
  };
}

module.exports = { requireAdmin };
