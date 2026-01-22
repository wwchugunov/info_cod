function normalizeBaseUrl(url) {
  return String(url || "").replace(/\/+$/, "");
}

function getBaseUrl() {
  if (process.env.BASE_URL) {
    return normalizeBaseUrl(process.env.BASE_URL);
  }

  const domain = String(process.env.DOMEN || "").trim();
  if (!domain) {
    return "";
  }
  const hasProtocol = /^https?:\/\//i.test(domain);
  const protocol = hasProtocol ? "" : String(process.env.BASE_PROTOCOL || "");
  const port = process.env.PORT;
  const base = hasProtocol || !protocol ? domain : `${protocol}://${domain}`;

  if (port && !["80", "443"].includes(String(port))) {
    return normalizeBaseUrl(`${base}:${port}`);
  }

  return normalizeBaseUrl(base);
}

function buildPaymentLink(linkId) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return `/api/payment/payment/${linkId}`;
  }
  return `${baseUrl}/api/payment/payment/${linkId}`;
}

module.exports = { getBaseUrl, buildPaymentLink };
