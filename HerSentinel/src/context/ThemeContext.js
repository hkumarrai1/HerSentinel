import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationLightTheme,
} from '@react-navigation/native';
import baseTheme from '../constants/theme';
import { darkPalette, lightPalette } from '../constants/colorPalettes';
import secureStorage from '../services/secureStorage';

const ThemeContext = createContext(null);

const buildNavigationTheme = (palette, isDarkMode) => ({
  ...(isDarkMode ? NavigationDarkTheme : NavigationLightTheme),
  colors: {
    ...(isDarkMode ? NavigationDarkTheme.colors : NavigationLightTheme.colors),
    background: palette.background,
    card: palette.card,
    border: palette.border,
    primary: palette.primary,
    text: palette.textPrimary,
    notification: palette.accentEmergency,
  },
});

const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState(systemScheme === 'dark' ? 'dark' : 'light');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadThemeMode = async () => {
      try {
        const storedMode = await secureStorage.getThemeMode();
        if (isMounted && (storedMode === 'light' || storedMode === 'dark')) {
          setMode(storedMode);
        }
      } catch (error) {
        console.warn('Failed to load theme mode', error);
      } finally {
        if (isMounted) {
          setIsHydrated(true);
        }
      }
    };

    loadThemeMode();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    secureStorage.saveThemeMode(mode).catch(error => {
      console.warn('Failed to persist theme mode', error);
    });
  }, [mode, isHydrated]);

  const value = useMemo(() => {
    const palette = mode === 'dark' ? darkPalette : lightPalette;
    const theme = {
      ...baseTheme,
      colors: palette,
    };

    return {
      mode,
      isDarkMode: mode === 'dark',
      theme,
      navigationTheme: buildNavigationTheme(palette, mode === 'dark'),
      setThemeMode: nextMode => setMode(nextMode),
      toggleTheme: () =>
        setMode(previous => (previous === 'dark' ? 'light' : 'dark')),
    };
  }, [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

const useAppTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useAppTheme must be used within ThemeProvider');
  }

  return context;
};

export { ThemeProvider, useAppTheme };
