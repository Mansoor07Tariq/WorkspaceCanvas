import { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SidebarCollapseContext, useCollapseSidebarWhileMounted } from "../SidebarCollapseContext";

function CanvasLikePage() {
  useCollapseSidebarWhileMounted();
  return <div>canvas</div>;
}

function Harness({ showPage }: { showPage: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <SidebarCollapseContext.Provider value={{ collapsed, setCollapsed }}>
      <div data-testid="state">{collapsed ? "collapsed" : "expanded"}</div>
      {showPage && <CanvasLikePage />}
    </SidebarCollapseContext.Provider>
  );
}

describe("useCollapseSidebarWhileMounted", () => {
  it("collapses the sidebar while the page is mounted and restores on unmount", () => {
    const { rerender } = render(<Harness showPage />);
    expect(screen.getByTestId("state").textContent).toBe("collapsed");

    rerender(<Harness showPage={false} />);
    expect(screen.getByTestId("state").textContent).toBe("expanded");
  });

  it("defaults to expanded when no page requests collapse", () => {
    render(<Harness showPage={false} />);
    expect(screen.getByTestId("state").textContent).toBe("expanded");
  });
});
