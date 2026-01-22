module.exports = {
  async up({ sequelize, transaction }) {
    const queries = [
      'CREATE INDEX IF NOT EXISTS idx_companies_edrpo ON companies(edrpo);',
      'CREATE INDEX IF NOT EXISTS idx_companies_is_active ON companies(is_active);',
      'CREATE INDEX IF NOT EXISTS idx_companies_created_at ON companies(created_at);',
      'CREATE INDEX IF NOT EXISTS idx_companies_api_token_prefix ON companies(api_token_prefix);',
      'CREATE INDEX IF NOT EXISTS idx_payments_company_id ON "Payments"(company_id);',
      'CREATE INDEX IF NOT EXISTS idx_payments_created_at ON "Payments"(created_at);',
      'CREATE INDEX IF NOT EXISTS idx_payments_status ON "Payments"(status);',
      'CREATE INDEX IF NOT EXISTS idx_payments_link_id ON "Payments"(link_id);',
      'CREATE INDEX IF NOT EXISTS idx_generation_history_company_id ON generation_history(company_id);',
      'CREATE INDEX IF NOT EXISTS idx_generation_history_created_at ON generation_history(created_at);',
      'CREATE INDEX IF NOT EXISTS idx_generation_history_status ON generation_history(status);',
      'CREATE INDEX IF NOT EXISTS idx_generation_history_link_id ON generation_history(link_id);',
      'CREATE INDEX IF NOT EXISTS idx_generation_history_token_hash ON generation_history(token_hash);',
      'CREATE INDEX IF NOT EXISTS idx_scan_history_company_id ON scan_history(company_id);',
      'CREATE INDEX IF NOT EXISTS idx_scan_history_created_at ON scan_history(created_at);',
      'CREATE INDEX IF NOT EXISTS idx_scan_history_link_id ON scan_history(link_id);',
      'CREATE INDEX IF NOT EXISTS idx_scan_history_client_ip ON scan_history(client_ip);',
      'CREATE INDEX IF NOT EXISTS idx_bank_history_company_id ON bank_history(company_id);',
      'CREATE INDEX IF NOT EXISTS idx_bank_history_created_at ON bank_history(created_at);',
      'CREATE INDEX IF NOT EXISTS idx_bank_history_link_id ON bank_history(link_id);',
    ];

    for (const sql of queries) {
      await sequelize.query(sql, { transaction });
    }
  },
};
