import { Group, Image as KonvaImage, Rect, Text } from "react-konva";
import type { Context } from "konva/lib/Context";

import { colorTokens, fontTokens, avatarColor, initialsFromName } from "@/theme/tokens";
import type { OccupantKind } from "@/features/bookings/utils/bookingAvailability";
import { en } from "@/i18n/en";
import { useKonvaImage } from "./useKonvaImage";
import { computeTileBox, type DesktopRect, type SpriteFit } from "./spriteGeometry";

interface Props {
  /** Where the sprite landed in the object box (group-centred coords). */
  fit: SpriteFit;
  /** The desk asset's top-surface rect (normalized to the sprite image). */
  desktopRect: DesktopRect;
  kind: OccupantKind;
  name?: string;
  avatarUrl?: string | null;
  colorKey?: number | null;
}

const c = en.bookings;

/** Rounded-rectangle clip path in the tile's own (group-local) coordinates. */
function roundedRectClip(x: number, y: number, w: number, h: number, r: number) {
  return (ctx: Context) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
}

/**
 * The occupant identity tile drawn on a booked desk's top surface (PR 080 B3). FILLS the
 * desk's `desktopRect` edge-to-edge — keeping the desktop's real width:height proportions,
 * not a square — mapped through the sprite's contain-fit transform and carried by the parent
 * group's rotation:
 *  - a colleague's photo (cover-fit, else coloured initials) with a thin frame;
 *  - your own booking: the same, plus a pine frame and a "You" tag;
 *  - a guest: a neutral tile labelled "Guest".
 * All shapes are non-listening so the desk's own hit target is unaffected.
 */
export function OccupantTile({ fit, desktopRect, kind, name, avatarUrl, colorKey }: Props) {
  // Hook order is unconditional: the tile is mounted/unmounted by the parent, and a
  // null/undefined url makes the loader idle (→ initials fallback).
  const { image, status } = useKonvaImage(kind === "guest" ? undefined : (avatarUrl ?? undefined));

  const { x, y, w, h } = computeTileBox(fit, desktopRect);
  if (w <= 0 || h <= 0) return null;
  const short = Math.min(w, h);
  const radius = short * 0.18;
  const isMine = kind === "me";
  const isGuest = kind === "guest";
  const hasPhoto = !isGuest && status === "loaded" && !!image;

  // Frame: pine + heavier for "you"; thin neutral hairline for colleague/guest.
  const frameStroke = isMine ? colorTokens.pineDark : colorTokens.onPine;
  const frameWidth = isMine ? Math.max(2, short * 0.06) : Math.max(1.5, short * 0.04);

  const fill = isGuest ? colorTokens.mist : avatarColor(colorKey ?? name ?? "?");

  return (
    <>
      <Group clipFunc={roundedRectClip(x, y, w, h, radius)} listening={false}>
        {hasPhoto ? (
          <CoverImage image={image} x={x} y={y} w={w} h={h} />
        ) : (
          <>
            <Rect x={x} y={y} width={w} height={h} fill={fill} listening={false} />
            <Text
              x={x}
              y={y}
              width={w}
              height={h}
              text={isGuest ? c.deskTileGuest : initialsFromName(name)}
              fontSize={short * (isGuest ? 0.24 : 0.42)}
              fontStyle="600"
              fontFamily={fontTokens.body}
              fill={isGuest ? colorTokens.slate : colorTokens.onPine}
              align="center"
              verticalAlign="middle"
              listening={false}
            />
          </>
        )}
      </Group>
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        cornerRadius={radius}
        stroke={frameStroke}
        strokeWidth={frameWidth}
        fillEnabled={false}
        listening={false}
      />
      {isMine && (
        <Text
          x={x}
          y={y + h + short * 0.06}
          width={w}
          text={c.deskTileYou}
          fontSize={Math.max(8, short * 0.2)}
          fontStyle="700"
          fontFamily={fontTokens.body}
          fill={colorTokens.pine}
          align="center"
          listening={false}
        />
      )}
    </>
  );
}

/** Cover-fit an image to the (already clipped) rectangle, centred — crop, no letterboxing. */
function CoverImage({
  image,
  x,
  y,
  w,
  h,
}: {
  image: HTMLImageElement;
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  const nW = image.naturalWidth || w;
  const nH = image.naturalHeight || h;
  const scale = Math.max(w / nW, h / nH);
  const dW = nW * scale;
  const dH = nH * scale;
  return (
    <KonvaImage
      image={image}
      x={x + (w - dW) / 2}
      y={y + (h - dH) / 2}
      width={dW}
      height={dH}
      listening={false}
    />
  );
}
