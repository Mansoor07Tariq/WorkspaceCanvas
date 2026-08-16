import type { LayoutObjectRendererProps } from "../types";
import { DefaultLayoutObjectRenderer } from "../DefaultLayoutObjectRenderer";
import { AssetSpriteBody } from "./AssetSpriteBody";
import { OccupantTile } from "./OccupantTile";
import { pickDeskSpriteKey } from "./deskSprite";
import { spriteUrl } from "./isoManifest";
import { fitContain, getDesktopRect } from "./spriteGeometry";
import { useKonvaImage } from "./useKonvaImage";

/**
 * Desk renderer (PR 080 B2/B3): draws a real isometric desk sprite instead of a box. The
 * sprite is picked deterministically per desk (`fnv1a(id) % n` aesthetic variant) and by
 * booking state (free → clean `Desk+System` Less; booked → bare `Desk+Chair`). The shared
 * `AssetSpriteBody` draws the contain-fit sprite + availability overlay. Rotation, drag,
 * selection, and the hitbox are owned by `LayoutObjectCanvasNode`; rotation rotates the
 * sprite with the group (the variants are aesthetic, not orientations).
 *
 * B3: when a booked desk carries occupant identity (threaded as flat scalars), an
 * `OccupantTile` is drawn on the desk's top surface (photo / initials, pine "You", "Guest"),
 * clipped to the asset's measured `desktopRect` so it never spills onto the chair.
 *
 * Fallback: no manifest asset / still loading / load error → `DefaultLayoutObjectRenderer`
 * (the styled box), so a desk is never invisible and the hitbox never disappears (this is
 * also why jsdom tests stay green — images don't decode there, so it always falls back).
 */
export function DeskRenderer(props: LayoutObjectRendererProps) {
  const {
    object,
    style,
    config,
    width,
    height,
    isSaving,
    isBookingMode,
    availabilityStatus,
    occupantKind,
    occupantName,
    occupantAvatarUrl,
    occupantColorKey,
  } = props;
  const key = pickDeskSpriteKey(object.id, availabilityStatus);
  const src = key ? spriteUrl(key) : undefined;
  const { image, status } = useKonvaImage(src);

  if (!src || status !== "loaded" || !image) {
    return <DefaultLayoutObjectRenderer {...props} />;
  }

  const fit = fitContain(image.naturalWidth || 0, image.naturalHeight || 0, width, height);

  return (
    <>
      <AssetSpriteBody
        image={image}
        style={style}
        config={config}
        width={width}
        height={height}
        isSaving={isSaving}
        isBookingMode={isBookingMode}
      />
      {occupantKind && (
        <OccupantTile
          fit={fit}
          desktopRect={getDesktopRect(key)}
          kind={occupantKind}
          name={occupantName}
          avatarUrl={occupantAvatarUrl}
          colorKey={occupantColorKey}
        />
      )}
    </>
  );
}
