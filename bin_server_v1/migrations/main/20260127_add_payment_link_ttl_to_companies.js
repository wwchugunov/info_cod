module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("companies", "payment_link_ttl_minutes", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 24 * 60,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn("companies", "payment_link_ttl_minutes");
  },
};
