import { useEffect, useRef } from 'react';

/**
 * Hook that adds 'visible' class when element scrolls into view.
 * Use with CSS classes: reveal, reveal-left, reveal-scale
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  threshold = 0.15,
  rootMargin = '0px 0px -60px 0px',
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('visible');
          observer.unobserve(el);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return ref;
}

/**
 * Hook that observes all children with [data-reveal] attribute.
 * Call once on a container; each child animates independently.
 * Elements already in viewport on mount are revealed immediately.
 */
export function useRevealChildren(containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Small delay to ensure layout is computed
    const timeout = setTimeout(() => {
      const children = container.querySelectorAll('[data-reveal]');
      if (children.length === 0) return;

      // First pass: immediately reveal elements already in viewport
      children.forEach((child) => {
        const rect = child.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          (child as HTMLElement).classList.add('visible');
        }
      });

      // Second pass: observe elements not yet visible
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              (entry.target as HTMLElement).classList.add('visible');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.08, rootMargin: '0px 0px -30px 0px' },
      );

      children.forEach((child) => {
        if (!child.classList.contains('visible')) {
          observer.observe(child);
        }
      });

      return () => observer.disconnect();
    }, 50);

    return () => clearTimeout(timeout);
  }, [containerRef]);
}
