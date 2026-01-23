import axios from "axios";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  isTokenAuthMode,
  setTokens,
} from "./auth";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "/api",
  withCredentials: !isTokenAuthMode(),
});

api.interceptors.request.use((config) => {
  if (isTokenAuthMode()) {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      try {
        if (isTokenAuthMode()) {
          const refreshToken = getRefreshToken();
          if (!refreshToken) {
            clearTokens();
            return Promise.reject(error);
          }
          const res = await axios.post(
            `${import.meta.env.VITE_API_BASE || "/api"}/admin/auth/refresh`,
            { refresh_token: refreshToken }
          );
          setTokens(res.data || {});
        } else {
          await axios.post(
            `${import.meta.env.VITE_API_BASE || "/api"}/admin/auth/refresh`,
            {},
            { withCredentials: true }
          );
        }
        return api.request(error.config);
      } catch (refreshError) {
        clearTokens();
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
