import { useEffect, useState } from "react";
import api from "../services/api";
import { decodeJwt, getAccessToken } from "../services/auth";

export default function useAdminInfo() {
  const [info, setInfo] = useState({
    role: "",
    email: "",
    company_id: null,
    permissions: {},
  });

  useEffect(() => {
    const token = getAccessToken();
    const payload = decodeJwt(token);
    setInfo({
      role: payload?.role || "",
      email: payload?.email || "",
      company_id: payload?.company_id ?? null,
      permissions: {},
    });
    if (token) {
      api
        .get("/admin/auth/me")
        .then((res) => {
          setInfo({
            role: res.data.role || payload?.role || "",
            email: res.data.email || payload?.email || "",
            company_id: res.data.company_id ?? payload?.company_id ?? null,
            permissions: res.data.permissions || {},
          });
        })
        .catch(() => {});
    }
  }, []);

  return info;
}
