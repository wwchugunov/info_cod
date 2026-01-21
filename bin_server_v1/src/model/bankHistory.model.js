const { DataTypes } = require("sequelize");
const sequelize = require("../config/data_base");

const BankHistory = sequelize.define(
  "BankHistory",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    payment_id: { type: DataTypes.INTEGER },
    company_id: { type: DataTypes.INTEGER },
    company_name: { type: DataTypes.STRING },
    link_id: { type: DataTypes.UUID },
    bank_short_name: { type: DataTypes.STRING },
    bank_name: { type: DataTypes.STRING },
    bank_package_android: { type: DataTypes.STRING },
    bank_package_ios: { type: DataTypes.STRING },
    platform: { type: DataTypes.STRING },
    action: { type: DataTypes.STRING },
    client_ip: { type: DataTypes.STRING },
    user_agent: { type: DataTypes.TEXT },
  },
  {
    tableName: "bank_history",
    timestamps: true,
    underscored: true,
  }
);

module.exports = BankHistory;
