import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FloorsEmptyState } from "../components/FloorsEmptyState";
import { en } from "@/i18n/en";

const c = en.app.floors;

describe("FloorsEmptyState — admin (canManage=true)", () => {
  it("shows admin empty state title", () => {
    render(<FloorsEmptyState canManage={true} onAddFloor={vi.fn()} />);
    expect(screen.getByText(c.emptyStateTitle)).toBeInTheDocument();
  });

  it("shows admin empty state description", () => {
    render(<FloorsEmptyState canManage={true} onAddFloor={vi.fn()} />);
    expect(screen.getByText(c.emptyStateSubtitle)).toBeInTheDocument();
  });

  it("shows Create first floor action button", () => {
    render(<FloorsEmptyState canManage={true} onAddFloor={vi.fn()} />);
    expect(screen.getByRole("button", { name: c.emptyStateAction })).toBeInTheDocument();
  });

  it("calls onAddFloor when action button is clicked", () => {
    const onAddFloor = vi.fn();
    render(<FloorsEmptyState canManage={true} onAddFloor={onAddFloor} />);
    screen.getByRole("button", { name: c.emptyStateAction }).click();
    expect(onAddFloor).toHaveBeenCalledOnce();
  });
});

describe("FloorsEmptyState — member (canManage=false)", () => {
  it("shows member empty state title", () => {
    render(<FloorsEmptyState canManage={false} onAddFloor={vi.fn()} />);
    expect(screen.getByText(c.emptyStateMemberTitle)).toBeInTheDocument();
  });

  it("shows member empty state description", () => {
    render(<FloorsEmptyState canManage={false} onAddFloor={vi.fn()} />);
    expect(screen.getByText(c.emptyStateMemberSubtitle)).toBeInTheDocument();
  });

  it("does not show Create Floor action button", () => {
    render(<FloorsEmptyState canManage={false} onAddFloor={vi.fn()} />);
    expect(screen.queryByRole("button", { name: c.emptyStateAction })).not.toBeInTheDocument();
  });
});

describe("FloorsEmptyState — default (canManage omitted)", () => {
  it("defaults to admin view when canManage is not provided", () => {
    render(<FloorsEmptyState onAddFloor={vi.fn()} />);
    expect(screen.getByText(c.emptyStateTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: c.emptyStateAction })).toBeInTheDocument();
  });
});
