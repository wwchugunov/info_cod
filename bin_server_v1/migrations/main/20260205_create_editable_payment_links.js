const { DataTypes, Sequelize } = require("sequelize");

module.exports = {
  async up({ queryInterface, transaction }) {
    await queryInterface.createTable(
      "editable_payment_links",
      {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        company_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "companies", key: "id" },
          onDelete: "CASCADE",
        },
        amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
        purpose: { type: DataTypes.STRING, allowNull: false },
        allow_amount_edit: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        link_id: { type: DataTypes.UUID, allowNull: false, unique: true },
        status: {
          type: DataTypes.ENUM("draft", "active", "disabled"),
          allowNull: false,
          defaultValue: "active",
        },
        expires_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal(
            "CURRENT_TIMESTAMP + INTERVAL '24 hours'"
          ),
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      },
      { transaction }
    );
  },
  async down({ queryInterface, sequelize, transaction }) {
    await queryInterface.dropTable("editable_payment_links", { transaction });

    const dialect =
      sequelize?.getDialect?.() || queryInterface.sequelize?.getDialect?.();
    if (dialect === "postgres") {
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_editable_payment_links_status";',
        { transaction }
      );
    }
  },
};
