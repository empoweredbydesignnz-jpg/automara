import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const themes = {
  default: {
    name: 'Default',
    description: 'Purple and pink gradients',
    colors: {
      primary: '168 85 247',      // purple-500
      primaryDark: '147 51 234',  // purple-600
      secondary: '236 72 153',    // pink-500
      secondaryDark: '219 39 119', // pink-600
      accent: '192 132 252',      // purple-400
      accentAlt: '244 114 182',   // pink-400
    }
  },
  ocean: {
    name: 'Ocean',
    description: 'Blue and cyan tones',
    colors: {
      primary: '59 130 246',      // blue-500
      primaryDark: '37 99 235',   // blue-600
      secondary: '6 182 212',     // cyan-500
      secondaryDark: '8 145 178', // cyan-600
      accent: '96 165 250',       // blue-400
      accentAlt: '34 211 238',    // cyan-400
    }
  },
  forest: {
    name: 'Forest',
    description: 'Green and emerald shades',
    colors: {
      primary: '34 197 94',       // green-500
      primaryDark: '22 163 74',   // green-600
      secondary: '16 185 129',    // emerald-500
      secondaryDark: '5 150 105', // emerald-600
      accent: '74 222 128',       // green-400
      accentAlt: '52 211 153',    // emerald-400
    }
  },
  sunset: {
    name: 'Sunset',
    description: 'Orange and amber warmth',
    colors: {
      primary: '249 115 22',      // orange-500
      primaryDark: '234 88 12',   // orange-600
      secondary: '245 158 11',    // amber-500
      secondaryDark: '217 119 6', // amber-600
      accent: '251 146 60',       // orange-400
      accentAlt: '251 191 36',    // amber-400
    }
  },
  crimson: {
    name: 'Crimson',
    description: 'Red and rose accents',
    colors: {
      primary: '239 68 68',       // red-500
      primaryDark: '220 38 38',   // red-600
      secondary: '244 63 94',     // rose-500
      secondaryDark: '225 29 72', // rose-600
      accent: '248 113 113',      // red-400
      accentAlt: '251 113 133',   // rose-400
    }
  },
  lavender: {
    name: 'Lavender',
    description: 'Violet and indigo calm',
    colors: {
      primary: '139 92 246',      // violet-500
      primaryDark: '124 58 237',  // violet-600
      secondary: '99 102 241',    // indigo-500
      secondaryDark: '79 70 229', // indigo-600
      accent: '167 139 250',      // violet-400
      accentAlt: '129 140 248',   // indigo-400
    }
  }
};

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('app-theme') || 'default';
  });

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('app-dark-mode');
    return saved !== null ? saved === 'true' : true; // Default to dark mode
  });

  useEffect(() => {
    localStorage.setItem('app-theme', currentTheme);

    // Apply CSS variables
    const theme = themes[currentTheme];
    const root = document.documentElement;

    root.style.setProperty('--color-primary', theme.colors.primary);
    root.style.setProperty('--color-primary-dark', theme.colors.primaryDark);
    root.style.setProperty('--color-secondary', theme.colors.secondary);
    root.style.setProperty('--color-secondary-dark', theme.colors.secondaryDark);
    root.style.setProperty('--color-accent', theme.colors.accent);
    root.style.setProperty('--color-accent-alt', theme.colors.accentAlt);
  }, [currentTheme]);

  useEffect(() => {
    localStorage.setItem('app-dark-mode', darkMode.toString());

    // Apply dark/light mode
    const root = document.documentElement;
    if (darkMode) {
      root.classList.remove('light-mode');
      root.classList.add('dark-mode');
    } else {
      root.classList.remove('dark-mode');
      root.classList.add('light-mode');
    }
  }, [darkMode]);

  return (
    <ThemeContext.Provider value={{ currentTheme, setCurrentTheme, themes, darkMode, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
