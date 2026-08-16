import { Image as KonvaImage } from "react-konva";

import type { InteriorPiece } from "./roomFurnishing";
import { spriteUrl } from "./isoManifest";
import { fitContainInSubRect } from "./spriteGeometry";
import { useKonvaImage } from "./useKonvaImage";

/**
 * One piece of room-interior furniture (PR 080 B4): contain-fit into its normalized sub-rect of the
 * room box, drawn non-listening so the room shell stays the hit target. Renders nothing until its
 * image decodes (the shell alone shows meanwhile) — never blank.
 */
export function RoomInteriorSprite({
  piece,
  boxW,
  boxH,
}: {
  piece: InteriorPiece;
  boxW: number;
  boxH: number;
}) {
  const { image, status } = useKonvaImage(spriteUrl(piece.key));
  if (status !== "loaded" || !image) return null;

  const fit = fitContainInSubRect(
    image.naturalWidth || 0,
    image.naturalHeight || 0,
    boxW,
    boxH,
    piece.place
  );
  return (
    <KonvaImage
      image={image}
      x={fit.x}
      y={fit.y}
      width={fit.width}
      height={fit.height}
      listening={false}
    />
  );
}
