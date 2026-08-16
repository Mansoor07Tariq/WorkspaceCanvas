import { describe, it, expect } from "vitest";
import { getIsoAssetsByBaseType } from "../isometric/isoManifest";
import {
  planRoomInterior,
  ROOM_MIN_FURNISH_AREA,
  ROOM_AREA_SMALL_MAX,
  ROOM_AREA_MEDIUM_MAX,
} from "../isometric/roomFurnishing";

const keysOf = (baseType: string) => getIsoAssetsByBaseType(baseType).map((a) => a.key);
// width×height that lands inside a given area band.
const box = (area: number): [number, number] => [
  Math.round(Math.sqrt(area)),
  Math.round(Math.sqrt(area)),
];

describe("planRoomInterior", () => {
  it("returns no furniture (shell only) below the minimum area", () => {
    const [w, h] = box(ROOM_MIN_FURNISH_AREA - 1000);
    expect(planRoomInterior("meeting_room", 1, w, h)).toEqual([]);
  });

  it("meeting_room: small → Short Table w/ one Bench, large → Meeting Room", () => {
    const small = box(ROOM_MIN_FURNISH_AREA + 1000);
    const large = box(ROOM_AREA_MEDIUM_MAX + 20000);
    expect(keysOf("Short Table with one Bench")).toContain(
      planRoomInterior("meeting_room", 1, ...small)[0].key
    );
    expect(keysOf("Meeting Room")).toContain(planRoomInterior("meeting_room", 1, ...large)[0].key);
  });

  it("generic room: medium → Long Table w/ one Bench, large → Long Table w/ Benches", () => {
    const med = box((ROOM_AREA_SMALL_MAX + ROOM_AREA_MEDIUM_MAX) / 2);
    const large = box(ROOM_AREA_MEDIUM_MAX + 20000);
    expect(keysOf("Long Table with one Bench")).toContain(
      planRoomInterior("room", 1, ...med)[0].key
    );
    expect(keysOf("Long Table with Benches")).toContain(
      planRoomInterior("focus_zone", 1, ...large)[0].key
    );
  });

  it("kitchen places a shelf AND a table (two pieces, distinct placement)", () => {
    const [w, h] = box(ROOM_AREA_MEDIUM_MAX);
    const pieces = planRoomInterior("kitchen", 3, w, h);
    expect(pieces).toHaveLength(2);
    expect(keysOf("Kitchen Shelf")).toContain(pieces[0].key);
    expect(keysOf("Kitchen Table")).toContain(pieces[1].key);
    expect(pieces[0].place.y).toBeLessThan(pieces[1].place.y); // shelf above table
  });

  it("bathroom places a toilet AND a sink side by side", () => {
    const [w, h] = box(ROOM_MIN_FURNISH_AREA + 5000);
    const pieces = planRoomInterior("bathroom", 4, w, h);
    expect(pieces).toHaveLength(2);
    expect(keysOf("Toilet")).toContain(pieces[0].key);
    expect(keysOf("Toilet Sink")).toContain(pieces[1].key);
    expect(pieces[0].place.x).toBeLessThan(pieces[1].place.x); // toilet left of sink
  });

  it("lobby is furnished with a Lounge grouping", () => {
    const [w, h] = box(ROOM_AREA_MEDIUM_MAX);
    expect(keysOf("Lounge")).toContain(planRoomInterior("lobby", 5, w, h)[0].key);
  });

  it("phone_booth gets no furniture (shell only)", () => {
    const [w, h] = box(ROOM_AREA_MEDIUM_MAX);
    expect(planRoomInterior("phone_booth", 6, w, h)).toEqual([]);
  });

  it("is deterministic: same id + dimensions → same plan", () => {
    const [w, h] = box(ROOM_AREA_MEDIUM_MAX);
    expect(planRoomInterior("kitchen", 9, w, h)).toEqual(planRoomInterior("kitchen", 9, w, h));
  });
});
