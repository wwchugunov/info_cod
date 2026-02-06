const { DataTypes } = require("sequelize");

module.exports = {
  async up({ queryInterface, transaction }) {
    await queryInterface.addColumn(
      "companies",
      "api_token_enc",
      {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      { transaction }
    );
  },
  async down({ queryInterface, transaction }) {
    await queryInterface.removeColumn("companies", "api_token_enc", { transaction });
  },
};
