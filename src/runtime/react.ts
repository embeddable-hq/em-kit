import { createContext, useContext } from 'react';

export const ThemeContext = createContext<object | null>(null);

// Embeddable lets a dashboard size a component to its content ('auto') or to
// its grid cell ('fixed'). Standalone, the host app picks the mode, which
// wrappers provide through LayoutContext; the default is the fixed layout.
export const HEIGHT_MODES = { fixed: 'fixed', auto: 'auto' } as const;
export type HeightMode = (typeof HEIGHT_MODES)[keyof typeof HEIGHT_MODES];

export type EmbeddableLayout = { heightMode?: HeightMode };
export const LayoutContext = createContext<EmbeddableLayout>({});
export const useEmbeddableLayout = (): EmbeddableLayout => useContext(LayoutContext);

export const useTheme = (): object => {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('RKit components must be rendered inside <ChartsProvider>.');
  return theme;
};
