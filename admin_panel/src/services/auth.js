function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch (err) {
    return null;
  }
}

function getAccessToken() {
  return localStorage.getItem("admin_access") || "";
}

function getRefreshToken() {
  return localStorage.getItem("admin_refresh") || "";
}

function setTokens({ access_token, refresh_token }) {
  if (access_token) localStorage.setItem("admin_access", access_token);
  if (refresh_token) localStorage.setItem("admin_refresh", refresh_token);
}

function clearTokens() {
  localStorage.removeItem("admin_access");
  localStorage.removeItem("admin_refresh");
}

function getRole() {
  const token = getAccessToken();
  const payload = decodeJwt(token);
  return payload?.role || "";
}

export { decodeJwt, getAccessToken, getRefreshToken, setTokens, clearTokens, getRole };
