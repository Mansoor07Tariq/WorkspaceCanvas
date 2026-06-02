/** Org-wide workspace summary returned by GET /api/offices/summary/ (TD-035). */
export interface WorkspaceSummary {
  organization: number;
  offices_count: number;
  floors_count: number;
  layout_objects_count: number;
  bookable_desks_count: number;
  active_members_count: number;
  /** Manager-only; returned as 0 for regular members. */
  pending_invitations_count: number;
  has_offices: boolean;
  has_floors: boolean;
  has_layout_objects: boolean;
  has_bookable_desks: boolean;
  setup_complete: boolean;
}
