import { useCallback, useState } from "react";

export default function useAuth() {
  const [token, setTokenState] = useState(
    () => localStorage.getItem("admin_token") || ""
  );

  const setToken = useCallback((next) => {
    if (next) {
      localStorage.setItem("admin_token", next);
    } else {
      localStorage.removeItem("admin_token");
    }
    setTokenState(next || "");
  }, []);

  return { token, setToken };
}
