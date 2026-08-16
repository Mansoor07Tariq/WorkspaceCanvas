#!/usr/bin/env node
/**
 * Isometric asset pipeline (PR 080, Phase A).
 *
 * Reads the owner's source library at `assets-src/iso/*.svg` — each file is a base64-encoded
 * PNG wrapped in a thin SVG shell (`data:img/png;base64,…`, note the non-standard `img/png`;
 * the payload is a real PNG). For each source it:
 *   1. unwraps the base64 PNG,
 *   2. trims transparent margins (sharp `.trim()`),
 *   3. emits optimized WebP at two widths (256 + 640, downscale-only) into
 *      `frontend/src/assets/iso/` (this OUTPUT is committed; the sources are gitignored),
 *   4. parses the real filename into {baseType, variantIndex, descriptor} and records a
 *      footprint anchor, into a generated `manifest.json`.
 *
 * Idempotent + incremental: a source whose content hash is unchanged and whose outputs
 * exist is skipped. Re-run any time the owner drops new art. `--force` reprocesses all.
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
      const hash = sha256(png);

      const outputs = WIDTHS.map((w) => ({ width: w, file: `${meta.key}-${w}.webp` }));
      const outputsExist = outputs.every((o) => existsSync(join(OUT_DIR, o.file)));
      const cached = prevByKey.get(meta.key);

      let trimmed = cached?.trimmed;
      let outSizes = cached?.outputs;

      if (!force && cached && cached.sourceHash === hash && outputsExist) {
        skipped += 1;
      } else {
        const base = sharp(png).trim();
        const tMeta = await base.metadata();
        trimmed = { width: tMeta.width ?? null, height: tMeta.height ?? null };
        outSizes = [];
        for (const o of outputs) {
          const buf = await sharp(png)
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
