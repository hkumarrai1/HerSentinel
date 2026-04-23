import React, { useMemo } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { createGlobalStyles } from '../styles/globalStyles';
import { useAppTheme } from '../context/ThemeContext';

const SafetyModeScreen = ({ navigation }) => {
  const { theme } = useAppTheme();
  const globalStyles = useMemo(() => createGlobalStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      <View style={globalStyles.container}>
        <View style={globalStyles.section}>
          <Text style={theme.typography.headingLarge}>Safety Mode</Text>
          <Text style={styles.subtitle}>
            Controlled protection is currently active.
          </Text>
        </View>

        <View style={[globalStyles.card, globalStyles.section]}>
          <Text style={theme.typography.headingMedium}>Status</Text>
          <View style={styles.statusRow}>
            <Text style={styles.activeIcon}>✅</Text>
            <Text style={styles.activeText}>Foreground service active</Text>
          </View>
          <Text style={styles.monitoringInfo}>
            HerSentinel is monitoring emergency triggers securely in the
            foreground.
          </Text>
          <View style={styles.cueRow}>
            <Text style={styles.securityCue}>🔒 Safety Mode active</Text>
            <Text style={styles.securityCue}>🛡️ Protected by Encryption</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[globalStyles.buttonBase, globalStyles.buttonPrimary]}
          onPress={() => navigation.goBack()}
        >
          <Text style={globalStyles.buttonTextPrimary}>Back to Dashboard</Text>
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  activeIcon: {
    fontSize: 18,
    marginRight: theme.spacing.xs,
  },
  activeText: {
    ...theme.typography.body,
    color: theme.colors.success,
    fontWeight: '600',
  },
  monitoringInfo: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  cueRow: {
    marginTop: theme.spacing.sm,
    gap: 6,
  },
  securityCue: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
  },
  });

export default SafetyModeScreen;
