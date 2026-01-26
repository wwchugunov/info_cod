module.exports = {
  apps: [
    {
      name: 'api_bin',   
      script: './src/index.js',
      node_args: '--require dotenv/config',
      env: {
        NODE_ENV: 'production',
        PORT: Number(process.env.PORT) || 5050,
        HOST_BD: process.env.HOST_BD || 'localhost',
        DB_NAME: process.env.DB_NAME || 'bin_admin_db',
        DB_USER: process.env.DB_USER || 'bin_admin',
        DB_PAS: process.env.DB_PAS,
        DB_PORT: Number(process.env.DB_PORT) || 5432
      },
      watch: false                // отключаем авто-watch (можно true для dev)
    }
  ]
};
