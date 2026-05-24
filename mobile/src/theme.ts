export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const typography = {
  title: 22,
  subtitle: 16,
  body: 14,
};

export type Theme = {
  colors: {
    background: string;
    backgroundAlt: string;
    card: string;
    surface: string;
    surfaceMuted: string;
    text: string;
    muted: string;
    border: string;
    shadow: string;
    primary: string;
    primaryContrast: string;
    accent: string;
    accentContrast: string;
    success: string;
    warning: string;
    danger: string;
  };
  spacing: typeof spacing;
  typography: typeof typography;
  fonts: {
    regular: string;
    semibold: string;
    title: string;
  };
};

export const lightTheme: Theme = {
  colors: {
    background: '#F0F2F5', // Facebook background
    backgroundAlt: '#E4E6EB',
    card: '#FFFFFF', // Facebook card white
    surface: '#F0F2F5',
    surfaceMuted: '#E4E6EB',
    text: '#050505', // Facebook text
    muted: '#65676B', // Facebook gray
    border: '#E4E6EB', // Facebook border
    shadow: 'rgba(0,0,0,0.1)',
    primary: '#1877F2', // Facebook blue
    primaryContrast: '#FFFFFF',
    accent: '#F02849', // Facebook red
    accentContrast: '#FFFFFF',
    success: '#42B72A', // Facebook green
    warning: '#F7B928',
    danger: '#F02849',
  },
  spacing,
  typography,
  fonts: {
    regular: 'Inter_400Regular',
    semibold: 'Inter_600SemiBold',
    title: 'Domine_700Bold',
  },
};

export const darkTheme: Theme = {
  colors: {
    background: '#18191A', // Facebook dark background
    backgroundAlt: '#242526',
    card: '#242526', // Facebook dark card
    surface: '#18191A',
    surfaceMuted: '#3A3B3C',
    text: '#E4E6EB', // Facebook dark text
    muted: '#B0B3B8', // Facebook dark muted
    border: '#3A3B3C', // Facebook dark border
    shadow: 'rgba(0,0,0,0.3)',
    primary: '#1877F2', // Keep Facebook blue
    primaryContrast: '#FFFFFF',
    accent: '#F02849', // Facebook red
    accentContrast: '#FFFFFF',
    success: '#42B72A', // Facebook green
    warning: '#F7B928',
    danger: '#F02849',
  },
  spacing,
  typography,
  fonts: {
    regular: 'Inter_400Regular',
    semibold: 'Inter_600SemiBold',
    title: 'Domine_700Bold',
  },
};

