import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'hotel-booking-theme';
const ThemeContext = createContext(null);

function readInitialTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEY);
  return savedTheme === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readInitialTheme);

  useEffect(() => {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('theme-dark', isDark);
    document.body.classList.toggle('theme-dark', isDark);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    isDark: theme === 'dark',
    setTheme,
    toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}
