const { DataTypes } = require("sequelize");
const sequelize = require("../config/data_base");

const ScanHistory = sequelize.define(
  "ScanHistory",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    payment_id: { type: DataTypes.INTEGER },
    company_id: { type: DataTypes.INTEGER },
    company_name: { type: DataTypes.STRING },
    link_id: { type: DataTypes.UUID },
    client_ip: { type: DataTypes.STRING },
    user_agent: { type: DataTypes.TEXT },
    is_duplicate: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    tableName: "scan_history",
    timestamps: true,
    underscored: true,
  }
);

module.exports = ScanHistory;
