const crypto = require("crypto");

const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;

function parseKey(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;

  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, "hex");
  }

  let buf = null;
  try {
    const decoded = Buffer.from(value, "base64");
    if (decoded.length === 32) {
      buf = decoded;
    }
  } catch (_) {
    buf = null;
  }

  if (!buf) {
    const utf8 = Buffer.from(value, "utf8");
    if (utf8.length === 32) {
      buf = utf8;
    }
  }

  if (!buf || buf.length !== 32) {
    throw new Error("TOKEN_ENC_KEY must be 32 bytes (hex, base64, or 32-char string)");
  }

  return buf;
}

function getEncryptionKey() {
  return parseKey(process.env.TOKEN_ENC_KEY);
}

function encryptToken(token) {
  const key = getEncryptionKey();
  if (!key) {
    throw new Error("TOKEN_ENC_KEY is required to encrypt tokens");
  }
  const iv = crypto.randomBytes(GCM_IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(token || ""), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

function decryptToken(payload) {
  const key = getEncryptionKey();
  if (!key) {
    throw new Error("TOKEN_ENC_KEY is required to decrypt tokens");
  }
  const raw = Buffer.from(String(payload || ""), "base64");
  if (raw.length <= GCM_IV_BYTES + GCM_TAG_BYTES) {
    throw new Error("Invalid encrypted token payload");
  }
  const iv = raw.subarray(0, GCM_IV_BYTES);
  const authTag = raw.subarray(GCM_IV_BYTES, GCM_IV_BYTES + GCM_TAG_BYTES);
  const ciphertext = raw.subarray(GCM_IV_BYTES + GCM_TAG_BYTES);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

module.exports = { encryptToken, decryptToken, getEncryptionKey };
