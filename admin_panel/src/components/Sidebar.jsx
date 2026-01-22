import { NavLink } from "react-router-dom";
import useAdminInfo from "../hooks/useAdminInfo";
import { hasRole } from "../services/roles";

const links = [
  { to: "/dashboard", label: "Дашборд", roles: ["superadmin", "manager"] },
  { to: "/companies", label: "Компанії", roles: ["superadmin", "admin", "manager"] },
  { to: "/payments", label: "Платежі", roles: ["superadmin", "manager", "viewer"] },
  { to: "/operations", label: "Генерації", roles: ["admin"] },
  { to: "/history", label: "Історія", roles: ["superadmin", "admin", "manager", "viewer"] },
  { to: "/scans", label: "Сканування", roles: ["superadmin", "admin", "manager", "viewer"] },
  { to: "/reports", label: "Звіти", roles: ["superadmin", "admin", "manager"] },
  { to: "/api", label: "API", roles: ["superadmin", "admin", "manager", "viewer"] },
  { to: "/users", label: "Адмін‑користувачі", roles: ["superadmin"] },
  { to: "/errors", label: "Помилки", roles: ["superadmin"] },
  { to: "/load", label: "Навантаження", roles: ["superadmin"] },
  { to: "/settings", label: "Налаштування", roles: ["superadmin", "admin", "manager", "viewer"] },
];

export default function Sidebar() {
  const { role, email } = useAdminInfo();
  const brandLabel = import.meta.env.VITE_APP_BRAND || "—";
  const roleLabel = {
    viewer: "Перегляд",
    manager: "Менеджер",
    admin: "Адміністратор",
    superadmin: "Суперадмін",
  }[role] || role;

  return (
    <aside className="sidebar">
      <div className="brand">{brandLabel}</div>
      <nav className="nav">
        {links
          .filter((link) => hasRole(role, link.roles))
          .map((link) => (
            <NavLink key={link.to} to={link.to}>
              {link.label}
            </NavLink>
          ))}
      </nav>
      <div className="sidebar-footer">
        <div>{email || "—"}</div>
        <div>Роль: {roleLabel || "—"}</div>
      </div>
    </aside>
  );
}
