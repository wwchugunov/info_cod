module.exports = {
  async up({ sequelize, transaction }) {
    const queries = [
      'CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);',
      'CREATE INDEX IF NOT EXISTS idx_admin_users_company_id ON admin_users(company_id);',
      'CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON admin_sessions(admin_id);',
      'CREATE INDEX IF NOT EXISTS idx_admin_sessions_refresh_hash ON admin_sessions(refresh_token_hash);',
      'CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);',
      'CREATE INDEX IF NOT EXISTS idx_system_metrics_created_at ON system_metrics(created_at);',
      'CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at);',
      'CREATE INDEX IF NOT EXISTS idx_error_logs_source ON error_logs(source);',
      'CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs(level);',
    ];

    for (const sql of queries) {
      await sequelize.query(sql, { transaction });
    }
  },
};
