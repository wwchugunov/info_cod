const { DataTypes } = require("sequelize");
const sequelize = require("../../config/admin_db");

const SystemMetric = sequelize.define(
  "SystemMetric",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    cpu_usage_percent: { type: DataTypes.FLOAT },
    load_1: { type: DataTypes.FLOAT },
    load_5: { type: DataTypes.FLOAT },
    load_15: { type: DataTypes.FLOAT },
    mem_total: { type: DataTypes.BIGINT },
    mem_used: { type: DataTypes.BIGINT },
    mem_free: { type: DataTypes.BIGINT },
    process_rss: { type: DataTypes.BIGINT },
    heap_used: { type: DataTypes.BIGINT },
    heap_total: { type: DataTypes.BIGINT },
    event_loop_lag_ms: { type: DataTypes.FLOAT },
    bytes_in: { type: DataTypes.BIGINT },
    bytes_out: { type: DataTypes.BIGINT },
    req_count: { type: DataTypes.INTEGER },
    error_count: { type: DataTypes.INTEGER },
    avg_response_ms: { type: DataTypes.FLOAT },
    rps: { type: DataTypes.FLOAT },
  },
  {
    tableName: "system_metrics",
    timestamps: true,
    underscored: true,
  }
);

module.exports = SystemMetric;
