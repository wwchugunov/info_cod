import axios from "axios";
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from "./auth";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "/api",
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearTokens();
        return Promise.reject(error);
      }
      try {
        const res = await axios.post(
          `${import.meta.env.VITE_API_BASE || "/api"}/admin/auth/refresh`,
          { refresh_token: refreshToken }
        );
        setTokens(res.data);
        error.config.headers.Authorization = `Bearer ${res.data.access_token}`;
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
