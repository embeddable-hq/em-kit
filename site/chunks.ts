import { use, useEffect, useState } from 'react';

// A module the site loads when a page needs it rather than with every page:
// a page, the charts' theme, a guide's live charts, the head tags. Like the
// promise React.lazy keeps, with two differences: preload() fetches it before
// anything renders it, and once it is here it renders synchronously. So the
// static build (which loads every chunk first, see prerender.tsx) writes the
// real HTML, and the first client render (which loads the current page's
// chunks first, see main.tsx) replaces that HTML with the same content.
export type Chunk<T> = {
  /** The module, as the build manifest names it (relative to site/): what the static build preloads. */
  source: string;
  /** Fetches the module. Undefined when it is already here. */
  preload: () => Promise<T> | undefined;
  /** The module's value, if it is here. */
  value: () => T | undefined;
};

export const chunk = <T>(source: string, load: () => Promise<T>): Chunk<T> => {
  let loaded: { value: T } | undefined;
  let loading: Promise<T> | undefined;
  const fetch = () =>
    (loading ??= load().then(
      (value) => {
        loaded = { value };
        return value;
      },
      (error: unknown) => {
        // Let a later render or navigation try again.
        loading = undefined;
        throw error;
      },
    ));
  return { source, preload: () => (loaded ? undefined : fetch()), value: () => loaded?.value };
};

/** The chunk's value, suspending the render until it is here. */
export const useChunk = <T>(chunk: Chunk<T>): T => {
  const value = chunk.value();
  return value !== undefined ? value : use(chunk.preload()!);
};

/**
 * The chunk's value without suspending: what is on screen stays, and this
 * re-renders once the chunk is here. `failed` says it could not be fetched.
 */
export const useChunkWhenReady = <T>(chunk: Chunk<T>): { value: T | undefined; failed: boolean } => {
  const [state, setState] = useState(() => ({ value: chunk.value(), failed: false }));
  useEffect(() => {
    if (state.value !== undefined || state.failed) return;
    let current = true;
    const pending = chunk.preload();
    if (!pending) setState({ value: chunk.value(), failed: false });
    else
      pending.then(
        (value) => current && setState({ value, failed: false }),
        () => current && setState({ value: undefined, failed: true }),
      );
    return () => {
      current = false;
    };
  }, [chunk, state]);
  return state;
};
