#!/usr/bin/env node
/**
 * Isometric asset pipeline (PR 080, Phase A).
 *
 * Reads the owner's source library at `assets-src/iso/*.svg`. Each file is an SVG shell wrapping
 * one or MORE base64-encoded PNG layers (`data:img/png;base64,…`, note the non-standard `img/png`;
 * the payload is a real PNG). A layered source stacks its `<image>` elements in document order,
 * each positioned in the shell's coordinate space — a bare desk, then a monitor, then a keyboard.
 * For each source it:
 *   1. rasterises the source (see `pickRasterInput`: layered sources render through the SVG so every
 *      layer composites; single-layer sources unwrap the lone PNG directly, as before),
 *   2. trims transparent margins (sharp `.trim()`),
 *   3. emits optimized WebP at two widths (256 + 640, downscale-only) into
 *      `frontend/src/assets/iso/` (this OUTPUT is committed; the sources are gitignored),
 *   4. parses the real filename into {baseType, variantIndex, descriptor} and records a
 *      footprint anchor, into a generated `manifest.json`.
 *
 * Idempotent + incremental: a source whose content hash is unchanged and whose outputs
 * exist is skipped. Re-run any time the owner drops new art. `--force` reprocesses all.
 *
 * PR 084: `sourceHash` hashes the WHOLE source file. It used to hash only the first extracted PNG,
 * so it could not see a change in any later layer — and it collided across genuinely different
 * sources (14 of 86 keys shared a hash), which silently disabled the incremental cache's one
 * correctness check. Every asset's hash therefore changes on the PR-084 run; that is expected.
 *
 * Pure parsing helpers are exported (and unit-tested in build-iso-assets.test.mjs); `sharp`
 * is imported lazily inside `main()` so importing this module for the tests never loads the
 * native binary.
 */

import { createHash } from "node:crypto";
import { readFile, writeFile, readdir, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const SRC_DIR = join(REPO_ROOT, "assets-src", "iso");
const OUT_DIR = join(REPO_ROOT, "frontend", "src", "assets", "iso");
const MANIFEST_PATH = join(OUT_DIR, "manifest.json");
const OVERRIDES_PATH = join(OUT_DIR, "manifest.overrides.json");

/** Output widths (px). 256 = Today hero / booking-map desk at ~1–2×; 640 = full-floor page
 *  / retina zoom. Downscale-only (never upscale a smaller source). */
export const WIDTHS = [256, 640];
export const WEBP_QUALITY = 80;

/** Trailing descriptor words the library uses (only on Desk+System-*). */
const DESCRIPTORS = ["ALL", "Less", "Plant"];

/**
 * Corrections to malformed source names (ratified review/32 §7). The `key`/output files
 * still derive from the raw source name (stable), but the displayed/mapped base type is
 * fixed here — e.g. the doubled-word `Long Table Table with one Bench`.
 */
const BASE_TYPE_FIXES = {
  "Long Table Table with one Bench": "Long Table with one Bench",
};

/** Slug: stable, filesystem-safe key from the source name. `+`→`-`, non-alnum→`-`. */
export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\+/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Parse a real source name (no extension) into its parts. Derived from the ACTUAL library:
 * a base type that may be multi-word (`Meeting Room`, `Kitchen Table`, `Small Sofa`), an
 * optional trailing `-N` variant index, and an optional trailing descriptor word
 * (`ALL`/`Plant`/`Less`). Note `Plant-1` is the base type "Plant" (no descriptor) while
 * `Desk+System-1 Plant` has descriptor "Plant" — the descriptor is only a TRAILING word.
 */
export function deriveMeta(sourceName) {
  let name = sourceName;
  let descriptor = null;
  for (const d of DESCRIPTORS) {
    if (name.endsWith(` ${d}`)) {
      descriptor = d;
      name = name.slice(0, -(d.length + 1));
      break;
    }
  }
  let variantIndex = null;
  const m = name.match(/-(\d+)$/);
  if (m) {
    variantIndex = Number(m[1]);
    name = name.slice(0, name.length - m[0].length);
  }
  const rawBase = name.trim();
  const baseType = BASE_TYPE_FIXES[rawBase] ?? rawBase;
  return { key: slugify(sourceName), sourceName, baseType, variantIndex, descriptor };
}

/** Extract the base64 PNG payload from the SVG shell → Buffer (or null if none). */
export function extractBase64Png(svgText) {
  const marker = "base64,";
  const i = svgText.indexOf(marker);
  if (i === -1) return null;
  const start = i + marker.length;
  let end = svgText.indexOf('"', start);
  if (end === -1) end = svgText.indexOf("'", start);
  if (end === -1) return null;
  const b64 = svgText.slice(start, end).trim();
  return Buffer.from(b64, "base64");
}

/** How many base64 payloads (image layers) the shell embeds. >1 ⇒ the source is LAYERED. */
export function countBase64Payloads(svgText) {
  return svgText.split("base64,").length - 1;
}

/**
 * Choose what to hand `sharp` for a source (PR 084).
 *
 * **Layered** (2+ payloads) → the SVG itself, so librsvg composites every layer at its declared
 * position. This is the bug fix: `extractBase64Png` takes only the FIRST payload, so a layered
 * source shipped as its bare base layer and the monitors, keyboards, sink and maps were discarded.
 *
 * **Single-layer** → the unwrapped PNG, exactly as before. This is not a shortcut: 62 of the 66
 * single-layer sources declare their lone `<image>` at full canvas with no offset, so unwrapping is
 * *equivalent* to rendering, and the remaining 4 differ only by a pixel of shell padding that
 * `.trim()` handles. Routing them through librsvg would resample every one for no gain — it
 * perturbs all 86 outputs instead of the 20 that are actually broken. It also avoids a hard limit:
 * `Lounge-3.svg` carries a single 15,990,536-byte base64 attribute, past libxml2's 10,000,000-byte
 * `XML_MAX_TEXT_LENGTH`, so librsvg refuses it ("XML parse error"). It is single-layer, so this
 * path never asks librsvg to parse it. No other source comes close (next largest: 9,754,584).
 *
 * `limitInputPixels: false` is needed only for the SVG path — these sources rasterise to ~4400x3800,
 * over sharp's default guard.
 */
export function pickRasterInput(svgText, png) {
  return countBase64Payloads(svgText) > 1
    ? { input: Buffer.from(svgText, "utf8"), options: { limitInputPixels: false } }
    : { input: png, options: {} };
}

/**
 * The same SVG shell carrying ONLY its first `<image>` layer (PR 084 continuation).
 *
 * The shell and its viewBox are preserved, so layer zero renders on the identical canvas at the
 * identical position — that is the whole point. A booked desk must be the SAME desk at the SAME
 * size in the SAME place, and sprites are scaled to fill the object's width, so the drawn height
 * follows the asset's aspect ratio. Any asset that trims to a different box is therefore a resize.
 * Rendering layer zero on the full canvas and cropping it to the FULL render's trim rectangle (see
 * `emitBareVariant`) guarantees an identical box, rather than hoping two assets happen to match.
 */
export function layerZeroOnly(svgText) {
  const first = svgText.indexOf("<image");
  if (first === -1) return svgText;
  const firstEnd = svgText.indexOf(">", first) + 1;
  const rest = svgText.slice(firstEnd);
  const close = rest.lastIndexOf("</svg>");
  return svgText.slice(0, firstEnd) + (close === -1 ? "</svg>" : rest.slice(close));
}

/** Intrinsic pixel dims declared on the `<svg>` shell (best-effort, for reference). */
export function extractSvgDims(svgText) {
  const w = svgText.match(/<svg[^>]*\bwidth="(\d+(?:\.\d+)?)"/);
  const h = svgText.match(/<svg[^>]*\bheight="(\d+(?:\.\d+)?)"/);
  return { width: w ? Number(w[1]) : null, height: h ? Number(h[1]) : null };
}

/**
 * Default footprint anchor: the normalized sub-rectangle of the (trimmed) sprite that meets
 * the floor. Convention: normalized to the trimmed bounds; the sprite is placed so this
 * rectangle maps onto the object's top-down floor rect, and the rest of the sprite overflows
 * UPWARD (height). Default = the full-width bottom half — a heuristic; per-asset refinement
 * comes from `manifest.overrides.json` (Phase B tunes real anchors).
 */
export function defaultFootprint() {
  return { x: 0, y: 0.5, width: 1, height: 0.5 };
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

async function loadJsonIfExists(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const force = process.argv.includes("--force");
  if (!existsSync(SRC_DIR)) {
    console.error(`[iso] source dir missing: ${SRC_DIR}`);
    console.error("[iso] the owner places the asset library at assets-src/iso/ (gitignored).");
    process.exit(1);
  }
  const { default: sharp } = await import("sharp");
  await mkdir(OUT_DIR, { recursive: true });

  const overrides = (await loadJsonIfExists(OVERRIDES_PATH)) ?? {};
  const prev = (await loadJsonIfExists(MANIFEST_PATH)) ?? { assets: [] };
  const prevByKey = new Map((prev.assets ?? []).map((a) => [a.key, a]));

  const files = (await readdir(SRC_DIR)).filter((f) => f.toLowerCase().endsWith(".svg")).sort();
  const assets = [];
  let processed = 0;
  let skipped = 0;
  const failures = [];
  let totalOutBytes = 0;

  for (const file of files) {
    const sourceName = file.replace(/\.svg$/i, "");
    const meta = deriveMeta(sourceName);
    try {
      const svgText = await readFile(join(SRC_DIR, file), "utf8");
      const png = extractBase64Png(svgText);
      if (!png) throw new Error("no base64 PNG payload found");
      // Hash the WHOLE source, so a change in ANY layer invalidates the cache (PR 084).
      const hash = sha256(Buffer.from(svgText, "utf8"));
      const { input: rasterInput, options: rasterOptions } = pickRasterInput(svgText, png);

      const outputs = WIDTHS.map((w) => ({ width: w, file: `${meta.key}-${w}.webp` }));
      const outputsExist = outputs.every((o) => existsSync(join(OUT_DIR, o.file)));
      const cached = prevByKey.get(meta.key);

      let trimmed = cached?.trimmed;
      let outSizes = cached?.outputs;

      if (!force && cached && cached.sourceHash === hash && outputsExist) {
        skipped += 1;
      } else {
        const base = sharp(rasterInput, rasterOptions).trim();
        const tMeta = await base.metadata();
        trimmed = { width: tMeta.width ?? null, height: tMeta.height ?? null };
        outSizes = [];
        for (const o of outputs) {
          const buf = await sharp(rasterInput, rasterOptions)
            .trim()
            .resize({ width: o.width, withoutEnlargement: true })
            .webp({ quality: WEBP_QUALITY })
            .toBuffer();
          await writeFile(join(OUT_DIR, o.file), buf);
          outSizes.push({ width: o.width, file: o.file, bytes: buf.length });
        }
        processed += 1;
      }

      for (const o of outSizes ?? []) totalOutBytes += o.bytes ?? 0;
      const ov = overrides[meta.key] ?? {};

      // A "bare" counterpart: layer zero of a LAYERED source, cropped to the full render's trim
      // rect so it is pixel-for-pixel the same box. Opt-in per key via `emitBare` in the overrides,
      // because only a human can say whether a source's layer zero is a usable clear desk — the
      // build cannot. (Bases 3 and 4 have their monitor in layer zero, so they are not marked.)
      let bareAsset = null;
      if (ov.emitBare && countBase64Payloads(svgText) > 1) {
        const bareKey = `${meta.key}-bare`;
        const bareOutputs = WIDTHS.map((w) => ({ width: w, file: `${bareKey}-${w}.webp` }));
        const bareExist = bareOutputs.every((o) => existsSync(join(OUT_DIR, o.file)));
        const bareCached = prevByKey.get(bareKey);
        let bareSizes = bareCached?.outputs;
        if (force || !bareCached || bareCached.sourceHash !== hash || !bareExist) {
          const full = await sharp(rasterInput, rasterOptions)
            .trim()
            .toBuffer({ resolveWithObject: true });
          const box = {
            left: -full.info.trimOffsetLeft,
            top: -full.info.trimOffsetTop,
            width: full.info.width,
            height: full.info.height,
          };
          const l0 = Buffer.from(layerZeroOnly(svgText), "utf8");
          bareSizes = [];
          for (const o of bareOutputs) {
            const buf = await sharp(l0, { limitInputPixels: false })
              .extract(box) // the FULL render's box — never an independent trim
              .resize({ width: o.width, withoutEnlargement: true })
              .webp({ quality: WEBP_QUALITY })
              .toBuffer();
            await writeFile(join(OUT_DIR, o.file), buf);
            bareSizes.push({ width: o.width, file: o.file, bytes: buf.length });
          }
        }
        for (const o of bareSizes ?? []) totalOutBytes += o.bytes ?? 0;
        const bov = overrides[bareKey] ?? {};
        bareAsset = {
          ...meta,
          key: bareKey,
          descriptor: "Bare",
          type: bov.type ?? null,
          role: bov.role ?? null,
          sourceHash: hash,
          svgDims: extractSvgDims(svgText),
          trimmed,
          aspectRatio:
            trimmed?.width && trimmed?.height ? +(trimmed.width / trimmed.height).toFixed(4) : null,
          footprint: bov.footprint ?? defaultFootprint(),
          outputs: bareSizes,
        };
      }
      assets.push({
        ...meta,
        type: ov.type ?? null, // LayoutObject type mapping (filled in Phase B / overrides)
        role: ov.role ?? null, // ratified role: unused | standalone-desk | structural | …
        sourceHash: hash,
        svgDims: extractSvgDims(svgText),
        trimmed,
        aspectRatio:
          trimmed?.width && trimmed?.height ? +(trimmed.width / trimmed.height).toFixed(4) : null,
        footprint: ov.footprint ?? defaultFootprint(),
        outputs: outSizes,
      });
      if (bareAsset) assets.push(bareAsset);
    } catch (err) {
      failures.push({ sourceName, error: String(err.message ?? err) });
    }
  }

  const manifest = {
    generatedBy: "scripts/build-iso-assets.mjs",
    widths: WIDTHS,
    count: assets.length,
    assets: assets.sort((a, b) => a.key.localeCompare(b.key)),
  };
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  console.log(
    `[iso] sources=${files.length} processed=${processed} skipped=${skipped} failed=${failures.length} ` +
      `output=${assets.length} assets, ${kb(totalOutBytes)} across ${WIDTHS.length} widths`
  );
  if (failures.length) {
    for (const f of failures) console.error(`[iso] FAILED ${f.sourceName}: ${f.error}`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
