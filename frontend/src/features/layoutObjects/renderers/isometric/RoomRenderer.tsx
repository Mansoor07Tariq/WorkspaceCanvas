import type { LayoutObjectRendererProps } from "../types";
import { DefaultLayoutObjectRenderer } from "../DefaultLayoutObjectRenderer";
import { planRoomInterior } from "./roomFurnishing";
import { RoomInteriorSprite } from "./RoomInteriorSprite";

/**
 * Room renderer (PR 080 B4): keeps the room SHELL as geometry — the translucent dashed rect from
 * the default renderer (sized to whatever the admin drew), with the grey frame walls painted on top
 * by `RoomFramesLayer` — and places interior FURNITURE inside it, chosen by the room's floor area
 * (`planRoomInterior`). Bigger room → bigger table set; too-small rooms show the shell alone. The
 * furniture is deterministic per object id + dimensions and rotates with the group. This does NOT
 * replace the room with a fixed-size sprite, so any drawn size works.
 */
export function RoomRenderer(props: LayoutObjectRendererProps) {
  const { object, width, height } = props;
  const pieces = planRoomInterior(object.object_type, object.id, width, height);
  return (
    <>
      <DefaultLayoutObjectRenderer {...props} />
      {pieces.map((piece, i) => (
        <RoomInteriorSprite key={`${piece.key}:${i}`} piece={piece} boxW={width} boxH={height} />
      ))}
    </>
  );
}
