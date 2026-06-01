import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { OfficesEmptyState } from "../components/OfficesEmptyState";
import { en } from "@/i18n/en";

const c = en.app.offices;

describe("OfficesEmptyState — admin (canManage=true)", () => {
  it("shows admin empty state title", () => {
    render(<OfficesEmptyState canManage={true} onAddOffice={vi.fn()} />);
    expect(screen.getByText(c.emptyStateTitle)).toBeInTheDocument();
  });

  it("shows admin empty state description", () => {
    render(<OfficesEmptyState canManage={true} onAddOffice={vi.fn()} />);
    expect(screen.getByText(c.emptyStateSubtitle)).toBeInTheDocument();
  });

  it("shows Add Office action button", () => {
    render(<OfficesEmptyState canManage={true} onAddOffice={vi.fn()} />);
    expect(screen.getByRole("button", { name: c.emptyStateAction })).toBeInTheDocument();
  });

  it("calls onAddOffice when action button is clicked", async () => {
    const onAddOffice = vi.fn();
    render(<OfficesEmptyState canManage={true} onAddOffice={onAddOffice} />);
    screen.getByRole("button", { name: c.emptyStateAction }).click();
    expect(onAddOffice).toHaveBeenCalledOnce();
  });
});

describe("OfficesEmptyState — member (canManage=false)", () => {
  it("shows member empty state title", () => {
    render(<OfficesEmptyState canManage={false} onAddOffice={vi.fn()} />);
    expect(screen.getByText(c.emptyStateMemberTitle)).toBeInTheDocument();
  });

  it("shows member empty state description", () => {
    render(<OfficesEmptyState canManage={false} onAddOffice={vi.fn()} />);
    expect(screen.getByText(c.emptyStateMemberSubtitle)).toBeInTheDocument();
  });

  it("does not show Add Office action button", () => {
    render(<OfficesEmptyState canManage={false} onAddOffice={vi.fn()} />);
    expect(screen.queryByRole("button", { name: c.emptyStateAction })).not.toBeInTheDocument();
  });
});

describe("OfficesEmptyState — default (canManage omitted)", () => {
  it("defaults to admin view when canManage is not provided", () => {
    render(<OfficesEmptyState onAddOffice={vi.fn()} />);
    expect(screen.getByText(c.emptyStateTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: c.emptyStateAction })).toBeInTheDocument();
  });
});
