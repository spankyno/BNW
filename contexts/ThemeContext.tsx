import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import Colors from '@/constants/colors';
import { ThemeColors } from '@/types/notes';

const THEME_KEY = '@notes_app_theme';

export const [ThemeProvider, useTheme] = createContextHook(() => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark') {
        setTheme(stored);
      }
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      AsyncStorage.setItem(THEME_KEY, next);
      return next;
    });
  }, []);

  const colors: ThemeColors = theme === 'light' ? Colors.light : Colors.dark;

  return { theme, toggleTheme, colors };
});
