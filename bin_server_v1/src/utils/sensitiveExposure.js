const DEFAULT_DEV_EXPOSURE = String(process.env.NODE_ENV || "").toLowerCase() !== "production";
const TRUTHY_VALUES = new Set(["true", "1", "yes", "on"]);

function canExposeSensitive() {
  const raw = String(process.env.ALLOW_SENSITIVE_RESPONSES ?? "").trim().toLowerCase();
  if (raw) {
    return TRUTHY_VALUES.has(raw);
  }
  return DEFAULT_DEV_EXPOSURE;
}

module.exports = { canExposeSensitive };
