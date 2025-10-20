// Theme management utility
export type Theme = 'light' | 'dark';

const THEME_KEY = 'app-theme';

export const getStoredTheme = (): Theme => {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  // Default to dark theme
  return 'dark';
};

export const setStoredTheme = (theme: Theme): void => {
  localStorage.setItem(THEME_KEY, theme);
};

export const applyTheme = (theme: Theme): void => {
  const root = document.documentElement;
  const body = document.body;
  
  if (theme === 'dark') {
    root.classList.add('dark');
    body.className = 'bg-[#0B1121] text-white';
  } else {
    root.classList.remove('dark');
    body.className = 'bg-white text-gray-900';
  }
};

export const initializeTheme = (): Theme => {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
};

export const toggleTheme = (currentTheme: Theme): Theme => {
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setStoredTheme(newTheme);
  applyTheme(newTheme);
  
  // Dispatch custom event to notify components
  window.dispatchEvent(new CustomEvent('themeChanged'));
  
  return newTheme;
};