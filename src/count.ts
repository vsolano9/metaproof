/**
 * Unicode-aware character counting.
 *
 * App Store Connect counts "characters", not bytes and not UTF-16 code units.
 * `String.prototype.length` (UTF-16 code units) over-counts astral characters
 * such as emoji, and byte length over-counts everything non-ASCII. metaproof
 * counts user-perceived characters (grapheme clusters) as its canonical measure
 * so that a family emoji or a flag counts as one character, matching what a
 * human sees in the App Store Connect text field.
 */

const graphemeSegmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

/** Count user-perceived characters (grapheme clusters). */
export function graphemeCount(value: string): number {
  let count = 0;
  for (const _segment of graphemeSegmenter.segment(value)) count++;
  return count;
}

/** Count Unicode code points (astral characters count once, unlike `.length`). */
export function codePointCount(value: string): number {
  let count = 0;
  for (const _cp of value) count++;
  return count;
}
