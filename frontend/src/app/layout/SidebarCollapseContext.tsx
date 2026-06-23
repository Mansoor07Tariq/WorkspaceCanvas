import { createContext, useContext, useEffect } from "react";

/**
 * Lets a page request the app sidebar collapse into a burger + temporary drawer
 * at ALL breakpoints (not just mobile), freeing horizontal space — e.g. the
 * floor-map canvas. AppShell owns the state and renders accordingly; pages opt
 * in with `useCollapseSidebarWhileMounted()`.
 *
 * The default is a no-op so pages render safely outside AppShell (e.g. in unit
 * tests that mount a page directly).
 */
export interface SidebarCollapseValue {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

export const SidebarCollapseContext = createContext<SidebarCollapseValue>({
  collapsed: false,
  setCollapsed: () => {},
});

export function useSidebarCollapse(): SidebarCollapseValue {
  return useContext(SidebarCollapseContext);
}

/** Collapse the app sidebar to a burger while the calling page is mounted. */
export function useCollapseSidebarWhileMounted(): void {
  const { setCollapsed } = useSidebarCollapse();
  useEffect(() => {
    setCollapsed(true);
    return () => setCollapsed(false);
  }, [setCollapsed]);
}
