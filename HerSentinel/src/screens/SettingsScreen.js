import React, { useContext } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { createGlobalStyles } from '../styles/globalStyles';
import { useAppTheme } from '../context/ThemeContext';

const SettingsScreen = () => {
  const { logout } = useContext(AuthContext);
  const { theme, mode, toggleTheme } = useAppTheme();
  const globalStyles = React.useMemo(() => createGlobalStyles(theme), [theme]);
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      <View style={globalStyles.container}>
        <View style={globalStyles.section}>
          <Text style={theme.typography.headingLarge}>Settings</Text>
          <Text style={styles.subtitle}>Tune the app for the way you use it.</Text>
        </View>

        <View style={[globalStyles.card, styles.modeCard]}>
          <View style={styles.modeRow}>
            <View style={styles.modeCopy}>
              <Text style={theme.typography.headingMedium}>Appearance</Text>
              <Text style={styles.modeHint}>
                {mode === 'dark'
                  ? 'Dark mode is active for a low-glare look.'
                  : 'Light mode is active for bright, clean screens.'}
              </Text>
            </View>
            <Switch
              value={mode === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{
                false: theme.colors.border,
                true: theme.colors.primary,
              }}
              thumbColor={theme.colors.white}
            />
          </View>
        </View>

        <View style={[globalStyles.card, styles.listCard]}>
          <TouchableOpacity style={styles.listItem}>
            <Text style={theme.typography.body}>Account Info</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.listItem}>
            <Text style={theme.typography.body}>Change Password</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.listItemNoBorder}>
            <Text style={theme.typography.body}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            globalStyles.buttonBase,
            globalStyles.buttonOutline,
            styles.logoutButton,
          ]}
          onPress={logout}
        >
          <Text style={globalStyles.buttonTextOutline}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const createStyles = theme =>
  StyleSheet.create({
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  modeCard: {
    marginBottom: theme.spacing.md,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  modeCopy: {
    flex: 1,
  },
  modeHint: {
    ...theme.typography.small,
    marginTop: 6,
    color: theme.colors.textSecondary,
  },
  listCard: {
    paddingVertical: 0,
    marginBottom: theme.spacing.md,
  },
  listItem: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  listItemNoBorder: {
    paddingVertical: theme.spacing.sm,
  },
  logoutButton: {
    marginTop: theme.spacing.md,
  },
  });

export default SettingsScreen;
