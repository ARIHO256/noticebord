import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { Appearance, ColorSchemeName, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme, lightTheme, darkTheme } from '../theme';

type Mode = 'light' | 'dark' | 'system';

type ThemeContextType = {
  theme: Theme;
  mode: Mode;
  isDark: boolean;
  setMode: (m: Mode) => Promise<void>;
  ready: boolean; // true once preference is hydrated from storage
};

const STORAGE_KEY = 'ui.theme.mode';

const defaultValue: ThemeContextType = {
  theme: lightTheme,
  mode: 'system',
  isDark: false,
  setMode: async () => {},
  ready: true,
};

const Ctx = createContext<ThemeContextType>(defaultValue);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modePreference, setModePreference] = useState<Mode>('system');
  const [ready, setReady] = useState(false);
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());

  // Keep system scheme in sync
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystemScheme(colorScheme));
    return () => sub.remove();
  }, []);

  // Hydrate saved preference once
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setModePreference(stored);
        }
      } catch (e) {
        if (__DEV__) console.warn('ThemeProvider: failed to read storage', e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const handleSetMode = useCallback(async (m: Mode) => {
    setModePreference(m);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, m);
    } catch (e) {
      if (__DEV__) console.warn('ThemeProvider: failed to write storage', e);
    }
  }, []);

  // Resolve final scheme
  const effectiveScheme: 'light' | 'dark' = useMemo(() => {
    const resolved = modePreference === 'system' ? systemScheme : modePreference;
    // treat null/undefined as light on web/older Androids
    return resolved === 'dark' ? 'dark' : 'light';
  }, [modePreference, systemScheme]);

  const theme = effectiveScheme === 'dark' ? darkTheme : lightTheme;

  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      mode: modePreference,
      isDark: effectiveScheme === 'dark',
      setMode: handleSetMode,
      ready,
    }),
    [theme, modePreference, effectiveScheme, handleSetMode, ready]
  );

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('ThemeProvider', { modePreference, systemScheme, ready, scheme: effectiveScheme });
  }

  // Optional: while not ready, you could return a splash to avoid flicker
  // if (!ready) return null;

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(Ctx);
  const theme = ctx?.theme ?? defaultValue.theme;
  const mode = ctx?.mode ?? defaultValue.mode;
  const isDark = ctx?.isDark ?? (theme === darkTheme);
  const setMode = ctx?.setMode ?? defaultValue.setMode;
  const ready = ctx?.ready ?? defaultValue.ready;
  if (!ctx?.theme?.colors && __DEV__) {
    console.warn('ThemeContext: missing colors, using default theme');
  }
  return { theme, mode, isDark, setMode, ready };
};
