import { BusinessOutlined } from "@mui/icons-material";
import { EmptyState } from "@/components/ui/EmptyState";
import { en } from "@/i18n/en";

const c = en.app.offices;

interface Props {
  canManage?: boolean;
  onAddOffice: () => void;
}

export function OfficesEmptyState({ canManage = true, onAddOffice }: Props) {
  if (!canManage) {
    return (
      <EmptyState
        icon={<BusinessOutlined sx={{ fontSize: 40, color: "text.disabled" }} aria-hidden="true" />}
        title={c.emptyStateMemberTitle}
        description={c.emptyStateMemberSubtitle}
      />
    );
  }

  return (
    <EmptyState
      icon={<BusinessOutlined sx={{ fontSize: 40, color: "primary.main" }} aria-hidden="true" />}
      title={c.emptyStateTitle}
      description={c.emptyStateSubtitle}
      actionLabel={c.emptyStateAction}
      onAction={onAddOffice}
    />
  );
}
