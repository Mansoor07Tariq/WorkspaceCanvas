/**
 * TD-045: FloorLayoutPage must gate the layout-editing affordances (object
 * library / create form) and the read-only banner on the role the user holds in
 * THIS floor's organization, resolved from the loaded desks' org id — not on the
 * first active membership.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { CurrentUser, MembershipInline } from "@/features/auth/types/auth.types";
import type { AuthContextValue } from "@/features/auth/types/authState.types";
import type { Desk } from "@/features/desks/types/desk.types";

vi.mock("@/features/auth", () => ({ useAuth: vi.fn() }));
vi.mock("@/features/auth/context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/features/layoutObjects/hooks/useLayoutObjects", () => ({ useLayoutObjects: vi.fn() }));
vi.mock("@/features/desks/hooks/useDesks", () => ({ useDesks: vi.fn() }));
vi.mock("@/features/layoutObjects/hooks/useLayoutObjectForm", () => ({
  useLayoutObjectForm: () => ({
    fields: { object_type: "desk" },
    setField: vi.fn(),
    fieldErrors: {},
    submission: { loading: false, generalError: undefined },
    handleCreate: vi.fn(),
  }),
}));
vi.mock("@/features/layoutObjects/hooks/useCanvasInteractions", () => ({
  useCanvasInteractions: () => ({
    handleObjectDragEnd: vi.fn(),
    handleObjectTransform: vi.fn(),
    handleCanvasKeyDown: vi.fn(),
    layoutSaveError: undefined,
    setLayoutSaveError: vi.fn(),
    savedObjectId: null,
  }),
}));
vi.mock("@/features/layoutObjects/components/FloorMapCanvas", () => ({
  FloorMapCanvas: () => <div data-testid="floor-map-canvas" />,
}));
vi.mock("@/features/layoutObjects/components/LayoutObjectLibrary", () => ({
  LayoutObjectLibrary: () => <div data-testid="object-library" />,
}));

import { useAuth } from "@/features/auth/context/AuthContext";
import { useLayoutObjects } from "@/features/layoutObjects/hooks/useLayoutObjects";
import { useDesks } from "@/features/desks/hooks/useDesks";
import { FloorLayoutPage } from "@/app/pages/FloorLayoutPage";

const mockUseAuth = vi.mocked(useAuth);
const mockUseLayoutObjects = vi.mocked(useLayoutObjects);
const mockUseDesks = vi.mocked(useDesks);

const ORG_A = 10;
const ORG_B = 20;

function membership(overrides: Partial<MembershipInline>): MembershipInline {
  return {
    id: 1,
    organization_id: ORG_A,
    organization_name: "Org",
    organization_slug: "org",
    organization_status: "active",
    role: "member",
    status: "active",
    has_active_access: true,
    ...overrides,
  };
}

function makeUser(): CurrentUser {
  return {
    id: 1,
    username: "u@example.com",
    email: "u@example.com",
    full_name: "U",
    first_name: "U",
    last_name: "",
    avatar: null,
    phone_number: "",
    job_title: "",
    timezone: "UTC",
    locale: "en",
    is_profile_completed: true,
    email_verified: true,
    preferred_auth_provider: "email",
    mfa_enabled: false,
    memberships: [
      membership({ id: 1, organization_id: ORG_A, role: "admin" }),
      membership({ id: 2, organization_id: ORG_B, role: "member" }),
    ],
  };
}

function makeAuthValue(user: CurrentUser): AuthContextValue {
  return {
    user,
    isLoading: false,
    isAuthenticated: true,
  } as unknown as AuthContextValue;
}

function desk(orgId: number): Desk {
  return {
    id: 1,
    organization: orgId,
    office: 5,
    floor: 7,
    layout_object: 3,
    layout_object_type: "desk",
    layout_object_label: "D1",
    name: "Desk 1",
    code: "D1",
    status: "available",
    status_display: "Available",
    amenities: {},
    notes: "",
    is_active: true,
    created_at: "",
    updated_at: "",
  } as unknown as Desk;
}

function emptyLayoutObjects() {
  return {
    objects: [],
    loading: false,
    error: undefined,
    refresh: vi.fn(),
    updateObjectLocally: vi.fn(),
    setSaving: vi.fn(),
    savingObjectIds: new Set<number>(),
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/app/offices/5/floors/7/layout"]}>
      <Routes>
        <Route path="/app/offices/:officeId/floors/:floorId/layout" element={<FloorLayoutPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("FloorLayoutPage role gate (TD-045)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(makeAuthValue(makeUser()));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseLayoutObjects.mockReturnValue(emptyLayoutObjects() as any);
  });

  it("shows the object library (edit mode) when the floor is in the org the user administers", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDesks.mockReturnValue({ desks: [desk(ORG_A)], refresh: vi.fn() } as any);
    renderPage();
    expect(screen.getByTestId("object-library")).toBeInTheDocument();
  });

  it("hides the object library and shows read-only when the floor is in an org where the user is only a member", () => {
    // First active membership is Org A admin; floor (via its desks) is in Org B.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDesks.mockReturnValue({ desks: [desk(ORG_B)], refresh: vi.fn() } as any);
    renderPage();
    expect(screen.queryByTestId("object-library")).toBeNull();
  });
});
