import { StyleSheet } from 'react-native';
import theme from '../constants/theme';

const createGlobalStyles = appTheme =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: appTheme.colors.background,
    },
    container: {
      flex: 1,
      paddingHorizontal: appTheme.spacing.md,
      paddingTop: appTheme.spacing.md,
      backgroundColor: appTheme.colors.background,
    },
    section: {
      marginBottom: appTheme.spacing.lg,
    },
    card: {
      backgroundColor: appTheme.colors.card,
      borderRadius: appTheme.radius.md,
      borderWidth: 1,
      borderColor: appTheme.colors.border + '70',
      padding: appTheme.spacing.md,
      ...appTheme.shadow,
    },
    input: {
      backgroundColor: appTheme.colors.card,
      borderRadius: appTheme.radius.sm,
      borderWidth: 1,
      borderColor: appTheme.colors.border,
      paddingHorizontal: appTheme.spacing.md,
      paddingVertical: 13,
      color: appTheme.colors.textPrimary,
      fontSize: 16,
    },
    buttonBase: {
      borderRadius: appTheme.radius.sm,
      paddingVertical: appTheme.sizes.buttonVerticalPadding,
      paddingHorizontal: appTheme.spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonPrimary: {
      backgroundColor: appTheme.colors.primary,
      ...appTheme.shadow,
    },
    buttonDanger: {
      backgroundColor: appTheme.colors.accentEmergency,
      ...appTheme.shadow,
    },
    buttonOutline: {
      backgroundColor: appTheme.colors.card,
      borderWidth: 1,
      borderColor: appTheme.colors.primary + '55',
    },
    buttonTextPrimary: {
      ...appTheme.typography.button,
    },
    buttonTextOutline: {
      ...appTheme.typography.button,
      color: appTheme.colors.primary,
    },
  });

const globalStyles = createGlobalStyles(theme);

export { createGlobalStyles };
export default globalStyles;
