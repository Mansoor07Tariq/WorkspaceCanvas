import {
  CategoryOutlined,
  ChairOutlined,
  ContentCutOutlined,
  CropSquareOutlined,
  DeskOutlined,
  DoorFrontOutlined,
  EventSeatOutlined,
  GroupsOutlined,
  KitchenOutlined,
  LocalFloristOutlined,
  MeetingRoomOutlined,
  PrintOutlined,
  RectangleOutlined,
  StorefrontOutlined,
  TableBarOutlined,
  TableRestaurantOutlined,
  WcOutlined,
  WeekendOutlined,
  WindowOutlined,
} from "@mui/icons-material";
import type { SvgIconComponent } from "@mui/icons-material";
import type { LayoutObjectType } from "../types/layoutObject.types";

/** Small palette icon per object type (PR 065). Falls back to a generic icon. */
const ICONS: Partial<Record<LayoutObjectType, SvgIconComponent>> = {
  desk: DeskOutlined,
  standing_desk: DeskOutlined,
  sofa: WeekendOutlined,
  bench: EventSeatOutlined,
  chair_table_set: TableRestaurantOutlined,
  stool: ChairOutlined,
  table: TableBarOutlined,
  lobby: StorefrontOutlined,
  meeting_room: MeetingRoomOutlined,
  kitchen: KitchenOutlined,
  meeting_pod: GroupsOutlined,
  bathroom: WcOutlined,
  room: CropSquareOutlined,
  wall: RectangleOutlined,
  door: DoorFrontOutlined,
  window: WindowOutlined,
  cutout: ContentCutOutlined,
  printer: PrintOutlined,
  plant: LocalFloristOutlined,
};

export function getLayoutObjectIcon(type: LayoutObjectType): SvgIconComponent {
  return ICONS[type] ?? CategoryOutlined;
}
