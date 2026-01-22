const { DataTypes } = require("sequelize");
const sequelize = require("../config/data_base");
const Payment = require("./generatelink");

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
    platform: { type: DataTypes.STRING },
    language: { type: DataTypes.STRING },
    screen: { type: DataTypes.STRING },
    timezone: { type: DataTypes.STRING },
    referrer: { type: DataTypes.TEXT },
    device: { type: DataTypes.STRING },
    is_duplicate: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    tableName: "scan_history",
    timestamps: true,
    underscored: true,
  }
);

Payment.hasMany(ScanHistory, { foreignKey: "payment_id" });
ScanHistory.belongsTo(Payment, { foreignKey: "payment_id" });

module.exports = ScanHistory;
