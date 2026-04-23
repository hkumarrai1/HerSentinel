import axios from 'axios';
import secureStorage from './secureStorage';
import apiConfig from '../config/api';

const API_BASE_URL = apiConfig.API_BASE_URL;
const TIMEOUT = 30000;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Add JWT token to request headers
 */
apiClient.interceptors.request.use(
  async config => {
    try {
      const accessToken = await secureStorage.getAccessToken();

      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }

      console.log('📤 API Request:', {
        method: config.method.toUpperCase(),
        url: config.baseURL + config.url,
        timeout: config.timeout,
      });

      return config;
    } catch (error) {
      console.error('Failed to add token to request', error);
      return config;
    }
  },
  error => Promise.reject(error),
);

/**
 * Handle token refresh on 401 and retry request
 */
apiClient.interceptors.response.use(
  response => {
    console.log('📥 API Response:', {
      status: response.status,
      url: response.config.url,
    });
    return response;
  },
  async error => {
    console.warn('⚠️ API Error:', {
      status: error.response?.status,
      message: error.message,
      url: error.config?.url,
      data: error.response?.data,
    });

    const originalRequest = error.config;

    // Prevent infinite loops
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await secureStorage.getRefreshToken();

        if (!refreshToken) {
          // No refresh token available, return original error
          return Promise.reject(error);
        }

        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;

        await secureStorage.saveTokens(accessToken, newRefreshToken);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, user must re-login
        await secureStorage.clearTokens();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
