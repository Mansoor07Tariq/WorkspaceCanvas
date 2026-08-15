import { useMemo } from "react";
import { Box } from "@mui/material";

import { avatarColor, colorTokens, initialsFromName } from "@/theme/tokens";
import { en } from "@/i18n/en";
import type { FloorBoundary } from "@/features/layoutObjects/utils/coordinateHelpers";
import type { LayoutObject } from "@/features/layoutObjects/types/layoutObject.types";
import type {
  DeskAvailabilityItem,
  DeskAvailabilityStatus,
} from "@/features/bookings/utils/bookingAvailability";
import { deskLabel } from "../utils/todayLogic";
import { contentBounds, fitAndCenter } from "../utils/mapFit";
import type { Rect } from "../utils/mapFit";
import { useElementSize } from "../hooks/useElementSize";

export interface Occupant {
  name: string;
  colorKey: number | string;
}

interface Props {
  /** desk availability (colours the desks) */
  items: DeskAvailabilityItem[];
  /** ALL layout objects (desks + rooms/pods) — the content the hero crops to */
  layoutObjects: LayoutObject[];
  boundary?: FloorBoundary;
  usualDeskLayoutObjectId?: number | null;
  /** deskId → occupant for other people's bookings (initial chip on the desk) */
  occupantByDeskId?: Map<number, Occupant>;
  highlightedDeskId?: number | null;
  onDeskSelect?: (deskId: number) => void;
  onBackgroundClick?: () => void;
}

/** modest padding around the content so it isn't flush to the hero edges */
const PADDING = 20;
/** on-screen label size (px) and the projected-desk size below which we drop the label */
const LABEL_PX = 11;
const DROP_LABEL_BELOW_W = 26;
const DROP_LABEL_BELOW_H = 15;

const FILL: Record<DeskAvailabilityStatus, string> = {
  available: colorTokens.mint,
  reserved: colorTokens.card,
  bookedByMe: colorTokens.pine,
  unavailable: colorTokens.mist,
};
const STROKE: Record<DeskAvailabilityStatus, string> = {
  available: colorTokens.mintLine,
  reserved: colorTokens.slate,
  bookedByMe: colorTokens.pineDark,
  unavailable: colorTokens.line,
};

interface Node extends Rect {
  loId: number;
  rotation: number;
  isDesk: boolean;
  deskId: number | null;
  status: DeskAvailabilityStatus | null;
  isUsual: boolean;
  label: string;
}

function truncate(label: string, projectedWidth: number): string {
  const maxChars = Math.max(2, Math.floor(projectedWidth / (LABEL_PX * 0.62)));
  return label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;
}

/**
 * A compact, read-only fit-to-view floor overview for the Today hero (PR 079 fix-up).
 * Pure SVG — no Konva/stage, no pan/zoom/controls/legend/chrome (those belong to the
 * booking + full-floor pages). It crops to the floor's CONTENT bounding box (objects, not
 * the raw floor rectangle) so a small layout in a big floor still fills the hero, then
 * scales-to-fit both dimensions and centres via the pure `fitAndCenter`. Styled to the
 * prototype's LiveMap: rounded desk rects (free = mint/label, you = pine/"You",
 * occupied = card + occupant initials), rooms/pods = mist + name, walls = thin strokes.
 * Labels render at a fixed on-screen size and drop out below a legibility threshold.
 */
export function FloorOverviewMap({
  items,
  layoutObjects,
  boundary,
  usualDeskLayoutObjectId,
  occupantByDeskId,
  highlightedDeskId,
  onDeskSelect,
  onBackgroundClick,
}: Props) {
  const { ref, size } = useElementSize();

  const deskByLoId = useMemo(() => {
    const m = new Map<number, DeskAvailabilityItem>();
    for (const it of items) if (it.layoutObject) m.set(it.layoutObject.id, it);
    return m;
  }, [items]);

  const nodes = useMemo<Node[]>(
    () =>
      layoutObjects.map((lo) => {
        const item = deskByLoId.get(lo.id);
        return {
          loId: lo.id,
          x: Number(lo.x),
          y: Number(lo.y),
          width: Number(lo.width),
          height: Number(lo.height),
          rotation: Number(lo.rotation) || 0,
          isDesk: item != null,
          deskId: item?.desk.id ?? null,
          status: item?.status ?? null,
          isUsual: lo.id === usualDeskLayoutObjectId,
          label: lo.label ?? "",
        };
      }),
    [layoutObjects, deskByLoId, usualDeskLayoutObjectId]
  );

  // Crop to CONTENT — the union of object rects (never the raw floor rectangle), so a
  // small layout in a big floor fills the hero instead of showing a sea of white.
  const bbox = useMemo(() => contentBounds(null, nodes, PADDING), [nodes]);
  const { scale, offsetX, offsetY } = fitAndCenter(bbox, size);

  const project = (x: number, y: number) => ({
    sx: x * scale + offsetX,
    sy: y * scale + offsetY,
  });

  return (
    <Box
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={en.app.today.mapAriaLabel}
      onClick={() => onBackgroundClick?.()}
      onKeyDown={(e) => {
        if (e.key === "Enter") onBackgroundClick?.();
      }}
      sx={{ width: "100%", height: "100%", cursor: "pointer", "& svg": { display: "block" } }}
    >
      <svg
        width="100%"
        height="100%"
        role="presentation"
        data-testid="floor-overview-svg"
        data-scale={scale.toFixed(4)}
      >
        {/* base shapes in content coordinates */}
        <g transform={`translate(${offsetX} ${offsetY}) scale(${scale})`}>
          {boundary && (
            <rect
              x={boundary.x}
              y={boundary.y}
              width={boundary.width}
              height={boundary.height}
              rx={18}
              fill="none"
              stroke={colorTokens.line}
              strokeWidth={2 / scale}
            />
          )}
          {nodes.map((n) => {
            const dim = highlightedDeskId != null && n.deskId !== highlightedDeskId;
            const cx = n.x + n.width / 2;
            const cy = n.y + n.height / 2;
            const fill = n.isDesk ? FILL[n.status!] : colorTokens.mist;
            const stroke = n.isDesk ? STROKE[n.status!] : colorTokens.line;
            return (
              <g
                key={n.loId}
                transform={`rotate(${n.rotation} ${cx} ${cy})`}
                opacity={dim ? 0.28 : 1}
                style={{ cursor: n.isDesk ? "pointer" : "default" }}
                onClick={(e) => {
                  if (n.deskId != null) {
                    e.stopPropagation();
                    onDeskSelect?.(n.deskId);
                  }
                }}
              >
                <rect
                  x={n.x}
                  y={n.y}
                  width={n.width}
                  height={n.height}
                  rx={n.isDesk ? 6 : 9}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={(n.status === "bookedByMe" ? 2.5 : 1.4) / scale}
                  data-desk-id={n.deskId ?? undefined}
                  data-status={n.status ?? "object"}
                />
                {n.isUsual && n.status === "available" && (
                  <circle
                    cx={n.x + n.width - 6}
                    cy={n.y + 6}
                    r={4 / scale}
                    fill={colorTokens.amber}
                    data-testid="usual-desk-dot"
                  />
                )}
              </g>
            );
          })}
        </g>

        {/* labels/initials in screen space at a fixed, legible size (dropped when tiny) */}
        {nodes.map((n) => {
          const pw = n.width * scale;
          const ph = n.height * scale;
          if (pw < DROP_LABEL_BELOW_W || ph < DROP_LABEL_BELOW_H) return null;
          const dim = highlightedDeskId != null && n.deskId !== highlightedDeskId;
          const { sx, sy } = project(n.x + n.width / 2, n.y + n.height / 2);
          const occupant = n.deskId != null ? occupantByDeskId?.get(n.deskId) : undefined;

          let content: React.ReactNode = null;
          if (n.isDesk && n.status === "bookedByMe") {
            content = (
              <text
                x={sx}
                y={sy + 4}
                textAnchor="middle"
                fontSize={LABEL_PX}
                fontWeight={800}
                fill={colorTokens.onPine}
              >
                {en.app.today.youShort}
              </text>
            );
          } else if (n.isDesk && n.status === "reserved" && occupant) {
            content = (
              <>
                <circle cx={sx} cy={sy} r={LABEL_PX} fill={avatarColor(occupant.colorKey)} />
                <text
                  x={sx}
                  y={sy + 4}
                  textAnchor="middle"
                  fontSize={LABEL_PX * 0.8}
                  fontWeight={800}
                  fill={colorTokens.onPine}
                >
                  {initialsFromName(occupant.name)}
                </text>
              </>
            );
          } else if (n.isDesk && (n.status === "available" || n.status === "reserved")) {
            content = (
              <text
                x={sx}
                y={sy + 4}
                textAnchor="middle"
                fontSize={LABEL_PX}
                fontWeight={700}
                fill={colorTokens.pineDark}
              >
                {truncate(deskLabel(n.label || String(n.deskId)), pw)}
              </text>
            );
          } else if (!n.isDesk && n.label) {
            content = (
              <text
                x={sx}
                y={sy + 4}
                textAnchor="middle"
                fontSize={LABEL_PX}
                fontWeight={700}
                fill={colorTokens.slate}
              >
                {truncate(n.label, pw)}
              </text>
            );
          }
          if (!content) return null;
          return (
            <g key={`lbl-${n.loId}`} opacity={dim ? 0.28 : 1} style={{ pointerEvents: "none" }}>
              {content}
            </g>
          );
        })}
      </svg>
    </Box>
  );
}
