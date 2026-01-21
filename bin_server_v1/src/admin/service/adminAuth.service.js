const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const AdminUser = require("../model/adminUser.model");
const AdminSession = require("../model/adminSession.model");

const ACCESS_TTL = process.env.ADMIN_ACCESS_TTL || "15m";
const REFRESH_TTL_DAYS = Number(process.env.ADMIN_REFRESH_TTL_DAYS || 7);

function signAccessToken(admin) {
  return jwt.sign(
    {
      sub: admin.id,
      role: admin.role,
      email: admin.email,
      company_id: admin.company_id || null,
    },
    process.env.ADMIN_JWT_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

function signRefreshToken(admin) {
  return jwt.sign(
    { sub: admin.id, type: "refresh" },
    process.env.ADMIN_JWT_REFRESH_SECRET || process.env.ADMIN_JWT_SECRET,
    { expiresIn: `${REFRESH_TTL_DAYS}d` }
  );
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function issueTokens(admin, req) {
  const accessToken = signAccessToken(admin);
  const refreshToken = signRefreshToken(admin);
  const refreshHash = hashToken(refreshToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS);

  await AdminSession.create({
    admin_id: admin.id,
    refresh_token_hash: refreshHash,
    expires_at: expiresAt,
    user_agent: req.headers["user-agent"] || null,
    ip: req.ip || null,
  });

  return { accessToken, refreshToken };
}

async function rotateRefreshToken(refreshToken, req) {
  const decoded = jwt.verify(
    refreshToken,
    process.env.ADMIN_JWT_REFRESH_SECRET || process.env.ADMIN_JWT_SECRET
  );
  if (!decoded || decoded.type !== "refresh") {
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  const refreshHash = hashToken(refreshToken);
  const session = await AdminSession.findOne({
    where: { refresh_token_hash: refreshHash },
  });
  if (!session) {
    throw new Error("INVALID_REFRESH_TOKEN");
  }
  if (session.expires_at < new Date()) {
    throw new Error("REFRESH_TOKEN_EXPIRED");
  }

  const admin = await AdminUser.findByPk(session.admin_id);
  if (!admin || admin.is_active === false) {
    throw new Error("ADMIN_DISABLED");
  }

  await session.destroy();
  return issueTokens(admin, req);
}

module.exports = {
  issueTokens,
  rotateRefreshToken,
  hashToken,
};
