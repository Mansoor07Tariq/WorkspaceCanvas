// PR 080 B4 visual evidence: composites a mock furnished floor from the REAL sprites using the
// same room-interior placement math the renderer uses, so the reviewer/owner can see rooms
// furnished by size + single-sprite objects at once. Run: node scripts/build-b4-floor-preview.mjs
// → review/36-floor-preview.png
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const ISO = join(here, "../src/assets/iso");
const OUT = join(here, "../../review/36-floor-preview.png");
const W = 940,
  H = 560;

const sprite = (key) => join(ISO, `${key}-640.webp`);

// contain-fit a sprite into a box; returns {input, left, top} for sharp.composite
async function place(key, x, y, w, h) {
  const buf = await sharp(sprite(key))
    .resize(Math.round(w), Math.round(h), { fit: "inside" })
    .toBuffer();
  const meta = await sharp(buf).metadata();
  return {
    input: buf,
    left: Math.round(x + (w - meta.width) / 2),
    top: Math.round(y + (h - meta.height) / 2),
  };
}
// a translucent room shell rect (violet dashed-ish) as an SVG
function shell(x, y, w, h) {
  return {
    input: Buffer.from(
      `<svg width="${w}" height="${h}"><rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="4" fill="#DDD6FE" fill-opacity="0.5" stroke="#7C3AED" stroke-width="1.5" stroke-dasharray="8 4"/></svg>`
    ),
    left: x,
    top: y,
  };
}
// interior sub-rect placement (mirrors roomFurnishing): returns absolute box
const sub = (rx, ry, rw, rh, p) => [rx + p.x * rw, ry + p.y * rh, p.w * rw, p.h * rh];
const CENTER = { x: 0.12, y: 0.12, w: 0.76, h: 0.76 };

(async () => {
  const comp = [];
  // Meeting room (large) — shell + Meeting Room arrangement
  let r = [40, 40, 300, 210];
  comp.push(shell(...r));
  comp.push(await place("meeting-room-1", ...sub(...r, CENTER)));
  // Kitchen — shell + shelf (top) + table (lower)
  r = [380, 40, 250, 180];
  comp.push(shell(...r));
  comp.push(await place("kitchen-shelf-1", ...sub(...r, { x: 0.06, y: 0.05, w: 0.88, h: 0.32 })));
  comp.push(await place("kitchen-table-1", ...sub(...r, { x: 0.16, y: 0.42, w: 0.68, h: 0.5 })));
  // Bathroom — shell + toilet + sink
  r = [670, 40, 220, 170];
  comp.push(shell(...r));
  comp.push(await place("toilet-1", ...sub(...r, { x: 0.08, y: 0.18, w: 0.4, h: 0.64 })));
  comp.push(await place("toilet-sink-1", ...sub(...r, { x: 0.54, y: 0.2, w: 0.38, h: 0.58 })));
  // Small meeting room — shell + Short Table with one Bench
  r = [40, 300, 150, 150];
  comp.push(shell(...r));
  comp.push(await place("short-table-with-one-bench", ...sub(...r, CENTER)));
  // Single-sprite objects
  comp.push(await place("big-sofa-1", 230, 300, 150, 100));
  comp.push(await place("small-sofa-1", 400, 310, 90, 90));
  comp.push(await place("stool-1", 510, 330, 55, 55));
  comp.push(await place("plant-1", 580, 320, 60, 60));
  comp.push(await place("desk-chair-1", 670, 300, 130, 130));
  comp.push(await place("door-closed-1", 240, 430, 120, 40));
  comp.push(await place("window-1", 400, 440, 120, 30));

  await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 244, g: 246, b: 245, alpha: 1 } },
  })
    .composite(comp)
    .png()
    .toFile(OUT);
  console.log("wrote", OUT);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
