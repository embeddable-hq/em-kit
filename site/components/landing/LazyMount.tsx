import { ReactNode, useEffect, useRef, useState } from 'react';

// Mounts its children the first time they come near the viewport, so the
// first screen does not wait on charts further down the page. The box keeps
// its size before and after, so nothing shifts when the chart arrives: pass a
// `height`, or a `className` that sizes it.
export const LazyMount = ({ height, className, children }: { height?: number; className?: string; children: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || shown) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setShown(true);
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [shown]);

  return (
    <div ref={ref} className={`lp-lazy${className ? ` ${className}` : ''}`} style={height ? { height } : undefined}>
      {shown ? children : <div className="lp-lazy__placeholder" aria-hidden />}
    </div>
  );
};
