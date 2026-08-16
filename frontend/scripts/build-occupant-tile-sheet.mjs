// PR 080 B3 visual evidence: overlays the occupant tile on the REAL desk sprites using the
// SAME geometry as `computeTileBox` (spriteGeometry.ts), for 2 variants × 4 states × {0°,90°},
// so the reviewer/owner can confirm the tile fills the desktop and never the chair.
// Run: node scripts/build-occupant-tile-sheet.mjs  → writes review/35-occupant-tiles.html
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const ISO = join(here, "../src/assets/iso");
const OUT = join(here, "../../review/35-occupant-tiles.html");

// Measured desktop rects (must mirror manifest.overrides.json).
const RECTS = {
  "desk-chair-1": { x: 0.03, y: 0.03, w: 0.94, h: 0.55 },
  "desk-chair-2": { x: 0.03, y: 0.02, w: 0.94, h: 0.58 },
};
const TILE_INSET = 0.025; // mirrors `occupantTileInset` in src/theme/tokens.ts
const TOK = {
  pine: "#147054",
  pineDark: "#0C4A38",
  onPine: "#FFFFFF",
  mist: "#EAEFED",
  slate: "#5E6B66",
};
const AVATAR = [
  "#147054",
  "#7A5AA6",
  "#B97A24",
  "#3A6EA5",
  "#A5544F",
  "#4E7D3A",
  "#8A6FB8",
  "#2E7D74",
];

const dataUri = (key) =>
  "data:image/webp;base64," + readFileSync(join(ISO, `${key}-256.webp`)).toString("base64");

// Mirrors computeTileBox in the DISPLAYED square (W×W) space: the tile FILLS the desktop rect,
// keeping its w:h proportions, minus a uniform inset (all values as % of the box).
function tileBoxPct(rect) {
  const inset = TILE_INSET * Math.min(rect.w, rect.h);
  return {
    left: (rect.x + inset) * 100,
    top: (rect.y + inset) * 100,
    w: (rect.w - 2 * inset) * 100,
    h: (rect.h - 2 * inset) * 100,
    short: Math.min(rect.w, rect.h) * 100,
  };
}

function tile(state, box) {
  const s =
    `position:absolute;left:${box.left}%;top:${box.top}%;width:${box.w}%;height:${box.h}%;` +
    `border-radius:${box.short * 0.18}%;box-sizing:border-box;display:flex;align-items:center;justify-content:center;` +
    `font:700 ${box.short * 0.42}px/1 Manrope,sans-serif;overflow:hidden`;
  if (state === "colleague")
    return `<div style="${s};background:${AVATAR[5]};color:#fff;border:1.5px solid ${TOK.onPine}">SK</div>`;
  if (state === "you")
    return (
      `<div style="${s};background:${AVATAR[0]};color:#fff;border:3px solid ${TOK.pineDark}">MT</div>` +
      `<div style="position:absolute;left:0;top:${box.top + box.h + 1}%;width:100%;text-align:center;` +
      `font:700 ${box.short * 0.2}px Manrope,sans-serif;color:${TOK.pine}">You</div>`
    );
  if (state === "guest")
    return `<div style="${s};background:${TOK.mist};color:${TOK.slate};font-size:${box.short * 0.24}px">Guest</div>`;
  // photo — cover-fit crop, no letterboxing
  return `<div style="${s};border:1.5px solid ${TOK.onPine};background:#888 center/cover url('https://i.pravatar.cc/120?img=12')"></div>`;
}

const STATES = [
  ["colleague", "Colleague — initials + thin frame"],
  ["you", "You — pine frame + tag"],
  ["guest", "Guest — neutral tile"],
  ["photo", "Photo — cover-fit (mock)"],
];

let cells = "";
for (const key of Object.keys(RECTS)) {
  const box = tileBoxPct(RECTS[key]);
  for (const angle of [0, 90]) {
    for (const [state, caption] of STATES) {
      cells +=
        `<figure><div class="stage" style="transform:rotate(${angle}deg)">` +
        `<img src="${dataUri(key)}" alt=""/>${tile(state, box)}</div>` +
        `<figcaption>${key} · ${angle}° · ${caption}</figcaption></figure>`;
    }
  }
}

const html = `<!doctype html><meta charset="utf-8"><title>PR 080 B3 — occupant tiles</title>
<style>
 body{font:14px/1.5 system-ui;margin:24px;background:#F4F6F5;color:#182420}
 h1{font-size:20px} p{max-width:70ch;color:#5E6B66}
 .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:20px}
 figure{margin:0;background:#fff;border:1px solid #E4E9E7;border-radius:12px;padding:10px}
 .stage{position:relative;width:100%;aspect-ratio:1}
 .stage img{width:100%;display:block}
 figcaption{margin-top:8px;font-size:12px;color:#5E6B66}
</style>
<h1>PR 080 B3 — occupant identity tile placement</h1>
<p>The tile is overlaid on the real desk sprites using the same <code>computeTileBox</code> geometry
the renderer uses (desktop rect from <code>manifest.overrides.json</code>). It fills the desk's top
surface and stays clear of the chair; at 90° the whole desk+tile rotates together (the tile is a child
of the desk's Konva group). Initials/pine/“You”/“Guest” treatments match the ratified spec.</p>
<div class="grid">${cells}</div>`;

writeFileSync(OUT, html);
console.log("wrote", OUT);
