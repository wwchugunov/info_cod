const { DataTypes } = require("sequelize");
const sequelize = require("../../config/data_base");
const Company = require("../../model/company.model");

const EditablePaymentLink = sequelize.define(
  "EditablePaymentLink",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Company, key: "id" },
    },
    amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    purpose: { type: DataTypes.STRING, allowNull: false },
    allow_amount_edit: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    link_id: { type: DataTypes.UUID, allowNull: false, unique: true },
    status: {
      type: DataTypes.ENUM("draft", "active", "disabled"),
      allowNull: false,
      defaultValue: "active",
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  },
  {
    tableName: "editable_payment_links",
    timestamps: true,
    underscored: true,
  }
);

Company.hasMany(EditablePaymentLink, { foreignKey: "company_id" });
EditablePaymentLink.belongsTo(Company, { foreignKey: "company_id" });

module.exports = EditablePaymentLink;
