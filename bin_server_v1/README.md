# bin_server_v1

## Production checklist

Environment variables (required in production):

- `PORT`
- `DB_NAME`, `DB_USER`, `DB_PAS`, `HOST_BD`, `DB_PORT`
- `ADMIN_JWT_SECRET`, `ADMIN_JWT_REFRESH_SECRET`
- `ADMIN_DB_NAME`, `ADMIN_DB_USER`, `ADMIN_DB_PAS`, `ADMIN_DB_HOST`, `ADMIN_DB_PORT` (optional, defaults to main DB)

Security toggles:

- `ALLOW_SENSITIVE_RESPONSES=false` (recommended) hides API tokens and admin passwords in responses.
- `ADMIN_AUTH_RATE_WINDOW_MS=60000`, `ADMIN_AUTH_RATE_MAX=10` for admin auth throttling.
- `ENABLE_CSP=true` to enable Content-Security-Policy (configure with `CSP` if needed).
- `ADMIN_ALLOW_TOKEN_AUTH=true` allows returning JWTs in responses (use only for HTTP/dev).
- `ADMIN_COOKIE_INSECURE=true` disables `Secure` cookies (HTTP only).

Notes:

- CORS is intentionally open for testing (per current setup).
- Do not ship `scripts/create-superadmin.js` without setting `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD`.
- Admin auth uses HttpOnly cookies (`admin_access`, `admin_refresh`) by default.
