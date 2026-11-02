"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

const clamp = (v: number) => Math.max(0, Math.min(1, v));

/**
 * One passive, rAF-throttled scroll loop that writes CSS variables, plus an
 * IntersectionObserver for reveals. Respects reduced motion and re-scans on
 * navigation.
 *
 *   data-reveal[="up"|"left"|"right"|"scale"|"fade"]  reveal when scrolled into view
 *   data-stagger[="80"]                               stagger delays of descendants (ms)
 *   data-tilt[="420"]                                 flatten over N px of scroll
 *   data-parallax="0.15"                              move relative to viewport centre
 *   data-draw                                         scale X with section progress
 *   data-count="18"                                   count up when revealed
 */
export function ScrollEffects() {
  const pathname = usePathname();

  React.useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.classList.remove("fx");
      return;
    }
    root.classList.add("fx", "fx-ready");

    document.querySelectorAll<HTMLElement>("[data-stagger]").forEach((group) => {
      const step = Number(group.dataset.stagger) || 80;
      group.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el, i) => {
        el.style.setProperty("--reveal-delay", `${Math.min(i, 8) * step}ms`);
      });
    });

    const counters: number[] = [];
    const countUp = (el: Element) => {
      el.querySelectorAll<HTMLElement>("[data-count]").forEach((c) => {
        const target = Number(c.dataset.count);
        if (!Number.isFinite(target)) return;
        const start = performance.now();
        const tick = (t: number) => {
          const p = clamp((t - start) / 900);
          c.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
          if (p < 1) counters.push(requestAnimationFrame(tick));
        };
        c.textContent = "0";
        counters.push(requestAnimationFrame(tick));
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-shown", "");
          countUp(e.target);
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.01 },
    );
    document.querySelectorAll("[data-reveal]:not([data-shown])").forEach((el) => io.observe(el));

    const tilts = Array.from(document.querySelectorAll<HTMLElement>("[data-tilt]"));
    const parallax = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
    const draws = Array.from(document.querySelectorAll<HTMLElement>("[data-draw]"));

    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      const vh = window.innerHeight;
      const max = Math.max(1, root.scrollHeight - vh);
      root.style.setProperty("--scroll-progress", String(clamp(y / max)));
      if (y > 8) root.setAttribute("data-scrolled", "");
      else root.removeAttribute("data-scrolled");
      for (const el of tilts) el.style.setProperty("--tilt", String(clamp(y / (Number(el.dataset.tilt) || 420))));
      for (const el of parallax) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        el.style.setProperty("--py", `${((r.top + r.height / 2 - vh / 2) * Number(el.dataset.parallax || 0)).toFixed(1)}px`);
      }
      for (const el of draws) {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--draw", clamp((vh * 0.9 - r.top) / (vh * 0.55)).toFixed(3));
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      counters.forEach(cancelAnimationFrame);
    };
  }, [pathname]);

  return null;
}
