// Fixture collector: validates the 8 real-world pitfalls with byte comparison.
// Run: node scripts/collect-fixtures.mjs
// Pitfalls covered:
//  1. BOM/encoding: parser strips BOM but serializer re-emits (Buffer.equals, not string ==).
//  2. Mixed CRLF/LF: per-line EOL preserved, never normalized to root.eol.
//  3. Trailing spaces/tabs: unmodified nodes replay raw verbatim.
//  4. "+ component {" vs "+component{" spacing: accepted, open line replayed verbatim.
//  5. Nested "+ hbox { + label {...} }": parser keeps nesting + range; single-line
//     components stay Unknown-raw (passthrough) in Spike.
//  6. Unknown attrs (terminal-*, scrollbar_*, circular_progress): Unknown nodes raw replay.
//  7. Resource paths with spaces/./backslash: scanMissingAssets matches raw string.
//  8. Duplicate keys: order preserved, semantic takes last, serializer never dedups.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "samples");
const files = readdirSync(dir).filter((f) => f.endsWith("-theme.txt"));
console.log(`fixtures: ${files.join(", ")}`);
for (const f of files) {
  const buf = readFileSync(join(dir, f)); // Buffer: BOM + CRLF preserved
  const hasBOM = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const crlf = (buf.toString("latin1").match(/\r\n/g) || []).length;
  const lf = (buf.toString("latin1").match(/(?<!\r)\n/g) || []).length;
  const trailingWs = buf.toString("latin1").split(/\r?\n/).filter((l) => /[ \t]$/.test(l)).length;
  console.log(`${f}: bytes=${buf.length} BOM=${hasBOM} CRLF=${crlf} LF=${lf} trailingWsLines=${trailingWs}`);
}
console.log("NOTE: Gate2-A must use Buffer.from(serializeTheme(root, new Set()),'utf8').equals(buf).");
