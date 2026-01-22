const { DataTypes } = require('sequelize');
const sequelize = require('../config/data_base');
const bcrypt = require('bcrypt');

const Company = sequelize.define('Company', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  contact_name: { type: DataTypes.STRING, allowNull: false },
  contact_phone: { type: DataTypes.STRING, allowNull: false },
  api_token: {
    type: DataTypes.STRING,
    allowNull: false,
    set(val) {
      this.setDataValue('api_token', bcrypt.hashSync(val, 10));
    }
  },
  api_token_prefix: { type: DataTypes.STRING(12) },
  ip_whitelist: { type: DataTypes.JSON, defaultValue: [] },
  daily_limit: { type: DataTypes.INTEGER, defaultValue: 1000 },
  use_daily_limit: { type: DataTypes.BOOLEAN, defaultValue: true },
  commission_percent: { type: DataTypes.DECIMAL(9,2), defaultValue: 0 },
  commission_fixed: { type: DataTypes.DECIMAL(9,2), defaultValue: 0 },
  use_percent_commission: { type: DataTypes.BOOLEAN, defaultValue: true },
  use_fixed_commission: { type: DataTypes.BOOLEAN, defaultValue: true },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  iban: { type: DataTypes.STRING, allowNull: false },
  edrpo: { type: DataTypes.STRING, allowNull: false },
  logo_url: DataTypes.STRING,
  offer_url: DataTypes.STRING,
  registration_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  internal_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, unique: true },
  turnover: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 }
}, { 
  tableName: 'companies', 
  timestamps: true, 
  underscored: true 
});

Company.addHook("beforeUpdate", (company, options) => {
  if (!options?.allowApiTokenUpdate && company.changed("api_token")) {
    company.setDataValue("api_token", company.previous("api_token"));
  }
  if (!options?.allowApiTokenUpdate && company.changed("api_token_prefix")) {
    company.setDataValue("api_token_prefix", company.previous("api_token_prefix"));
  }
});

Company.addHook("beforeBulkUpdate", (options) => {
  if (options?.allowApiTokenUpdate) return;
  if (!options?.attributes) return;
  delete options.attributes.api_token;
  delete options.attributes.api_token_prefix;
});

Company.prototype.createPayment = async function(amount, purpose, client_ip = null, user_agent = null) {
  const paymentService = require('../service/payment.service');
  const paymentInfo = await paymentService.createPayment(
    this,
    amount,
    purpose,
    this.iban,
    client_ip,
    user_agent,
    null
  );

  return {
    paymentLink: paymentInfo.qr_link,
    originalAmount: paymentInfo.originalAmount,
    commissionPercent: paymentInfo.commissionPercent,
    commissionFixed: paymentInfo.commissionFixed,
    finalAmount: paymentInfo.finalAmount,
    company: {
      name: this.name,
      logo_url: this.logo_url || null,
      offer_url: this.offer_url || null,
      iban: this.iban,
      edrpo: this.edrpo
    },
    purpose,
    linkId: paymentInfo.qr_link
  };
};

module.exports = Company;
