export const colors = {
  background: "#0b0f14",
  backgroundAlt: "#10151c",
  surface: "#131923",
  surfaceElevated: "#171f2b",
  surfaceSoft: "#1b2430",
  border: "#273244",
  textPrimary: "#e6edf3",
  textSecondary: "#9aa7b4",
  textMuted: "#6f7d8b",
  accent: "#4ea1ff",
  accentSoft: "#1b4f8a",
  success: "#32d583",
  warning: "#f5a524",
  danger: "#ff6b6b",
  purple: "#8b8cfb",
  green: "#2bd576",
  teal: "#31c4b7",
  codeBackground: "#0d1117",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const radii = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
};

export const typography = {
  title: 28,
  heading: 20,
  subheading: 16,
  body: 14,
  small: 12,
};

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  } as const,
};
