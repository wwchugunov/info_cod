const { DataTypes } = require("sequelize");
const sequelize = require("../../config/admin_db");
const AdminUser = require("./adminUser.model");

const AdminSession = sequelize.define(
  "AdminSession",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    admin_id: { type: DataTypes.INTEGER, allowNull: false },
    refresh_token_hash: { type: DataTypes.STRING, allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    user_agent: { type: DataTypes.TEXT },
    ip: { type: DataTypes.STRING },
  },
  {
    tableName: "admin_sessions",
    timestamps: true,
    underscored: true,
  }
);

AdminUser.hasMany(AdminSession, { foreignKey: "admin_id" });
AdminSession.belongsTo(AdminUser, { foreignKey: "admin_id" });

module.exports = AdminSession;
