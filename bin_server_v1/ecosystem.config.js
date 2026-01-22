module.exports = {
  apps: [
    {
      name: 'api_bin',   
      script: './src/index.js',
      node_args: '--require dotenv/config',
      env: {
        NODE_ENV: 'production',
        PORT: 5050,
        HOST_BD: 'localhost',
        DB_NAME: 'bin_admin_db',
        DB_USER: 'bin_admin',
        DB_PAS: 'ADOlfgitler1945',
        DB_PORT: 5432
      },
      watch: false                // отключаем авто-watch (можно true для dev)
    }
  ]
};
