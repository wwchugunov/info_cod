import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Companies from "./pages/Companies";
import Payments from "./pages/Payments";
import History from "./pages/History";
import Scans from "./pages/Scans";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import AdminUsers from "./pages/AdminUsers";
import ApiDocs from "./pages/ApiDocs";
import Errors from "./pages/Errors";
import Load from "./pages/Load";
import { getAccessToken } from "./services/auth";
import { decodeJwt } from "./services/auth";
import { hasRole } from "./services/roles";

function ProtectedLayout() {
  const token = getAccessToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <Outlet />
    </div>
  );
}

function RoleRoute({ roles, element }) {
  const token = getAccessToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  const payload = decodeJwt(token);
  if (!hasRole(payload?.role, roles)) {
    return <Navigate to="/payments" replace />;
  }
  return element;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            <RoleRoute
              roles={["superadmin", "manager"]}
              element={<Dashboard />}
            />
          }
        />
        <Route
          path="/companies"
          element={
            <RoleRoute
              roles={["superadmin", "admin", "manager"]}
              element={<Companies />}
            />
          }
        />
        <Route
          path="/payments"
          element={
            <RoleRoute
              roles={["superadmin", "manager", "viewer"]}
              element={<Payments />}
            />
          }
        />
        <Route
          path="/operations"
          element={
            <RoleRoute
              roles={["admin"]}
              element={
                <History
                  title="Генерації"
                  subtitle="Усі генерації"
                  fixedType="generation"
                />
              }
            />
          }
        />
        <Route
          path="/history"
          element={
            <RoleRoute
              roles={["superadmin", "admin", "manager", "viewer"]}
              element={<History />}
            />
          }
        />
        <Route
          path="/scans"
          element={
            <RoleRoute
              roles={["superadmin", "admin", "manager", "viewer"]}
              element={<Scans />}
            />
          }
        />
        <Route
          path="/reports"
          element={
            <RoleRoute
              roles={["superadmin", "admin", "manager"]}
              element={<Reports />}
            />
          }
        />
        <Route
          path="/api"
          element={
            <RoleRoute
              roles={["superadmin", "admin", "manager", "viewer"]}
              element={<ApiDocs />}
            />
          }
        />
        <Route
          path="/users"
          element={
            <RoleRoute roles={["superadmin"]} element={<AdminUsers />} />
          }
        />
        <Route
          path="/errors"
          element={
            <RoleRoute roles={["superadmin"]} element={<Errors />} />
          }
        />
        <Route
          path="/load"
          element={
            <RoleRoute roles={["superadmin"]} element={<Load />} />
          }
        />
        <Route
          path="/settings"
          element={
            <RoleRoute
              roles={["superadmin", "admin", "manager", "viewer"]}
              element={<Settings />}
            />
          }
        />
      </Route>
    </Routes>
  );
}
