const { DataTypes } = require("sequelize");
const sequelize = require("../config/data_base");
const Company = require("./company.model");
const { v4: uuidv4 } = require("uuid");

const Payment = sequelize.define("Payment", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

  company_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: Company, key: "id" },
    onDelete: "SET NULL",
  },
  company_name: { type: DataTypes.STRING },

  amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  purpose: { type: DataTypes.STRING, allowNull: false },
  iban: { type: DataTypes.STRING },

  commission_percent: { type: DataTypes.DECIMAL(9, 2), defaultValue: 0 },
  commission_fixed: { type: DataTypes.DECIMAL(9, 2), defaultValue: 0 },

  link_id: { type: DataTypes.UUID, defaultValue: uuidv4, unique: true },

  status: {
    type: DataTypes.ENUM("pending", "delivered"),
    defaultValue: "pending",
  },

  views_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },

  client_ip: { type: DataTypes.STRING },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  expires_at: { type: DataTypes.DATE, allowNull: false },
});


Company.hasMany(Payment, { foreignKey: "company_id" });
Payment.belongsTo(Company, { foreignKey: "company_id" });

module.exports = Payment;
