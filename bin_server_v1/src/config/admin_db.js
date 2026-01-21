const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.ADMIN_DB_NAME || "admin_bin",
  process.env.ADMIN_DB_USER || process.env.DB_USER,
  process.env.ADMIN_DB_PAS || process.env.DB_PAS,
  {
    dialect: "postgres",
    host: process.env.ADMIN_DB_HOST || process.env.HOST_BD || "localhost",
    port: process.env.ADMIN_DB_PORT || process.env.DB_PORT || 5432,
    logging: false,
  }
);

module.exports = sequelize;
