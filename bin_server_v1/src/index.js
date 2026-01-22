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
  res.render('index');
});




app.use(cors());
app.use(express.json({ limit: '1mb' }));
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
