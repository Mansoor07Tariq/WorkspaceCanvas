import type { LayoutObjectRendererProps } from "../types";
import { DefaultLayoutObjectRenderer } from "../DefaultLayoutObjectRenderer";
import { AssetSpriteBody } from "./AssetSpriteBody";
import { SINGLE_SPRITE_MAP, resolveBaseType } from "./assetMapping";
import { getIsoAssetsByBaseType, spriteUrl } from "./isoManifest";
import { pickVariantKey } from "./spriteVariant";
import { useKonvaImage } from "./useKonvaImage";

/**
 * Generic single-sprite renderer (PR 080 B4): draws one isometric sprite for object types that map
 * to a single asset family (seating, tables, plants, toilets/sinks, doors/windows). The family is
 * resolved from `SINGLE_SPRITE_MAP` (size-aware where configured), a deterministic variant is
 * hash-picked per FLOOR and family (PR 082), and the shared `AssetSpriteBody` footprint-fits it into the
 * box with the availability fill and the hover/selection border (PR 083). Falls back to the styled box when the type is unmapped or the
 * sprite is missing / still loading (jsdom tests always hit this fallback), so nothing is ever blank.
 */
export function SpriteRenderer(props: LayoutObjectRendererProps) {
  const {
    object,
    style,
    config,
    width,
    height,
    isSaving,
    isBookingMode,
    availabilityStatus,
    showBorder,
  } = props;
  const mapping = SINGLE_SPRITE_MAP[object.object_type];
  const baseType = mapping ? resolveBaseType(mapping, Math.abs(width * height)) : undefined;
  const key = baseType ? pickVariantKey(object.floor, getIsoAssetsByBaseType(baseType)) : undefined;
  const src = key ? spriteUrl(key) : undefined;
  const { image, status } = useKonvaImage(src);

  if (!src || status !== "loaded" || !image) {
    return <DefaultLayoutObjectRenderer {...props} />;
  }

  return (
    <AssetSpriteBody
      image={image}
      style={style}
      config={config}
      width={width}
      height={height}
      isSaving={isSaving}
      isBookingMode={isBookingMode}
      availabilityStatus={availabilityStatus}
      showBorder={showBorder}
    />
  );
}
