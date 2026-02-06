module.exports = {
  apps: [
    {
      name: "bin_server",
      cwd: "/home/bin_server_v1",
      script: "src/index.js",
      env: {
        NODE_ENV: "production",
        PORT: 5050,
      },
    },
    {
      name: "admin_panel",
      cwd: "/home/admin_panel",
      script: "node",
      args: "scripts/serve-dist.js",
      env: {
        NODE_ENV: "production",
        PORT: 4173,
      },
    },
  ],
};
