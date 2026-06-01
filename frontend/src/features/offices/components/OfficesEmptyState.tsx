import { BusinessOutlined } from "@mui/icons-material";
import { EmptyState } from "@/components/ui/EmptyState";
import { en } from "@/i18n/en";

const c = en.app.offices;

interface Props {
  onAddOffice: () => void;
}

export function OfficesEmptyState({ onAddOffice }: Props) {
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
