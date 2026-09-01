import { Group, Image as KonvaImage, Rect, Text } from "react-konva";
import type { Context } from "konva/lib/Context";

import { colorTokens, fontTokens, avatarColor, initialsFromName } from "@/theme/tokens";
import type { OccupantKind } from "@/features/bookings/utils/bookingAvailability";
import { en } from "@/i18n/en";
import { useKonvaImage } from "./useKonvaImage";
import { computeTileBox, containInBox, type DesktopRect, type SpriteFit } from "./spriteGeometry";

interface Props {
  /** Where the sprite landed in the object box (group-centred coords). */
  fit: SpriteFit;
  /** The desk asset's top-surface rect (normalized to the sprite image). */
  desktopRect: DesktopRect;
  kind: OccupantKind;
  name?: string;
  avatarUrl?: string | null;
  colorKey?: number | null;
  /**
   * Draw the frame? PR 083 Part A hides it at rest and shows it on hover/selection. This supersedes
   * only WHEN the frame appears — when it does appear it still tracks the DRAWN photo bounds, which
   * is the PR 083 requirement that stands.
   */
  showFrame: boolean;
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
 * The occupant identity tile drawn on a booked desk's top surface (PR 080 B3), mapped through the
 * sprite's fit and carried by the parent group's rotation:
 *  - a colleague's photo (else coloured initials) with a thin frame;
 *  - your own booking: the same, plus a pine frame and a "You" tag;
 *  - a guest: a neutral tile labelled "Guest".
 *
 * PR 083: the photo is CONTAINED in the desk's top surface, not cropped to fill it — the whole face
 * shows, smaller, like a framed photo standing on the desk. `computeTileBox` gives the available
 * surface; {@link containInBox} gives the drawn bounds within it, square for the generated fallbacks
 * so initials and photos read as one design. EVERY decoration below — the rounded clip, the frame,
 * the "You" tag, the initials block and its font size — is measured from those drawn bounds rather
 * than from the surface, so the affordance can never sit somewhere the art is not (PR 081 fix-up 2).
 *
 * All shapes are non-listening so the desk's own hit target is unaffected.
 */
export function OccupantTile({
  fit,
  desktopRect,
  kind,
  name,
  avatarUrl,
  colorKey,
  showFrame,
}: Props) {
  // Hook order is unconditional: the tile is mounted/unmounted by the parent, and a
  // null/undefined url makes the loader idle (→ initials fallback).
  const { image, status } = useKonvaImage(kind === "guest" ? undefined : (avatarUrl ?? undefined));

  // The available surface, then the identity's DRAWN bounds contained within it. Everything below
  // is measured from the drawn bounds (x/y/w/h), never from the surface.
  const surface = computeTileBox(fit, desktopRect);
  if (surface.w <= 0 || surface.h <= 0) return null;

  const isMine = kind === "me";
  const isGuest = kind === "guest";
  // A photo keeps its own aspect; the generated fallbacks pass 0 and take the square default.
  const photo = !isGuest && status === "loaded" && image ? image : undefined;
  const { x, y, w, h } = containInBox(photo?.naturalWidth ?? 0, photo?.naturalHeight ?? 0, surface);
  const short = Math.min(w, h);
  const radius = short * 0.18;

  // Frame: pine + heavier for "you"; thin neutral hairline for colleague/guest.
  const frameStroke = isMine ? colorTokens.pineDark : colorTokens.onPine;
  const frameWidth = isMine ? Math.max(2, short * 0.06) : Math.max(1.5, short * 0.04);

  const fill = isGuest ? colorTokens.mist : avatarColor(colorKey ?? name ?? "?");

  return (
    <>
      <Group clipFunc={roundedRectClip(x, y, w, h, radius)} listening={false}>
        {photo ? (
          <KonvaImage image={photo} x={x} y={y} width={w} height={h} listening={false} />
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
      {showFrame && (
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
      )}
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
