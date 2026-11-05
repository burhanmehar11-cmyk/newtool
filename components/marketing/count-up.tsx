"use client";

import * as React from "react";

const fmt = (n: number, decimals: number) => n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** Counts up to a number when it scrolls into view (instantly for reduced motion). */
export function CountUp({ to, ms = 1400, decimals = 0 }: { to: number; ms?: number; decimals?: number }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [n, setN] = React.useState(to);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || to === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const step = Math.pow(10, decimals);
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - start) / ms);
          setN(Math.round(to * (1 - Math.pow(1 - p, 3)) * step) / step);
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        setN(0);
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, ms, decimals]);
  return (
    <span ref={ref} className="tabular-nums">
      {fmt(n, decimals)}
    </span>
  );
}
