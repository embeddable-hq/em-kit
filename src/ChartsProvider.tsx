import { ReactNode, useEffect, useMemo } from 'react';
import { ThemeContext } from './runtime/react';
import { remarkableTheme } from './generated/theme/theme.constants';
import { Theme } from './generated/theme/theme.types';
import { DeepPartial } from './generated/types/deep-partial';
import { injectCssVariables } from './generated/theme/styles/styles.utils';
import { loadThemeFonts } from './generated/theme/fonts/fonts.utils';
import { getClientContextTimezone } from './generated/theme/utils/clientContext.utils';
import { fr } from './i18n/fr';

export type ChartsProviderProps = {
  theme?: DeepPartial<Theme>;
  timezone?: string;
  children: ReactNode;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Objects merge recursively; arrays and primitives in the override replace the base.
const mergeTheme = <T,>(base: T, override: unknown): T => {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override === undefined ? base : override) as T;
  }
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    result[key] = mergeTheme(base[key], value);
  }
  return result as T;
};

const baseTheme: Theme = {
  ...remarkableTheme,
  i18n: {
    ...remarkableTheme.i18n,
    translations: { ...remarkableTheme.i18n.translations, fr },
  },
};

export const ChartsProvider = ({ theme, timezone, children }: ChartsProviderProps) => {
  const resolvedTheme = useMemo<Theme>(() => {
    const merged = mergeTheme(baseTheme, theme);
    return {
      ...merged,
      clientContext: { ...merged.clientContext, timezone: getClientContextTimezone(timezone) },
    };
  }, [theme, timezone]);

  // Components read CSS variables via getComputedStyle during their own render,
  // so the variables must exist before children render, not in an effect.
  useMemo(() => {
    if (typeof document !== 'undefined') injectCssVariables(resolvedTheme.styles);
  }, [resolvedTheme.styles]);

  useEffect(() => {
    loadThemeFonts(resolvedTheme.fonts);
  }, [resolvedTheme.fonts]);

  return <ThemeContext.Provider value={resolvedTheme}>{children}</ThemeContext.Provider>;
};
