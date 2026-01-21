import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import { logClientError } from "./services/errorLogger";

window.addEventListener("error", (event) => {
  logClientError({
    message: event.message,
    stack: event.error?.stack,
    url: event.filename,
    line: event.lineno,
    column: event.colno,
    type: "error",
  });
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason || {};
  logClientError({
    message: reason.message || String(reason),
    stack: reason.stack,
    url: window.location.href,
    type: "unhandledrejection",
  });
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename="/admin">
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
