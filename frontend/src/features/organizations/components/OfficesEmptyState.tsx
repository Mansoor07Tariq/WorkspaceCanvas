import { BusinessOutlined } from "@mui/icons-material";
import { EmptyState } from "@/components/ui/EmptyState";
import { en } from "@/i18n/en";

const c = en.app.orgSetup;

export function OfficesEmptyState() {
  return (
    <EmptyState
      icon={<BusinessOutlined sx={{ fontSize: 40, color: "primary.main" }} aria-hidden="true" />}
      title={c.emptyStateTitle}
      description={c.emptyStateSubtitle}
      actionLabel={c.emptyStateAction}
      actionDisabled
      actionDisabledTooltip="Office creation is coming next."
    />
  );
}
