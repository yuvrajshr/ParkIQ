import { useEffect, useRef, useState } from "react";

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Options {
  /** Tween duration in ms. */
  durationMs?: number;
  /** Start the very first render from 0 and count up (the on-load "wow"). */
  startAtZero?: boolean;
}

/**
 * Smoothly tweens a displayed number toward `target`. Retargets mid-flight when
 * the value changes, so live-updating metrics glide instead of snapping. Honours
 * prefers-reduced-motion by jumping straight to the target.
 */
export function useCountUp(target: number, opts: Options = {}): number {
  const { durationMs = 650, startAtZero = false } = opts;
  // Constant initial value on both server and client → no hydration mismatch.
  const [value, setValue] = useState(startAtZero ? 0 : target);
  const valueRef = useRef(value);
  valueRef.current = value;
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReduced()) {
      setValue(target);
      return;
    }

    const from = valueRef.current;
    const delta = target - from;
    if (Math.abs(delta) < 0.001) return;

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(from + delta * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // valueRef is read at run-time, intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return value;
}
