import type { ComponentType } from 'react';

// Embeddable's builder fills every input the author left unset with its
// declared default before the component sees it. Standalone there is no
// builder, so each exported component applies the same defaults itself
// (src/componentDefaults.generated.ts). A prop passed as `undefined` also
// gets the default, as an unset builder input would.
export const withDefaults = <P extends object>(
  Component: ComponentType<P>,
  defaults: Partial<P>,
  displayName: string,
) => {
  const WithDefaults = (props: P) => {
    const merged = { ...defaults } as Record<string, unknown>;
    for (const [key, value] of Object.entries(props)) {
      if (value !== undefined) merged[key] = value;
    }
    return <Component {...(merged as P)} />;
  };
  WithDefaults.displayName = displayName;
  return WithDefaults;
};
