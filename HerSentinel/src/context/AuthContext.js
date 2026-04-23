import React, { createContext, useState, useEffect } from 'react';
import authService from '../services/authService';
import secureStorage from '../services/secureStorage';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userToken, setUserToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadToken = async () => {
      try {
        const isLoggedIn = await authService.isLoggedIn();

        if (isLoggedIn) {
          const storedUser = await secureStorage.getUser();
          const accessToken = await secureStorage.getAccessToken();

          if (storedUser && accessToken) {
            setUser(storedUser);
            setUserToken(accessToken);
          }
        }
      } catch (e) {
        console.error('Error loading token', e);
        setError('Failed to restore session');
      }
      setIsLoading(false);
    };

    loadToken();
  }, []);

  const register = async (name, email, password, phone, role = 'USER') => {
    try {
      setError(null);
      const result = await authService.register(
        name,
        email,
        password,
        phone,
        role,
      );

      if (!result.success) {
        setError(result.message);
        return { success: false, message: result.message };
      }

      return { success: true, message: result.message };
    } catch (e) {
      const errorMsg = 'Registration failed. Please try again.';
      setError(errorMsg);
      return { success: false, message: errorMsg };
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      const result = await authService.login(email, password);

      if (!result.success) {
        setError(result.message);
        return { success: false, message: result.message };
      }

      // Set user and token from login response
      setUser(result.user);
      setUserToken(result.accessToken); // Use token from authService

      return { success: true };
    } catch (e) {
      const errorMsg = 'Login failed. Please try again.';
      setError(errorMsg);
      return { success: false, message: errorMsg };
    }
  };

  const logout = async () => {
    try {
      setError(null);
      await authService.logout();
      setUser(null);
      setUserToken(null);
    } catch (e) {
      console.error('Logout error', e);
      setUser(null);
      setUserToken(null);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userToken,
        isLoading,
        error,
        register,
        login,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
