const { DataTypes } = require("sequelize");
const sequelize = require("../../config/admin_db");

const ErrorLog = sequelize.define(
  "ErrorLog",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    source: { type: DataTypes.STRING, allowNull: false },
    level: { type: DataTypes.STRING, defaultValue: "error" },
    message: { type: DataTypes.TEXT, allowNull: false },
    stack: { type: DataTypes.TEXT },
    status_code: { type: DataTypes.INTEGER },
    method: { type: DataTypes.STRING },
    path: { type: DataTypes.TEXT },
    query: { type: DataTypes.TEXT },
    ip: { type: DataTypes.STRING },
    user_agent: { type: DataTypes.TEXT },
    details: { type: DataTypes.JSON },
  },
  {
    tableName: "error_logs",
    timestamps: true,
    underscored: true,
  }
);

module.exports = ErrorLog;
