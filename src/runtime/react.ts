import { createContext, useContext } from 'react';

export const ThemeContext = createContext<object | null>(null);

export const useTheme = (): object => {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('charts-ui components must be rendered inside <ChartsProvider>.');
  return theme;
};
