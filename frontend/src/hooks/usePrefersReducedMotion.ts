import { useMemo } from "react";

export function usePrefersReducedMotion(): boolean {
  return useMemo(() => {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }, []);
}
