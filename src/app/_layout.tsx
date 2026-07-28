import { DefaultTheme, ThemeProvider, DarkTheme as NavDark } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { Colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const c = Colors[isDark ? 'dark' : 'light'];

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const navTheme = {
    ...(isDark ? NavDark : DefaultTheme),
    colors: {
      ...(isDark ? NavDark : DefaultTheme).colors,
      background: c.background,
      card: c.surface,
      text: c.text,
      primary: c.primary,
      border: c.border,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <AppTabs />
    </ThemeProvider>
  );
}
