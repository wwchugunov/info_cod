const express = require('express');
require('dotenv').config();
const sequelize = require('../src/config/data_base'); 
const adminSequelize = require('./config/admin_db');
const { ensureSuperAdmin } = require('./admin/service/adminBootstrap.service');
const router = require('./router/index.router'); 
const cors = require('cors');
const http = require('http');
const path = require('path');
const morgan = require('morgan');
const logger = require('./config/logger');
const { logError } = require("./admin/service/errorLog.service");
const {
  overloadGuard,
  rateLimitPaymentGenerate,
} = require("./middleware/overload.middleware");
const {
  recordRequestMetrics,
  startSystemMetricsSampler,
} = require("./admin/service/systemMetrics.service");
const host = process.env.HOST || undefined;
const port = Number(process.env.PORT);
const paymentRouter = require('./router/payment.router.js');


const app = express();
const trustProxy = process.env.TRUST_PROXY;
app.set(
  "trust proxy",
  trustProxy === "true" ? true : trustProxy || "loopback, linklocal, uniquelocal"
);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  if (String(process.env.ENABLE_CSP || "").toLowerCase() === "true") {
    const csp =
      process.env.CSP ||
      "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'";
    res.setHeader("Content-Security-Policy", csp);
  }
  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  next();
});

process.on("unhandledRejection", (reason) => {
  logError({
    source: "server",
    level: "fatal",
    message: reason?.message || String(reason),
    stack: reason?.stack,
  }).catch(() => {});
});

process.on("uncaughtException", (err) => {
  logError({
    source: "server",
    level: "fatal",
    message: err?.message || "Uncaught exception",
    stack: err?.stack,
  }).catch(() => {});
});

app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    res.locals.responseBody = body;
    return originalJson(body);
  };
  res.on("finish", () => {
    if (res.statusCode >= 400 && !res.locals.errorLogged) {
      const message =
        res.locals.responseBody?.message ||
        res.locals.responseBody?.error ||
        `HTTP ${res.statusCode}`;
      logError({
        source: "server",
        level: "error",
        message,
        statusCode: res.statusCode,
        method: req.method,
        path: req.originalUrl,
        query: req.query ? JSON.stringify(req.query) : null,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        details: {
          code: res.locals.responseBody?.code || null,
        },
      }).catch(() => {});
    }
  });
  next();
});
app.use(recordRequestMetrics);
const adminDistPath = path.join(__dirname, '../../admin_panel/dist');
const landingDistPath = path.resolve(__dirname, '../../landing');
app.use(
  '/admin',
  express.static(adminDistPath, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store');
      }
    },
  })
);
app.get(/^\/admin(\/.*)?$/, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(adminDistPath, 'index.html'));
});
app.use(
  morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  })
);

app.get('/', (req, res) => {
  res.sendFile(path.join(landingDistPath, 'index.html'));
});

app.use(express.static(landingDistPath));




app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(rateLimitPaymentGenerate);
app.use(overloadGuard);
app.use('/api', router);
app.use('/api', (req, res) => {
  res.status(404).json({
    message: "Неправильный тип запроса или путь",
    method: req.method,
    path: req.originalUrl,
  });
});
app.use('/', paymentRouter);
app.use((err, req, res, next) => {
  res.locals.errorLogged = true;
  logError({
    source: "server",
    level: "error",
    message: err.message || "Server error",
    stack: err.stack,
    statusCode: err.status || 500,
    method: req.method,
    path: req.originalUrl,
    query: req.query ? JSON.stringify(req.query) : null,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  }).catch(() => {});
  res.status(err.status || 500).json({ message: "Внутренняя ошибка сервера" });
});


const start = async () => {
  try {
    if (process.env.NODE_ENV === "production") {
      const required = [
        "PORT",
        "DB_NAME",
        "DB_USER",
        "DB_PAS",
        "HOST_BD",
        "ADMIN_JWT_SECRET",
        "ADMIN_JWT_REFRESH_SECRET",
      ];
      const missing = required.filter((key) => !process.env[key]);
      if (missing.length) {
        throw new Error(`Missing required env vars: ${missing.join(", ")}`);
      }
    }
    if (!Number.isFinite(port)) {
      throw new Error("PORT is required and must be a number");
    }
    await sequelize.authenticate();
    if (process.env.DB_SYNC === "true") {
      await sequelize.sync({ alter: process.env.DB_SYNC_ALTER === "true" });
    }
    await adminSequelize.authenticate();
    if (process.env.ADMIN_DB_SYNC === "true") {
      await adminSequelize.sync({ alter: process.env.ADMIN_DB_SYNC_ALTER === "true" });
    }
    await ensureSuperAdmin();
    startSystemMetricsSampler({ intervalMs: 10000 });
    const server = http.createServer(app);
    server.listen(port, host, () => {
      if (host) {
        console.log(`Server running on http://${host}:${port}`);
      } else {
        console.log(`Server running on port ${port}`);
      }
    });
  } catch (error) {
    console.error('Ошибка при старте сервера:', error.message);
  }
};

start();
