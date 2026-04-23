import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { EmergencyProvider } from './src/context/EmergencyContext';
import { ThemeProvider, useAppTheme } from './src/context/ThemeContext';
import emergencyService from './src/services/emergencyService';

const AppShell = () => {
  const { navigationTheme } = useAppTheme();

  return (
    <NavigationContainer theme={navigationTheme}>
      <AppNavigator />
    </NavigationContainer>
  );
};

const App = () => {
  useEffect(() => {
    emergencyService.flushOfflineQueue().catch(() => {
      // noop
    });

    const flushInterval = setInterval(() => {
      emergencyService.flushOfflineQueue().catch(() => {
        // noop
      });
    }, 12000);

    return () => {
      clearInterval(flushInterval);
    };
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <EmergencyProvider>
          <AppShell />
        </EmergencyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
