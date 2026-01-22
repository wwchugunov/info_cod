const express = require("express");
const router = express.Router();
const { requireAdmin } = require("../middleware/adminAuth.middleware");
const adminController = require("../controller/admin.controller");
const adminAuthController = require("../admin/controller/adminAuth.controller");
const adminUsersController = require("../admin/controller/adminUsers.controller");

router.post("/auth/login", adminAuthController.login);
router.post("/auth/refresh", adminAuthController.refresh);
router.post("/auth/logout", adminAuthController.logout);
router.post("/errors/client", adminController.logClientError);
router.get(
  "/auth/me",
  requireAdmin(["superadmin", "admin", "manager", "viewer"]),
  adminAuthController.me
);
router.patch(
  "/auth/profile",
  requireAdmin(["superadmin", "admin", "manager", "viewer"]),
  adminAuthController.updateProfile
);
router.post("/auth/register", requireAdmin(["superadmin"]), adminAuthController.register);

router.get("/companies", requireAdmin(["superadmin", "admin", "manager"]), adminController.listCompanies);
router.post(
  "/companies",
  requireAdmin(["superadmin", "admin", "manager", "viewer"]),
  adminController.createCompany
);
router.get(
  "/companies/:id",
  requireAdmin(["superadmin", "admin", "manager", "viewer"]),
  adminController.getCompany
);
router.patch(
  "/companies/:id",
  requireAdmin(["superadmin", "admin", "manager", "viewer"]),
  adminController.updateCompany
);
router.delete(
  "/companies/:id",
  requireAdmin(["superadmin", "admin", "manager", "viewer"]),
  adminController.deleteCompany
);

router.get(
  "/payments",
  requireAdmin(["superadmin", "admin", "manager", "viewer"]),
  adminController.listPayments
);
router.get(
  "/generation-history",
  requireAdmin(["superadmin", "admin", "manager", "viewer"]),
  adminController.listGenerationHistory
);
router.get(
  "/scan-history",
  requireAdmin(["superadmin", "admin", "manager", "viewer"]),
  adminController.listScanHistory
);
router.get(
  "/bank-history",
  requireAdmin(["superadmin", "admin", "manager", "viewer"]),
  adminController.listBankHistory
);
router.get(
  "/metrics",
  requireAdmin(["superadmin", "admin", "manager", "viewer"]),
  adminController.metrics
);
router.get(
  "/metrics/series",
  requireAdmin(["superadmin", "admin", "manager", "viewer"]),
  adminController.metricsSeries
);

router.get(
  "/export/companies.csv",
  requireAdmin(["superadmin", "admin", "manager", "viewer"]),
  adminController.exportCompanies
);
router.get(
  "/export/payments.csv",
  requireAdmin(["superadmin", "admin", "manager", "viewer"]),
  adminController.exportPayments
);
router.get(
  "/export/generation-history.csv",
  requireAdmin(["superadmin", "admin", "manager", "viewer"]),
  adminController.exportGenerationHistory
);
router.get(
  "/export/scan-history.csv",
  requireAdmin(["superadmin", "admin", "manager", "viewer"]),
  adminController.exportScanHistory
);
router.get(
  "/export/bank-history.csv",
  requireAdmin(["superadmin", "admin", "manager", "viewer"]),
  adminController.exportBankHistory
);

router.post(
  "/companies/:id/token",
  requireAdmin(["superadmin", "admin", "manager", "viewer"]),
  adminController.rotateCompanyToken
);
router.post(
  "/companies/:id/admin-user",
  requireAdmin(["superadmin"]),
  adminController.createCompanyAdmin
);

router.get("/admin-users", requireAdmin(["superadmin"]), adminUsersController.list);
router.post("/admin-users", requireAdmin(["superadmin"]), adminUsersController.create);
router.patch("/admin-users/:id", requireAdmin(["superadmin"]), adminUsersController.update);
router.post("/admin-users/:id/reset-password", requireAdmin(["superadmin"]), adminUsersController.resetPassword);
router.delete("/admin-users/:id", requireAdmin(["superadmin"]), adminUsersController.remove);

router.get("/errors", requireAdmin(["superadmin"]), adminController.listErrors);
router.get("/system-metrics", requireAdmin(["superadmin"]), adminController.listSystemMetrics);

module.exports = router;
