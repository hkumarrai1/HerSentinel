import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVICE_NAME = 'HerSentinel';
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user_data';
const THEME_MODE_KEY = 'theme_mode';

const ACCESS_TOKEN_SERVICE = `${SERVICE_NAME}.accessToken`;
const REFRESH_TOKEN_SERVICE = `${SERVICE_NAME}.refreshToken`;
const USER_SERVICE = `${SERVICE_NAME}.user`;

const FALLBACK_ACCESS_TOKEN_KEY = `${SERVICE_NAME}_${ACCESS_TOKEN_KEY}`;
const FALLBACK_REFRESH_TOKEN_KEY = `${SERVICE_NAME}_${REFRESH_TOKEN_KEY}`;
const FALLBACK_USER_KEY = `${SERVICE_NAME}_${USER_KEY}`;

/**
 * Storage Strategy:
 * - DEVELOPMENT: Keychain first, fallback to AsyncStorage (for easier testing)
 * - PRODUCTION: Keychain only, enforce secure storage (no fallback)
 */

const isProduction = !__DEV__;

const buildKeychainOptions = service => {
  const options = { service };

  if (Keychain.SecurityLevel && Keychain.SecurityLevel.VERY_STRONG) {
    options.securityLevel = Keychain.SecurityLevel.VERY_STRONG;
  }

  return options;
};

const secureStorage = {
  /**
   * Store tokens securely using native Keystore (Android) or Keychain (iOS)
   * In development: Falls back to AsyncStorage if Keychain is unavailable
   * In production: Enforces Keychain only for security
   */
  async saveTokens(accessToken, refreshToken) {
    try {
      // Try Keychain first
      try {
        await Keychain.setGenericPassword(
          ACCESS_TOKEN_KEY,
          accessToken,
          buildKeychainOptions(ACCESS_TOKEN_SERVICE),
        );
        await Keychain.setGenericPassword(
          REFRESH_TOKEN_KEY,
          refreshToken,
          buildKeychainOptions(REFRESH_TOKEN_SERVICE),
        );

        console.log('✅ Tokens saved securely via Keychain');
        return;
      } catch (keychainError) {
        // Production: enforce Keychain, do NOT fallback
        if (isProduction) {
          console.error(
            '❌ PRODUCTION: Keychain failed. Secure storage is mandatory in production.',
            keychainError,
          );
          throw new Error('Secure token storage unavailable in production');
        }

        // Development: allow AsyncStorage fallback
        console.warn(
          '⚠️  DEV: Keychain unavailable, using AsyncStorage fallback',
          keychainError,
        );
        await AsyncStorage.setItem(FALLBACK_ACCESS_TOKEN_KEY, accessToken);
        await AsyncStorage.setItem(FALLBACK_REFRESH_TOKEN_KEY, refreshToken);
      }
    } catch (error) {
      console.error('Failed to save tokens', error);
      throw error;
    }
  },

  /**
   * Retrieve access token from secure storage
   */
  async getAccessToken() {
    try {
      // Try Keychain first
      try {
        const credentials = await Keychain.getGenericPassword({
          service: ACCESS_TOKEN_SERVICE,
        });

        if (credentials && credentials.password) {
          return credentials.password;
        }
      } catch (keychainError) {
        // Production: do NOT fallback
        if (isProduction) {
          console.error(
            '❌ PRODUCTION: Unable to retrieve token from secure storage',
            keychainError,
          );
          throw new Error('Secure token retrieval failed in production');
        }

        // Development: fallback to AsyncStorage
        console.warn('⚠️  DEV: Retrieving token from AsyncStorage fallback');
        const token = await AsyncStorage.getItem(FALLBACK_ACCESS_TOKEN_KEY);
        return token;
      }

      // In dev, try fallback key if no Keychain value exists
      if (!isProduction) {
        return await AsyncStorage.getItem(FALLBACK_ACCESS_TOKEN_KEY);
      }

      return null;
    } catch (error) {
      console.error('Failed to retrieve access token', error);
      if (isProduction) throw error;
      return null;
    }
  },

  /**
   * Retrieve refresh token from secure storage
   */
  async getRefreshToken() {
    try {
      // Try Keychain first
      try {
        const credentials = await Keychain.getGenericPassword({
          service: REFRESH_TOKEN_SERVICE,
        });

        if (credentials && credentials.password) {
          return credentials.password;
        }
      } catch (keychainError) {
        // Production: do NOT fallback
        if (isProduction) {
          console.error(
            '❌ PRODUCTION: Unable to retrieve refresh token from secure storage',
            keychainError,
          );
          throw new Error('Secure token retrieval failed in production');
        }

        // Development: fallback to AsyncStorage
        console.warn(
          '⚠️  DEV: Retrieving refresh token from AsyncStorage fallback',
        );
        const token = await AsyncStorage.getItem(FALLBACK_REFRESH_TOKEN_KEY);
        return token;
      }

      // In dev, try fallback key if no Keychain value exists
      if (!isProduction) {
        return await AsyncStorage.getItem(FALLBACK_REFRESH_TOKEN_KEY);
      }

      return null;
    } catch (error) {
      console.error('Failed to retrieve refresh token', error);
      if (isProduction) throw error;
      return null;
    }
  },

  /**
   * Clear all tokens from secure storage
   */
  async clearTokens() {
    try {
      // Try Keychain first
      try {
        await Keychain.resetGenericPassword({
          service: ACCESS_TOKEN_SERVICE,
        });
        await Keychain.resetGenericPassword({
          service: REFRESH_TOKEN_SERVICE,
        });
        await Keychain.resetGenericPassword({
          service: USER_SERVICE,
        });
      } catch (keychainError) {
        // Production: do NOT fallback
        if (isProduction) {
          console.error(
            '❌ PRODUCTION: Unable to clear tokens from secure storage',
            keychainError,
          );
          throw new Error('Secure token clearing failed in production');
        }

        // Development: fallback to AsyncStorage
        console.warn('⚠️  DEV: Clearing tokens from AsyncStorage fallback');
      }

      if (!isProduction) {
        await AsyncStorage.removeItem(FALLBACK_ACCESS_TOKEN_KEY);
        await AsyncStorage.removeItem(FALLBACK_REFRESH_TOKEN_KEY);
        await AsyncStorage.removeItem(FALLBACK_USER_KEY);
      }
    } catch (error) {
      console.error('Failed to clear tokens', error);
      if (isProduction) throw error;
    }
  },

  /**
   * Save user profile data
   */
  async saveUser(user) {
    try {
      // Try Keychain first
      try {
        await Keychain.setGenericPassword(
          USER_KEY,
          JSON.stringify(user),
          buildKeychainOptions(USER_SERVICE),
        );
      } catch (keychainError) {
        // Production: do NOT fallback
        if (isProduction) {
          console.error(
            '❌ PRODUCTION: Unable to save user data securely',
            keychainError,
          );
          throw new Error('Secure user data storage failed in production');
        }

        // Development: fallback to AsyncStorage
        console.warn('⚠️  DEV: Saving user data to AsyncStorage fallback');
        await AsyncStorage.setItem(FALLBACK_USER_KEY, JSON.stringify(user));
      }
    } catch (error) {
      console.error('Failed to save user data', error);
      if (isProduction) throw error;
    }
  },

  /**
   * Retrieve user profile data
   */
  async getUser() {
    try {
      // Try Keychain first
      try {
        const credentials = await Keychain.getGenericPassword({
          service: USER_SERVICE,
        });

        if (credentials && credentials.password) {
          return JSON.parse(credentials.password);
        }
      } catch (keychainError) {
        // Production: do NOT fallback
        if (isProduction) {
          console.error(
            '❌ PRODUCTION: Unable to retrieve user data from secure storage',
            keychainError,
          );
          throw new Error('Secure user data retrieval failed in production');
        }

        // Development: fallback to AsyncStorage
        console.warn('⚠️  DEV: Retrieving user from AsyncStorage fallback');
        const userData = await AsyncStorage.getItem(FALLBACK_USER_KEY);
        return userData ? JSON.parse(userData) : null;
      }

      // In dev, try fallback key if no Keychain value exists
      if (!isProduction) {
        const userData = await AsyncStorage.getItem(FALLBACK_USER_KEY);
        return userData ? JSON.parse(userData) : null;
      }

      return null;
    } catch (error) {
      console.error('Failed to retrieve user data', error);
      if (isProduction) throw error;
      return null;
    }
  },

  async saveThemeMode(mode) {
    try {
      await AsyncStorage.setItem(THEME_MODE_KEY, mode);
    } catch (error) {
      console.error('Failed to save theme mode', error);
      throw error;
    }
  },

  async getThemeMode() {
    try {
      return await AsyncStorage.getItem(THEME_MODE_KEY);
    } catch (error) {
      console.error('Failed to retrieve theme mode', error);
      return null;
    }
  },
};

/**
 * PRODUCTION SETUP CHECKLIST
 *
 * For production builds, ensure:
 * 1. react-native-keychain is properly linked:
 *    - Android: AndroidManifest.xml has INTERNET permission, build.gradle configured
 *    - iOS: ios/Pods/RNKeychain linked with Xcode
 *
 * 2. Rebuild native modules:
 *    - npx react-native run-android --reset-cache
 *    - cd ios && pod install && cd ..
 *
 * 3. Test secure storage before release:
 *    - Build release APK/IPA
 *    - Register and login to verify tokens are stored securely
 *    - Check device secure storage (Android: adb shell dumpsys, iOS: Keychain)
 *
 * 4. If Keychain fails in production:
 *    - The app will throw errors (not fallback to AsyncStorage)
 *    - This prevents accidentally storing unencrypted tokens
 */

export default secureStorage;
