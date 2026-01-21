const { DataTypes } = require("sequelize");
const sequelize = require("../../config/admin_db");
const bcrypt = require("bcrypt");

const AdminUser = sequelize.define(
  "AdminUser",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    name: { type: DataTypes.STRING, allowNull: false },
    role: {
      type: DataTypes.ENUM("superadmin", "admin", "manager", "viewer"),
      allowNull: false,
      defaultValue: "viewer",
    },
    company_id: { type: DataTypes.INTEGER },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    permissions: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    last_login_at: { type: DataTypes.DATE },
  },
  {
    tableName: "admin_users",
    timestamps: true,
    underscored: true,
  }
);

AdminUser.prototype.verifyPassword = async function (password) {
  return bcrypt.compare(password, this.password_hash);
};

module.exports = AdminUser;
