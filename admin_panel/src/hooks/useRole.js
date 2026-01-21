import { useEffect, useState } from "react";
import { decodeJwt, getAccessToken } from "../services/auth";

export default function useRole() {
  const [role, setRole] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    const payload = decodeJwt(token);
    setRole(payload?.role || "");
  }, []);

  return role;
}
