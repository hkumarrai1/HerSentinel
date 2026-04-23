import React, { useContext } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';

import { AuthContext } from '../context/AuthContext';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import SafetyModeScreen from '../screens/SafetyModeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import GuardianManagementScreen from '../screens/GuardianManagementScreen';
import GuardianDashboardScreen from '../screens/GuardianDashboardScreen';
import GuardianLiveMapScreen from '../screens/GuardianLiveMapScreen';
import GuardianEvidenceFeedScreen from '../screens/GuardianEvidenceFeedScreen';
import GuardianMediaPlayerScreen from '../screens/GuardianMediaPlayerScreen';
import EmergencyActiveScreen from '../screens/EmergencyActiveScreen';
import SosTimelineScreen from '../screens/SosTimelineScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { userToken, isLoading, user } = useContext(AuthContext);
  const isGuardian = user?.role === 'GUARDIAN';

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {userToken ? (
        isGuardian ? (
          <>
            <Stack.Screen
              name="GuardianDashboard"
              component={GuardianDashboardScreen}
            />
            <Stack.Screen
              name="GuardianLiveMap"
              component={GuardianLiveMapScreen}
            />
            <Stack.Screen
              name="GuardianEvidenceFeed"
              component={GuardianEvidenceFeedScreen}
            />
            <Stack.Screen
              name="GuardianMediaPlayer"
              component={GuardianMediaPlayerScreen}
            />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="SafetyMode" component={SafetyModeScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen
              name="GuardianManagement"
              component={GuardianManagementScreen}
            />
            <Stack.Screen
              name="EmergencyActive"
              component={EmergencyActiveScreen}
            />
            <Stack.Screen name="SosTimeline" component={SosTimelineScreen} />
          </>
        )
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
