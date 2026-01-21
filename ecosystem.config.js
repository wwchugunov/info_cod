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
      script: "npm",
      args: "run preview -- --host 0.0.0.0 --port 4173",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
