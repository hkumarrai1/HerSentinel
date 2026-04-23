import React, { useContext, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { createGlobalStyles } from '../styles/globalStyles';
import { useAppTheme } from '../context/ThemeContext';

const LoginScreen = ({ navigation }) => {
  const { login, error, clearError } = useContext(AuthContext);
  const { theme } = useAppTheme();
  const globalStyles = useMemo(() => createGlobalStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (error) {
      setLocalError(error);
      clearError();
    }
  }, [error, clearError]);

  const handleLogin = async () => {
    setLocalError('');

    if (!email.trim()) {
      setLocalError('Email is required');
      return;
    }

    if (!password.trim()) {
      setLocalError('Password is required');
      return;
    }

    setIsLoading(true);
    const result = await login(email, password);
    setIsLoading(false);

    if (!result?.success) {
      setLocalError(result?.message || 'Login failed');
    }
  };

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flexOne}
          contentContainerStyle={styles.pageContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.backdrop}>
            <View style={styles.backdropGlowTop} />
            <View style={styles.backdropGlowBottom} />
          </View>

          <View style={styles.heroBlock}>
            <View style={styles.brandBadge}>
              <Text style={styles.brandBadgeIcon}>🛡️</Text>
              <Text style={styles.brandBadgeText}>HerSentinel</Text>
            </View>
            <Text style={styles.title}>Stay protected, stay connected.</Text>
            <Text style={styles.subtitle}>
              Log in to manage SOS alerts, guardian connections, and live safety
              updates.
            </Text>

            <View style={styles.heroPillsRow}>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>Fast SOS alerts</Text>
              </View>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>Live guardian sync</Text>
              </View>
            </View>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.cardKicker}>Secure sign-in</Text>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSubtitle}>
              Enter your credentials to continue to your dashboard.
            </Text>

            {localError ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{localError}</Text>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email address</Text>
              <TextInput
                style={[globalStyles.input, styles.fieldInput]}
                placeholder="name@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={theme.colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                editable={!isLoading}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[globalStyles.input, styles.passwordInput]}
                  placeholder="Enter your password"
                  secureTextEntry={!showPassword}
                  placeholderTextColor={theme.colors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword(previous => !previous)}
                  disabled={isLoading}
                >
                  <Text style={styles.passwordToggleText}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[
                globalStyles.buttonBase,
                globalStyles.buttonPrimary,
                styles.primaryButton,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <Text style={globalStyles.buttonTextPrimary}>Login</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>New to HerSentinel?</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Register')}
                disabled={isLoading}
              >
                <Text style={styles.footerLink}>Create account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = theme =>
  StyleSheet.create({
  flexOne: {
    flex: 1,
  },
  pageContent: {
    flexGrow: 1,
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropGlowTop: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: theme.colors.primary + '18',
  },
  backdropGlowBottom: {
    position: 'absolute',
    bottom: 20,
    left: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: theme.colors.accentEmergency + '14',
  },
  heroBlock: {
    marginBottom: theme.spacing.lg,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border + '80',
    marginBottom: theme.spacing.md,
  },
  brandBadgeIcon: {
    fontSize: 15,
  },
  brandBadgeText: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    letterSpacing: -0.4,
    maxWidth: 320,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    maxWidth: 320,
  },
  heroPillsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: theme.spacing.md,
  },
  heroPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.surfaceAlt,
  },
  heroPillText: {
    ...theme.typography.small,
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border + '70',
    ...theme.shadow,
  },
  cardKicker: {
    ...theme.typography.small,
    color: theme.colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cardTitle: {
    ...theme.typography.headingLarge,
    marginTop: 4,
  },
  cardSubtitle: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    marginTop: 6,
    marginBottom: theme.spacing.md,
  },
  errorContainer: {
    backgroundColor: theme.colors.dangerTint,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.accentEmergency,
  },
  errorText: {
    ...theme.typography.small,
    color: theme.colors.accentEmergency,
  },
  fieldGroup: {
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    fontWeight: '600',
  },
  fieldInput: {
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  passwordInput: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
  },
  passwordToggle: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border + '90',
    backgroundColor: theme.colors.card,
  },
  passwordToggleText: {
    ...theme.typography.small,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  primaryButton: {
    marginTop: theme.spacing.xs,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: theme.spacing.md,
  },
  footerText: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
  },
  footerLink: {
    ...theme.typography.small,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  });

export default LoginScreen;
