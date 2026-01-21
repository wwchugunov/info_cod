function normalizeBaseUrl(url) {
  return String(url || "").replace(/\/+$/, "");
}

function getBaseUrl() {
  if (process.env.BASE_URL) {
    return normalizeBaseUrl(process.env.BASE_URL);
  }

  const domain = process.env.DOMEN || "infokod.com.ua";
  const hasProtocol = /^https?:\/\//i.test(domain);
  const protocol = hasProtocol ? "" : "http://";
  const port = process.env.PORT;
  const base = hasProtocol ? domain : `${protocol}${domain}`;

  if (port && !["80", "443"].includes(String(port))) {
    return normalizeBaseUrl(`${base}:${port}`);
  }

  return normalizeBaseUrl(base);
}

function buildPaymentLink(linkId) {
  return `${getBaseUrl()}/api/payment/payment/${linkId}`;
}

module.exports = { getBaseUrl, buildPaymentLink };
