import colors from './colors';

const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  round: 999,
};

const typography = {
  display: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  headingLarge: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headingMedium: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
    color: colors.textPrimary,
  },
  small: {
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  button: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 0.2,
  },
};

const sizes = {
  buttonVerticalPadding: 13,
  sosDiameter: 128,
};

const shadow = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 0.09,
  shadowRadius: 12,
  elevation: 4,
};

const theme = {
  colors,
  spacing,
  radius,
  typography,
  sizes,
  shadow,
};

export default theme;
