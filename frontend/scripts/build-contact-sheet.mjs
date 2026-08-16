#!/usr/bin/env node
/**
 * Generate review/asset-contact-sheet.html (PR 080, pre-Phase-B owner ratification).
 *
 * Reads the generated manifest, embeds each 256px WebP as a data URI (self-contained, so the
 * single HTML file is committable and opens anywhere), and lays out:
 *   1. Decision A — orientation vs aesthetic: the 4 Desk+System variants as-authored, above
 *      one desk CSS-rotated 0/90/180/270 for side-by-side comparison.
 *   2. Decision B — status overlay on real raster: one desk in free/taken/yours/selected with
 *      the proposed overlay-rect tint, plus the under-glow / corner-badge fallbacks.
 *   3. The full catalog: all 86 sprites at ~200px, grouped by base type, each labelled with
 *      base-type / variant / descriptor and any ratified role badge.
 *   4. The remaining review/32 §7 decisions with recommendations, to approve in one pass.
 *
 * Read-only over the committed assets; writes one HTML file into review/. No renderer code.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const ISO_DIR = join(REPO_ROOT, "frontend", "src", "assets", "iso");
const OUT = join(REPO_ROOT, "review", "asset-contact-sheet.html");

// Design tokens (mirrors frontend/src/theme/tokens.ts — this review artifact lives outside
// src/, so it isn't bound by the no-hex lint rule; kept in sync by hand).
const T = {
  page: "#F4F6F5",
  card: "#FFFFFF",
  ink: "#182420",
  slate: "#5E6B66",
  mist: "#EAEFED",
  pine: "#147054",
  pineDark: "#0C4A38",
  mint: "#E2F2EA",
  mintLine: "#BFE3D2",
  amber: "#B97A24",
  line: "#E4E9E7",
};

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
  );

async function dataUri(key) {
  const buf = await readFile(join(ISO_DIR, `${key}-256.webp`));
  return `data:image/webp;base64,${buf.toString("base64")}`;
}

// Curated group order (structure → workstations → seating → tables → rooms → facilities →
// decor → flagged/unused). Anything unlisted appends alphabetically.
const GROUP_ORDER = [
  "Wall",
  "Window",
  "Door closed",
  "Door opened",
  "Staircase",
  "Desk+Chair",
  "Desk+System",
  "System",
  "Big Sofa",
  "Small Sofa",
  "Lounge",
  "Stool",
  "Plant Sofa side",
  "Table",
  "Short Table",
  "Long Table",
  "Long Table with one Bench",
  "Short Table with one Bench",
  "Short Table with Benches",
  "Long Table with Benches",
  "Meeting Room",
  "Kitchen Table",
  "Kitchen Shelf",
  "Toilet",
  "Toilet Sink",
  "Plant",
  "Map",
];

function label(a) {
  const bits = [a.baseType];
  if (a.variantIndex != null) bits.push(`#${a.variantIndex}`);
  if (a.descriptor) bits.push(a.descriptor);
  return bits.join(" · ");
}

async function main() {
  const manifest = JSON.parse(await readFile(join(ISO_DIR, "manifest.json"), "utf8"));
  const assets = manifest.assets;
  const byKey = new Map(assets.map((a) => [a.key, a]));
  const uri = new Map();
  for (const a of assets) uri.set(a.key, await dataUri(a.key));

  // group
  const groups = new Map();
  for (const a of assets) {
    if (!groups.has(a.baseType)) groups.set(a.baseType, []);
    groups.get(a.baseType).push(a);
  }
  const orderedTypes = [
    ...GROUP_ORDER.filter((g) => groups.has(g)),
    ...[...groups.keys()].filter((g) => !GROUP_ORDER.includes(g)).sort(),
  ];

  const roleBadge = (a) =>
    a.role ? `<span class="badge role-${a.role}">${esc(a.role.replace("-", " "))}</span>` : "";

  const tile = (a) => `
    <figure class="tile${a.role === "unused" ? " unused" : ""}">
      <div class="sprite"><img loading="lazy" alt="${esc(a.sourceName)}" src="${uri.get(a.key)}"></div>
      <figcaption>${esc(label(a))} ${roleBadge(a)}
        <span class="dim">${a.trimmed?.width}×${a.trimmed?.height} · ${(a.outputs?.reduce((s, o) => s + (o.bytes || 0), 0) / 1024).toFixed(0)}KB</span>
      </figcaption>
    </figure>`;

  const catalog = orderedTypes
    .map((g) => {
      const items = groups.get(g).sort((a, b) => (a.variantIndex ?? 0) - (b.variantIndex ?? 0));
      return `<section class="group"><h3>${esc(g)} <span class="count">${items.length}</span></h3>
        <div class="grid">${items.map(tile).join("")}</div></section>`;
    })
    .join("\n");

  // Decision A — orientation vs aesthetic (Desk+System variants + one rotated desk)
  const deskVariants = ["desk-system-1", "desk-system-2", "desk-system-3", "desk-system-4"].filter(
    (k) => byKey.has(k)
  );
  const rotDesk = deskVariants[0];
  const decisionA = `
    <div class="cols">
      <div>
        <p class="lead">Row 1 — the four <code>Desk+System</code> variants exactly as the artist drew them:</p>
        <div class="grid demo">${deskVariants
          .map(
            (k) =>
              `<figure class="tile"><div class="sprite"><img src="${uri.get(k)}" alt=""></div><figcaption>${esc(
                byKey.get(k).baseType
              )} · #${byKey.get(k).variantIndex}</figcaption></figure>`
          )
          .join("")}</div>
      </div>
      <div>
        <p class="lead">Row 2 — variant #1 (<code>${esc(rotDesk)}</code>) CSS-rotated 0/90/180/270:</p>
        <div class="grid demo">${[0, 90, 180, 270]
          .map(
            (deg) =>
              `<figure class="tile"><div class="sprite"><img style="transform:rotate(${deg}deg)" src="${uri.get(
                rotDesk
              )}" alt=""></div><figcaption>rotated ${deg}°</figcaption></figure>`
          )
          .join("")}</div>
      </div>
    </div>
    <p class="ask"><b>✓ RATIFIED:</b> <code>Desk+System-1..4</code> are <b>aesthetic alternates</b> at the same orientation →
    picked by <code>hash(object.id)%n</code>; rotation is applied by rotating the sprite on canvas (variant #2 is clearly
    <i>not</i> #1 rotated — the rows show why). <b>➜ Still confirm:</b> are <code>Meeting Room-1..4</code> aesthetic or
    orientations, and that Small Sofa / Stool / Plant are aesthetic (recommend: yes, aesthetic)?</p>`;

  // Decision B — the ratified desk-IDENTITY treatment (photo/initials on the desktop).
  // Free = the clean "Less" desk; booked = the bare Desk+Chair (empty top) with the
  // occupant's photo (mocked here as the colored-initials avatar; "Guest" for guests),
  // framed by a very thin outline; "yours" adds the pine "You" ring.
  const freeKey = byKey.has("desk-system-1-less") ? "desk-system-1-less" : deskVariants[0];
  const bareKey = byKey.has("desk-chair-1") ? "desk-chair-1" : deskVariants[0];
  // Deterministic avatar colours (mirrors tokens.ts avatarPalette) for the mock occupants.
  const AV = { colleague: "#7A5AA6", you: T.pine };
  // CORRECTED (reviewer): the identity FILLS the whole desktop (a rounded-square tile sized
  // to the desk's top footprint), NOT a small chip. The initials ARE the surface until real
  // photo-upload ships. The tile carries the frame (thin always; pine ADDED for "yours").
  const deskWith = (tileHtml) =>
    `<div class="sprite deskbox"><img src="${uri.get(bareKey)}" alt="">${tileHtml}</div>`;
  const identityTile = (txt, bg, { pine = false, small = false } = {}) =>
    `<span class="desktile${pine ? " pine" : ""}${small ? " small" : ""}" style="background:${bg}">${txt}</span>`;
  const decisionB = `
    <div class="grid demo">
      <figure class="tile">
        <div class="sprite"><img src="${uri.get(freeKey)}" alt=""></div>
        <figcaption>free · <code>Less</code> variant (clean, no identity fill)</figcaption>
      </figure>
      <figure class="tile">
        ${deskWith(identityTile("SK", AV.colleague))}
        <figcaption>colleague-booked · identity fills desktop + thin frame (no pine)</figcaption>
      </figure>
      <figure class="tile">
        ${deskWith(`${identityTile("MT", AV.you, { pine: true })}<span class="youtag">You</span>`)}
        <figcaption>you-booked · fills desktop + pine frame “You”</figcaption>
      </figure>
      <figure class="tile">
        ${deskWith(identityTile("Guest", T.slate, { small: true }))}
        <figcaption>guest · neutral tile fills desktop + “Guest”</figcaption>
      </figure>
    </div>
    <p class="ask"><b>➜ Owner ruling:</b> the occupant identity <b>fills the whole desktop</b> (a rounded-square clipped to the
    desk's top footprint — the initials <i>are</i> the surface, swapping to the real photo when upload ships). Does it read at
    map scale — the thin frame subtle, the pine “You” distinct from a colleague, “Guest” legible, and the tile landing on the
    desktop without covering the chair? Per-asset desktop rect is tuned via <code>manifest.overrides.json</code> in B2. Free uses
    the richer <code>Less</code> desk; booked swaps to the bare <code>Desk+Chair</code>.</p>`;

  const remaining = `
    <ul class="decisions">
      <li><b>§7.1 count</b> — the library is <b>86</b>, not 84. <i>Recommend:</i> confirm the two extra are expected (nothing missing).</li>
      <li><b>§7.3 variant semantics</b> — <b>✓ ratified aesthetic</b> for Desk+System (Decision A). Still confirm Meeting Room-1..4 + that Small Sofa / Stool / Plant are aesthetic.</li>
      <li><b>§7.7 desk descriptor — now bound to BOOKING STATE (ratified), not hash:</b> free → <code>Less</code>; booked → bare <code>Desk+Chair</code> (empty top for the occupant photo). Confirm the free look uses <code>Less</code> (vs <code>ALL</code>/<code>Plant</code> for a richer hero).</li>
      <li><b>§7.9 meeting-room furnishing</b> — size→asset. <i>Recommend:</i> small→<code>Short Table (with one Bench)</code>, medium→<code>Long Table with one Bench</code>, large→<code>Long Table with Benches</code>; confirm which <code>Meeting Room-N</code> shell is small/med/large (or whether they are orientations).</li>
      <li><b>§7.11 WebP widths</b> — 256 / 640. <i>Recommend:</i> keep; add 128 only if dense maps look heavy.</li>
      <li><b>§7.12 footprint anchor</b> — default bottom-half normalized rect. <i>Recommend:</i> keep default + tune per-asset via <code>manifest.overrides.json</code> during B2.</li>
    </ul>`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>WorkspaceCanvas — Iso Asset Contact Sheet (PR 080)</title>
<style>
  :root{color-scheme:light}
  *{box-sizing:border-box}
  body{margin:0;background:${T.page};color:${T.ink};font:14px/1.5 'Manrope',system-ui,-apple-system,sans-serif}
  header,main{max-width:1180px;margin:0 auto;padding:0 24px}
  header{padding-top:32px}
  h1{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:30px;margin:0 0 4px;letter-spacing:-.01em}
  h2{font-family:'Fraunces',Georgia,serif;font-weight:500;font-size:22px;margin:34px 0 6px}
  h3{font-size:15px;margin:20px 0 10px;display:flex;align-items:center;gap:8px}
  .count{font-size:11px;font-weight:800;color:${T.slate};background:${T.mist};border-radius:999px;padding:1px 8px}
  .sub{color:${T.slate};margin:0 0 8px}
  .panel{background:${T.card};border:1px solid ${T.line};border-radius:16px;padding:18px 20px;margin:12px 0 8px;
    box-shadow:0 1px 2px rgba(24,36,32,.04),0 4px 14px rgba(24,36,32,.05)}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}
  .grid.demo{grid-template-columns:repeat(4,1fr);max-width:900px}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:24px}
  .tile{margin:0;background:${T.card};border:1px solid ${T.line};border-radius:12px;padding:8px;text-align:center}
  .tile.unused{opacity:.55;background:repeating-linear-gradient(45deg,${T.card},${T.card} 10px,${T.mist} 10px,${T.mist} 12px)}
  .sprite{height:180px;display:flex;align-items:center;justify-content:center;background:${T.mist};border-radius:8px;overflow:hidden}
  .sprite img{max-width:96%;max-height:96%;object-fit:contain}
  .deskbox{position:relative}
  /* occupant identity FILLING the desktop surface (rounded-square, ~the top footprint) */
  .desktile{position:absolute;left:50%;top:43%;transform:translate(-50%,-50%);width:42%;aspect-ratio:1;
    border-radius:22%;color:#fff;font-weight:800;font-size:26px;display:flex;align-items:center;justify-content:center;
    outline:1.5px solid rgba(255,255,255,.92);box-shadow:0 1px 4px rgba(0,0,0,.3);overflow:hidden}
  .desktile.small{font-size:15px;border-radius:26%}
  .desktile.pine{outline:2.5px solid ${T.pine}} /* the "yours" frame */
  .youtag{position:absolute;left:50%;top:70%;transform:translateX(-50%);color:${T.pineDark};font-weight:800;font-size:11px;
    background:rgba(255,255,255,.85);border-radius:999px;padding:0 6px}
  figcaption{font-size:12px;font-weight:700;color:${T.ink};margin-top:7px;display:flex;flex-direction:column;gap:2px;align-items:center}
  .dim{font-weight:600;color:${T.slate};font-size:11px}
  .badge{font-size:10px;font-weight:800;border-radius:999px;padding:1px 7px;text-transform:uppercase;letter-spacing:.03em}
  .role-unused{background:#f3d6d0;color:#8a2d22}
  .role-standalone-desk{background:${T.mint};color:${T.pineDark}}
  .role-structural{background:#e6ddc7;color:#7a5b12}
  .lead{color:${T.slate};margin:0 0 8px}
  .ask{background:${T.mint};border:1px solid ${T.mintLine};border-radius:10px;padding:10px 14px;margin:14px 0 0;color:${T.pineDark}}
  .decisions{margin:0;padding-left:18px}.decisions li{margin:6px 0}
  code{background:${T.mist};padding:1px 5px;border-radius:5px;font-size:12px}
  .note{color:${T.slate};font-size:12.5px}
</style></head>
<body>
<header>
  <h1>Isometric asset contact sheet</h1>
  <p class="sub">PR 080 · ${assets.length} sprites · generated from <code>frontend/src/assets/iso/manifest.json</code> ·
  ${manifest.widths.join(" / ")}px WebP (256 shown). Annotate and return for Phase B.</p>
</header>
<main>
  <h2>Decision A — variant semantics (aesthetic, ratified)</h2>
  <div class="panel">${decisionA}</div>

  <h2>Decision B — desk identity: photo/initials on the desktop</h2>
  <div class="panel">${decisionB}</div>

  <h2>Remaining §7 decisions (approve in one pass)</h2>
  <div class="panel">${remaining}</div>

  <h2>Full catalog — all ${assets.length}, grouped by type</h2>
  <p class="note">Ratified: <b>Map</b> = unused (near-empty exports) · <b>System</b> = standalone desk · <b>Staircase</b> = new
  non-bookable structural type (styled box for now) · doubled name fixed to <code>Long Table with one Bench</code>.</p>
  ${catalog}
</main>
</body></html>`;

  await writeFile(OUT, html);
  const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
  console.log(
    `[contact-sheet] wrote review/asset-contact-sheet.html (${assets.length} sprites, ${kb} KB)`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
