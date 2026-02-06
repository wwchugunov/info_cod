function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

const authMode = import.meta.env.VITE_AUTH_MODE || "cookie";

function isTokenAuthMode() {
  return authMode === "token";
}

function getAccessToken() {
  return isTokenAuthMode() ? localStorage.getItem("admin_access") || "" : "";
}

function getRefreshToken() {
  return isTokenAuthMode() ? localStorage.getItem("admin_refresh") || "" : "";
}

function setTokens({ access_token, refresh_token }) {
  if (!isTokenAuthMode()) {
    return;
  }
  if (access_token) localStorage.setItem("admin_access", access_token);
  if (refresh_token) localStorage.setItem("admin_refresh", refresh_token);
}

function clearTokens() {
  localStorage.removeItem("admin_access");
  localStorage.removeItem("admin_refresh");
}

function getRole() {
  if (!isTokenAuthMode()) return "";
  const token = getAccessToken();
  const payload = decodeJwt(token);
  return payload?.role || "";
}

export {
  decodeJwt,
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  getRole,
  isTokenAuthMode,
};
