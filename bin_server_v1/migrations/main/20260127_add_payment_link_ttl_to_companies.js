const { DataTypes } = require("sequelize");

module.exports = {
  async up({ queryInterface, transaction }) {
    await queryInterface.addColumn(
      "companies",
      "payment_link_ttl_minutes",
      {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 24 * 60,
      },
      { transaction }
    );
  },
  async down({ queryInterface, transaction }) {
    await queryInterface.removeColumn("companies", "payment_link_ttl_minutes", {
      transaction,
    });
  },
};
