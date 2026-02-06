function buildTokenPreview(token) {
  const raw = String(token || "").trim();
  if (!raw) return "";
  if (raw.length <= 8) return raw;
  return `${raw.slice(0, 4)}...${raw.slice(-4)}`;
}

function ensureTokenPreview(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.includes("...")) return raw;
  return buildTokenPreview(raw);
}

module.exports = { buildTokenPreview, ensureTokenPreview };
