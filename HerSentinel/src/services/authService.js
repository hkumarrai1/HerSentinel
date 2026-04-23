import apiClient from './apiClient';
import secureStorage from './secureStorage';

const authService = {
  /**
   * Register new user
   */
  async register(name, email, password, phone, role = 'USER') {
    try {
      console.log('📝 Registering user:', { name, email, phone, role });
      const response = await apiClient.post('/auth/register', {
        name,
        email,
        password,
        phone: phone || undefined,
        role,
      });

      console.log('✅ Registration successful:', response.data);
      return {
        success: true,
        user: response.data.user,
        message: response.data.message,
      };
    } catch (error) {
      console.error('❌ Registration error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        url: error.config?.url,
      });
      return {
        success: false,
        message:
          error.response?.data?.message ||
          error.message ||
          'Registration failed. Please try again.',
      };
    }
  },

  /**
   * Login user and store tokens securely
   */
  async login(email, password) {
    try {
      const response = await apiClient.post('/auth/login', {
        email,
        password,
      });

      const { accessToken, refreshToken, user } = response.data;

      // Store tokens securely
      await secureStorage.saveTokens(accessToken, refreshToken);
      await secureStorage.saveUser(user);
      apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`;

      return {
        success: true,
        user,
        accessToken, // Return token for immediate state update
      };
    } catch (error) {
      const isNetworkError = !error.response;

      return {
        success: false,
        message: isNetworkError
          ? 'Network error. Cannot reach backend server. Please check WiFi IP/port and backend status.'
          : error.response?.data?.message ||
            'Login failed. Please check your credentials.',
      };
    }
  },

  /**
   * Logout user and clear tokens
   */
  async logout() {
    try {
      const refreshToken = await secureStorage.getRefreshToken();

      if (refreshToken) {
        try {
          await apiClient.post('/auth/logout', { refreshToken });
        } catch (logoutError) {
          // Continue clearing tokens even if logout API call fails
          console.warn(
            'Logout API call failed, clearing local tokens anyway',
            logoutError,
          );
        }
      }

      await secureStorage.clearTokens();
      delete apiClient.defaults.headers.common.Authorization;

      return { success: true };
    } catch (error) {
      console.error('Logout error', error);
      // Still clear local tokens even if error
      await secureStorage.clearTokens();
      delete apiClient.defaults.headers.common.Authorization;
      return { success: true };
    }
  },

  /**
   * Fetch current user profile
   */
  async getCurrentUser() {
    try {
      const response = await apiClient.get('/auth/me');
      return {
        success: true,
        user: response.data.user,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to fetch user profile.',
      };
    }
  },

  /**
   * Check if user is logged in
   */
  async isLoggedIn() {
    try {
      const accessToken = await secureStorage.getAccessToken();
      return !!accessToken;
    } catch (error) {
      return false;
    }
  },

  /**
   * Get stored user data locally (without API call)
   */
  async getStoredUser() {
    try {
      return await secureStorage.getUser();
    } catch (error) {
      return null;
    }
  },
};

export default authService;
