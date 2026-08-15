import { useEffect, useReducer, useRef } from "react";

export interface Size {
  width: number;
  height: number;
}

function reducer(state: Size, next: Size): Size {
  return state.width === next.width && state.height === next.height ? state : next;
}

/**
 * Measure an element's content box via ResizeObserver (PR 079 fix-up — feeds the map
 * hero's fit-to-view). Seeded so it renders deterministically before/without layout
 * (jsdom has no ResizeObserver). Uses useReducer so the observer callback dispatches
 * (dispatch-in-effect is allowed; the repo forbids setState-in-effect).
 */
export function useElementSize(seed: Size = { width: 640, height: 300 }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useReducer(reducer, seed);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr && cr.width > 0 && cr.height > 0) {
        setSize({ width: cr.width, height: cr.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, size };
}
