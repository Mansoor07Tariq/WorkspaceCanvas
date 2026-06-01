import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { NotFoundPage } from "../pages/NotFoundPage";

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => vi.fn() };
});

function renderNotFoundPage() {
  return render(
    <MemoryRouter initialEntries={["/some/unknown/route"]}>
      <NotFoundPage />
    </MemoryRouter>
  );
}

describe("NotFoundPage", () => {
  it("renders the Page Not Found heading", () => {
    renderNotFoundPage();
    expect(screen.getByRole("heading", { name: /page not found/i })).toBeInTheDocument();
  });

  it("renders the descriptive message", () => {
    renderNotFoundPage();
    expect(screen.getByText(/the page you.re looking for doesn.t exist/i)).toBeInTheDocument();
  });

  it("renders a Back to App button", () => {
    renderNotFoundPage();
    expect(screen.getByRole("button", { name: /back to app/i })).toBeInTheDocument();
  });

  it("has role=main on the page container", () => {
    renderNotFoundPage();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
