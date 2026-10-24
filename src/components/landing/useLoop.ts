"use client";

import { useInView, useReducedMotion } from "framer-motion";
import { type RefObject, useEffect, useState } from "react";

/**
 * Milliseconds into a repeating loop of `total` ms, advancing only while `ref` is on screen.
 * Restarts each time it scrolls back in; with reduced motion it rests on the last frame.
 */
export function useLoop(ref: RefObject<Element | null>, total: number): number {
  const inView = useInView(ref, { amount: 0.4 });
  const reduced = useReducedMotion();
  const [t, setT] = useState(0);

  useEffect(() => {
    if (!inView || reduced) return;
    let raf = 0;
    const start = performance.now();
    let painted = -Infinity;
    const tick = (now: number) => {
      if (now - painted > 50) {
        painted = now;
        setT((now - start) % total);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduced, total]);

  return reduced ? total - 1 : t;
}
