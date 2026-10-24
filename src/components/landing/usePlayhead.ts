"use client";

import { useInView, useReducedMotion } from "framer-motion";
import { type RefObject, useEffect, useState } from "react";

export interface Playhead {
  /** ms since this run started */
  t: number;
  /** finished runs since the stage came into view */
  loop: number;
}

/**
 * Plays a script while its stage is on screen, restarting it each time it scrolls back in.
 * With reduced motion it jumps straight to the last frame.
 */
export function usePlayhead(ref: RefObject<Element | null>, total: number, gap = 2600): Playhead {
  const inView = useInView(ref, { amount: 0.35 });
  const reduced = useReducedMotion();
  const [head, setHead] = useState<Playhead>({ t: 0, loop: 0 });

  useEffect(() => {
    if (!inView || reduced) return;
    let raf = 0;
    let start = performance.now();
    let loop = 0;
    let painted = -Infinity;
    const tick = (now: number) => {
      let t = now - start;
      if (t > total + gap) {
        start = now;
        t = 0;
        loop += 1;
      }
      // ~30 fps is plenty for text appearing; it keeps React work low
      if (now - painted > 32 || t === 0) {
        painted = now;
        setHead({ t, loop });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduced, total, gap]);

  return reduced ? { t: total, loop: 0 } : head;
}
