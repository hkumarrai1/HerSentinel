import React, { useContext, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
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

const RegisterScreen = ({ navigation }) => {
  const { register, error, clearError } = useContext(AuthContext);
  const { theme } = useAppTheme();
  const globalStyles = useMemo(() => createGlobalStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState('USER');
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (error) {
      setLocalError(error);
      clearError();
    }
  }, [error, clearError]);

  const validateForm = () => {
    if (!name.trim()) {
      setLocalError('Name is required');
      return false;
    }
    if (!email.trim()) {
      setLocalError('Email is required');
      return false;
    }
    if (!password || password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return false;
    }
    if (!/[A-Z]/.test(password)) {
      setLocalError('Password must contain an uppercase letter');
      return false;
    }
    if (!/[a-z]/.test(password)) {
      setLocalError('Password must contain a lowercase letter');
      return false;
    }
    if (!/[0-9]/.test(password)) {
      setLocalError('Password must contain a number');
      return false;
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      setLocalError('Password must contain a special character');
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    setLocalError('');
    setSuccessMsg('');

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    const result = await register(name, email, password, phone, selectedRole);
    setIsLoading(false);

    if (!result?.success) {
      setLocalError(result?.message || 'Registration failed');
    } else {
      setSuccessMsg(result.message || 'Account created! You can now login.');
      setTimeout(() => {
        navigation.navigate('Login');
      }, 2000);
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
              <Text style={styles.brandBadgeIcon}>✨</Text>
              <Text style={styles.brandBadgeText}>Create your profile</Text>
            </View>
            <Text style={styles.title}>Join HerSentinel.</Text>
            <Text style={styles.subtitle}>
              Build a secure profile for SOS alerts, guardians, and live safety
              monitoring.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.cardKicker}>Start here</Text>
            <Text style={styles.cardTitle}>Create account</Text>
            <Text style={styles.cardSubtitle}>
              Set up your details once and choose the account type that fits you.
            </Text>

            {localError ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{localError}</Text>
              </View>
            ) : null}

            {successMsg ? (
              <View style={styles.successContainer}>
                <Text style={styles.successText}>{successMsg}</Text>
              </View>
            ) : null}

            <View style={styles.roleSection}>
              <Text style={styles.roleHeading}>Choose account type</Text>

              <TouchableOpacity
                style={[
                  styles.roleCard,
                  selectedRole === 'USER' && styles.roleCardActive,
                ]}
                onPress={() => setSelectedRole('USER')}
                disabled={isLoading}
              >
                <View style={styles.roleCardTopRow}>
                  <Text
                    style={[
                      styles.roleTitle,
                      selectedRole === 'USER' && styles.roleTitleActive,
                    ]}
                  >
                    User
                  </Text>
                  <Text style={styles.roleBadge}>Recommended</Text>
                </View>
                <Text style={styles.roleSubtitle}>
                  Create SOS alerts, add guardians, and share safety updates.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleCard,
                  selectedRole === 'GUARDIAN' && styles.roleCardActive,
                ]}
                onPress={() => setSelectedRole('GUARDIAN')}
                disabled={isLoading}
              >
                <Text
                  style={[
                    styles.roleTitle,
                    selectedRole === 'GUARDIAN' && styles.roleTitleActive,
                  ]}
                >
                  Guardian
                </Text>
                <Text style={styles.roleSubtitle}>
                  Track linked users, review evidence, and respond to alerts.
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Full name</Text>
              <TextInput
                style={[globalStyles.input, styles.fieldInput]}
                placeholder="Your name"
                placeholderTextColor={theme.colors.textSecondary}
                value={name}
                onChangeText={setName}
                editable={!isLoading}
              />
            </View>

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
                  placeholder="Create a strong password"
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
              <Text style={styles.passwordHint}>
                Use 8+ characters with upper, lower, number, and symbol.
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Phone number</Text>
              <TextInput
                style={[globalStyles.input, styles.fieldInput]}
                placeholder="Optional"
                keyboardType="phone-pad"
                placeholderTextColor={theme.colors.textSecondary}
                value={phone}
                onChangeText={setPhone}
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity
              style={[
                globalStyles.buttonBase,
                globalStyles.buttonPrimary,
                styles.primaryButton,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <Text style={globalStyles.buttonTextPrimary}>Create account</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Login')}
                disabled={isLoading}
              >
                <Text style={styles.footerLink}>Login</Text>
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
  successContainer: {
    backgroundColor: theme.colors.success + '20',
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.success,
  },
  successText: {
    ...theme.typography.small,
    color: theme.colors.success,
  },
  roleSection: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  roleHeading: {
    ...theme.typography.small,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  roleCard: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  roleCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '10',
  },
  roleCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  roleBadge: {
    ...theme.typography.small,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  roleTitle: {
    ...theme.typography.body,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  roleTitleActive: {
    color: theme.colors.primary,
  },
  roleSubtitle: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
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
  passwordHint: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    marginTop: 6,
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

export default RegisterScreen;
