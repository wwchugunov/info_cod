module.exports = {
  async up({ sequelize, transaction }) {
    await sequelize.query(
      `
      UPDATE companies
      SET api_token_last = CASE
        WHEN api_token_last IS NULL OR api_token_last = '' THEN api_token_last
        WHEN api_token_last LIKE '%...%' THEN api_token_last
        ELSE CONCAT(LEFT(api_token_last, 4), '...', RIGHT(api_token_last, 4))
      END;
      `,
      { transaction }
    );
  },
};
