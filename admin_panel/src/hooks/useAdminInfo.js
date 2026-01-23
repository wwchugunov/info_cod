import { useEffect, useState } from "react";
import api from "../services/api";
import { decodeJwt, getAccessToken, isTokenAuthMode } from "../services/auth";
export default function useAdminInfo() {
  const [info, setInfo] = useState({
    role: "",
    email: "",
    company_id: null,
    permissions: {},
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    if (isTokenAuthMode()) {
      const token = getAccessToken();
      const payload = decodeJwt(token);
      if (payload) {
        setInfo((prev) => ({
          ...prev,
          role: payload?.role || "",
          email: payload?.email || "",
          company_id: payload?.company_id ?? null,
          isAuthenticated: true,
        }));
      } else {
        setInfo((prev) => ({
          ...prev,
          isAuthenticated: false,
          isLoading: false,
        }));
      }
    }

    api
      .get("/admin/auth/me")
      .then((res) => {
        setInfo({
          role: res.data.role || "",
          email: res.data.email || "",
          company_id: res.data.company_id ?? null,
          permissions: res.data.permissions || {},
          isAuthenticated: true,
          isLoading: false,
        });
      })
      .catch(() => {
        setInfo((prev) => ({
          ...prev,
          isAuthenticated: false,
          isLoading: false,
        }));
      });
  }, []);

  return info;
}
