import api from "./api";

let isSending = false;

async function sendError(payload) {
  if (isSending) return;
  isSending = true;
  try {
    await api.post("/admin/errors/client", payload);
  } catch (err) {
    // ignore logging errors
  } finally {
    isSending = false;
  }
}

function logClientError(payload) {
  const data = {
    message: payload.message || "Client error",
    stack: payload.stack || null,
    url: payload.url || window.location.href,
    line: payload.line || null,
    column: payload.column || null,
    type: payload.type || "error",
  };
  sendError(data);
}

export { logClientError };
