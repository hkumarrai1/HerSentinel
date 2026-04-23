import React, { useContext, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import EmergencyContext from '../context/EmergencyContext';
import { createGlobalStyles } from '../styles/globalStyles';
import { useAppTheme } from '../context/ThemeContext';
import emergencyService from '../services/emergencyService';
import locationService from '../services/locationService';
import { useEmergencyTrigger } from '../hooks/useEmergencyTrigger';

const HomeScreen = ({ navigation }) => {
  const { user, logout } = useContext(AuthContext);
  const emergencyContext = useContext(EmergencyContext);
  const { isEmergencyModeOn, toggleEmergencyMode } = emergencyContext;
  const { theme, mode, toggleTheme } = useAppTheme();
  const globalStyles = useMemo(() => createGlobalStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isSafetyModeActive, setIsSafetyModeActive] = useState(false);
  const [isTriggeringEmergency, setIsTriggeringEmergency] = useState(false);
  const triggerSOSRef = useRef(null);

  // Setup emergency trigger hook (shake & voice detection)
  useEmergencyTrigger(triggerType => {
    console.log('🚨 Auto-SOS triggered by:', triggerType);
    if (triggerSOSRef.current) {
      triggerSOSRef.current();
    }
  }, isEmergencyModeOn);

  const handleLogout = async () => {
    await logout();
  };

  const handleTriggerEmergency = async () => {
    if (!isSafetyModeActive) {
      Alert.alert(
        'Enable Safety Mode',
        'Turn on Safety Mode before triggering SOS.',
      );
      return;
    }

    setIsTriggeringEmergency(true);

    const locationResult = await locationService.getCurrentLocation();
    const emergencyLocation = locationResult.success
      ? {
          ...locationResult.location,
          address: 'Live device GPS capture',
        }
      : undefined;

    if (!locationResult.success && locationResult.code === 1) {
      Alert.alert(
        'Location Permission Needed',
        'SOS was triggered, but allow location permission to share your exact live position with guardians.',
      );
    } else if (!locationResult.success) {
      console.warn(
        '⚠️ Initial location capture failed, continuing SOS with live sync:',
        locationResult.message,
      );
    }

    const result = await emergencyService.triggerEmergency(emergencyLocation);

    setIsTriggeringEmergency(false);

    if (!result.success) {
      Alert.alert(
        'Unable to Trigger SOS',
        result.message || 'Please try again',
      );
      return;
    }

    navigation.navigate('EmergencyActive', { event: result.event });
  };

  // Store trigger function in ref for use by auto-trigger
  triggerSOSRef.current = handleTriggerEmergency;

  const userName = user?.name || 'User';

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      <ScrollView
        style={globalStyles.container}
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.backdrop}>
          <View style={styles.backdropGlowTop} />
          <View style={styles.backdropGlowBottom} />
        </View>

        <View style={[globalStyles.section, styles.topBar]}>
          <View style={styles.brandPill}>
            <Text style={styles.brandPillText}>Personal Safety</Text>
          </View>
          <Text style={styles.pageTitle}>Stay Safe, {userName}</Text>
          <Text style={styles.pageSubtitle}>
            Keep your emergency controls ready and your guardians connected.
          </Text>

          <View style={styles.topActionsRow}>
            <TouchableOpacity
              style={[
                globalStyles.buttonBase,
                globalStyles.buttonOutline,
                styles.topActionButton,
              ]}
              onPress={toggleTheme}
            >
              <Text style={styles.topActionText}>
                {mode === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                globalStyles.buttonBase,
                globalStyles.buttonOutline,
                styles.topActionButton,
              ]}
              onPress={() => navigation.navigate('Settings')}
            >
              <Text style={styles.topActionText}>Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[globalStyles.buttonBase, styles.logoutTopButton]}
              onPress={handleLogout}
            >
              <Text style={styles.logoutTopText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View
          style={[globalStyles.card, globalStyles.section, styles.heroCard]}
        >
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: isSafetyModeActive
                    ? theme.colors.success
                    : theme.colors.statusInactive,
                },
              ]}
            />
            <Text style={styles.statusText}>
              Safety Mode {isSafetyModeActive ? 'Active' : 'Inactive'}
            </Text>
          </View>

          <Text style={styles.heroTitle}>Protection Layer</Text>
          <Text style={styles.heroSubText}>
            Keep live safeguards ready before stepping out.
          </Text>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Enable Safety Mode</Text>
            <Switch
              value={isSafetyModeActive}
              onValueChange={setIsSafetyModeActive}
              trackColor={{
                false: theme.colors.border,
                true: theme.colors.success,
              }}
              thumbColor={theme.colors.white}
            />
          </View>
          <View style={styles.cueRow}>
            <Text style={styles.securityCue}>🔒 Protected</Text>
            <Text style={styles.securityCue}>🛡️ Encryption enabled</Text>
          </View>
        </View>

        {/* Emergency Mode Section */}
        <View
          style={[
            globalStyles.card,
            globalStyles.section,
            styles.emergencyModeCard,
          ]}
        >
          <View style={styles.emergencyModeHeader}>
            <Text style={styles.emergencyModeTitle}>
              🚨 Emergency Mode{' '}
              <Text
                style={{
                  color: isEmergencyModeOn
                    ? theme.colors.accentEmergency
                    : theme.colors.textSecondary,
                }}
              >
                {isEmergencyModeOn ? '(ON)' : '(OFF)'}
              </Text>
            </Text>
          </View>

          <Text style={styles.emergencyModeDescription}>
            When ON: Shake your phone 4-5 times or say "help" 4-5 times to
            automatically trigger SOS
          </Text>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Enable Emergency Mode</Text>
            <Switch
              value={isEmergencyModeOn}
              onValueChange={enabled => {
                toggleEmergencyMode(enabled);
              }}
              trackColor={{
                false: theme.colors.border,
                true: theme.colors.accentEmergency,
              }}
              thumbColor={theme.colors.white}
            />
          </View>

          {isEmergencyModeOn && (
            <View style={styles.emergencyModeCues}>
              <Text style={styles.emergencyModeCue}>
                📱 Shake Detection: Active
              </Text>
              <Text style={styles.emergencyModeCue}>
                🎙️ Voice Detection: Active
              </Text>
              <Text style={styles.emergencyModeWarning}>
                ⚠️ Background monitoring enabled
              </Text>
            </View>
          )}
        </View>

        <View style={styles.sosSection}>
          <TouchableOpacity
            style={[
              styles.sosButton,
              (!isSafetyModeActive || isTriggeringEmergency) &&
                styles.sosButtonDisabled,
            ]}
            onPress={handleTriggerEmergency}
            disabled={!isSafetyModeActive || isTriggeringEmergency}
          >
            {isTriggeringEmergency ? (
              <ActivityIndicator color={theme.colors.white} size="large" />
            ) : (
              <View style={styles.sosLabelWrap}>
                <Text style={styles.sosText}>SOS</Text>
                <Text style={styles.sosHintText}>Tap in emergency</Text>
              </View>
            )}
          </TouchableOpacity>
          {!isSafetyModeActive ? (
            <Text style={styles.sosDisabledHint}>
              Enable Safety Mode to activate SOS
            </Text>
          ) : null}
        </View>

        <View style={[globalStyles.card, styles.actionsSection]}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity
            style={[
              globalStyles.buttonBase,
              globalStyles.buttonPrimary,
              styles.actionButton,
            ]}
            onPress={() => navigation.navigate('GuardianManagement')}
          >
            <Text style={globalStyles.buttonTextPrimary}>Manage Guardians</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              globalStyles.buttonBase,
              globalStyles.buttonOutline,
              styles.actionButton,
            ]}
            onPress={() => navigation.navigate('SosTimeline')}
          >
            <Text style={globalStyles.buttonTextOutline}>SOS Timeline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              globalStyles.buttonBase,
              globalStyles.buttonOutline,
              styles.actionButton,
            ]}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={globalStyles.buttonTextOutline}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = appTheme =>
  StyleSheet.create({
    pageContent: {
      paddingBottom: appTheme.spacing.xl,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    backdropGlowTop: {
      position: 'absolute',
      top: -55,
      right: -35,
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: appTheme.colors.primary + '14',
    },
    backdropGlowBottom: {
      position: 'absolute',
      bottom: 10,
      left: -70,
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: appTheme.colors.accentEmergency + '12',
    },
    topBar: {
      marginBottom: appTheme.spacing.lg,
    },
    brandPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: appTheme.radius.round,
      backgroundColor: appTheme.colors.card,
      borderWidth: 1,
      borderColor: appTheme.colors.border + '80',
      marginBottom: appTheme.spacing.sm,
    },
    brandPillText: {
      ...appTheme.typography.small,
      color: appTheme.colors.textSecondary,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    pageTitle: {
      fontSize: 34,
      lineHeight: 40,
      fontWeight: '800',
      color: appTheme.colors.textPrimary,
      letterSpacing: -0.3,
      flexShrink: 1,
    },
    pageSubtitle: {
      ...appTheme.typography.body,
      color: appTheme.colors.textSecondary,
      marginTop: 6,
      marginBottom: appTheme.spacing.sm,
      maxWidth: 340,
    },
    topActionsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
      marginTop: appTheme.spacing.sm,
    },
    topActionButton: {
      minWidth: 108,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    topActionText: {
      ...appTheme.typography.small,
      color: appTheme.colors.primary,
      fontWeight: '700',
    },
    logoutTopButton: {
      minWidth: 92,
      paddingVertical: 8,
      paddingHorizontal: 14,
      backgroundColor: appTheme.colors.accentEmergency + '18',
      borderRadius: appTheme.radius.round,
    },
    logoutTopText: {
      ...appTheme.typography.small,
      color: appTheme.colors.accentEmergency,
      fontWeight: '700',
    },
    heroCard: {
      backgroundColor: appTheme.colors.card,
      borderColor: appTheme.colors.border + '80',
    },
    heroTitle: {
      ...appTheme.typography.headingMedium,
      marginTop: 10,
      color: appTheme.colors.textPrimary,
    },
    heroSubText: {
      ...appTheme.typography.small,
      marginTop: 4,
      marginBottom: 6,
      color: appTheme.colors.textSecondary,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusDot: {
      width: 12,
      height: 12,
      borderRadius: 999,
      marginRight: appTheme.spacing.xs,
    },
    statusText: {
      ...appTheme.typography.small,
      fontWeight: '700',
      color: appTheme.colors.textPrimary,
    },
    toggleRow: {
      marginTop: appTheme.spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    toggleLabel: {
      ...appTheme.typography.body,
      color: appTheme.colors.textPrimary,
      fontWeight: '600',
    },
    cueRow: {
      marginTop: appTheme.spacing.sm,
      gap: 6,
    },
    securityCue: {
      ...appTheme.typography.small,
      color: appTheme.colors.textSecondary,
    },
    emergencyModeCard: {
      backgroundColor: appTheme.colors.accentEmergency + '08',
      borderColor: appTheme.colors.accentEmergency + '40',
      borderWidth: 1.5,
    },
    emergencyModeHeader: {
      marginBottom: appTheme.spacing.sm,
    },
    emergencyModeTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: appTheme.colors.textPrimary,
      letterSpacing: 0.3,
    },
    emergencyModeDescription: {
      ...appTheme.typography.small,
      color: appTheme.colors.textSecondary,
      marginBottom: appTheme.spacing.sm,
      lineHeight: 18,
    },
    emergencyModeCues: {
      marginTop: appTheme.spacing.sm,
      paddingTop: appTheme.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: appTheme.colors.border,
    },
    emergencyModeCue: {
      ...appTheme.typography.small,
      color: appTheme.colors.success,
      fontWeight: '600',
      marginBottom: 6,
    },
    emergencyModeWarning: {
      ...appTheme.typography.small,
      color: appTheme.colors.accentEmergency,
      fontWeight: '600',
      marginTop: 6,
    },
    sosSection: {
      alignItems: 'center',
      marginBottom: appTheme.spacing.lg,
    },
    sosButton: {
      width: appTheme.sizes.sosDiameter,
      height: appTheme.sizes.sosDiameter,
      borderRadius: appTheme.sizes.sosDiameter / 2,
      backgroundColor: appTheme.colors.accentEmergency,
      alignItems: 'center',
      justifyContent: 'center',
      ...appTheme.shadow,
      borderWidth: 6,
      borderColor: appTheme.colors.accentEmergency + '35',
      overflow: 'hidden',
    },
    sosButtonDisabled: {
      opacity: 0.48,
    },
    sosLabelWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      paddingHorizontal: 10,
    },
    sosText: {
      color: appTheme.colors.white,
      fontSize: 34,
      fontWeight: '800',
    },
    sosHintText: {
      ...appTheme.typography.small,
      marginTop: 2,
      color: '#FFECEC',
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: 16,
      maxWidth: 96,
    },
    sosDisabledHint: {
      ...appTheme.typography.small,
      marginTop: 10,
      color: appTheme.colors.textSecondary,
      textAlign: 'center',
    },
    actionsSection: {
      marginTop: 'auto',
      marginBottom: appTheme.spacing.md,
      borderColor: appTheme.colors.border + '80',
    },
    sectionTitle: {
      ...appTheme.typography.headingMedium,
      marginBottom: appTheme.spacing.md,
      color: appTheme.colors.textPrimary,
    },
    actionButton: {
      marginBottom: appTheme.spacing.sm,
    },
  });

export default HomeScreen;
