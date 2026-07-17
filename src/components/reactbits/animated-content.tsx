"use client";

/**
 * AnimatedContent — fades + rises its children into view.
 * Adapted from React Bits (reactbits.dev/animations/animated-content), dependency-free
 * (IntersectionObserver + CSS transition, no motion library). Great for staggered lists.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AnimatedContent({
  children,
  className,
  delay = 0,
  distance = 18,
  duration = 700,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("motion-reduce:transition-none", className)}
      style={{
        transition: `opacity ${duration}ms ease-out, transform ${duration}ms ease-out`,
        transitionDelay: `${delay}ms`,
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : `translateY(${distance}px)`,
      }}
    >
      {children}
    </div>
  );
}
