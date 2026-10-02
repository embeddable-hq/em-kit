import { useEffect, useState } from 'react';

const current = () => window.location.hash.replace(/^#/, '') || '/';

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
