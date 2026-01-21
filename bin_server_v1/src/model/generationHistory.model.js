const { DataTypes } = require('sequelize');
const sequelize = require('../config/data_base');

const GenerationHistory = sequelize.define('GenerationHistory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id: { type: DataTypes.INTEGER, allowNull: false },
  company_name: { type: DataTypes.STRING },
  token_hash: { type: DataTypes.STRING },
  amount: { type: DataTypes.DECIMAL(15,2) },
  commission_percent: { type: DataTypes.DECIMAL(9,2), defaultValue: 0 },
  commission_fixed: { type: DataTypes.DECIMAL(9,2), defaultValue: 0 }, 
  final_amount: { type: DataTypes.DECIMAL(15,2) },
  purpose: { type: DataTypes.TEXT },
  link_id: { type: DataTypes.UUID },
  client_ip: { type: DataTypes.STRING },
  user_agent: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING, defaultValue: "success" },
  error_code: { type: DataTypes.STRING },
  error_message: { type: DataTypes.TEXT }
}, {
  tableName: 'generation_history',
  timestamps: true,
  underscored: true
});

module.exports = GenerationHistory;
