import { useEffect, useState } from 'react';

// Old routes from before the examples merged into one page; links to them keep working.
const ALIASES: Record<string, string> = {
  '/sample-app': '/examples',
  '/ai': '/examples/ai-chat',
};

const current = () => {
  const path = window.location.hash.replace(/^#/, '') || '/';
  return ALIASES[path] ?? path;
};

export const useRoute = () => {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const onChange = () => {
      setRoute(current());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
};

export const href = (path: string) => `#${path}`;
