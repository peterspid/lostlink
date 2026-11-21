import { keywordOverlap, tokens } from "@/lib/match-score";
import type { ItemAttributes } from "@/lib/db/schema";

/** Loose comparison so "Blue sticker" ~ "a blue sticker of a cat". Only a hint for the finder. */
export function answerLooksRight(expected: string, given: string): boolean {
  const e = tokens(expected);
  const g = tokens(given);
  if (e.size === 0) return given.trim().toLowerCase() === expected.trim().toLowerCase();
  let hit = 0;
  for (const t of e) if (g.has(t) || g.has(t.replace(/s$/, ""))) hit++;
  return hit / e.size >= 0.5;
}

/** True when an alert query plausibly describes the item (semantic or every keyword present). */
export function alertMatchesText(
  query: string,
  item: { title: string; description: string; category: string; attributes: ItemAttributes },
  similarity: number | null,
): boolean {
  if (similarity != null && similarity >= 0.72) return true;
  const q = tokens(query);
  if (q.size === 0) return true; // category/radius-only alert
  const itemTokens = tokens(
    [item.title, item.description, item.category, item.attributes?.color, item.attributes?.brand, item.attributes?.material].filter(Boolean).join(" "),
  );
  let present = 0;
  for (const t of q) if (itemTokens.has(t) || itemTokens.has(t.replace(/s$/, ""))) present++;
  return (
    present === q.size ||
    (q.size >= 3 && present / q.size >= 0.66) ||
    keywordOverlap({ title: query, description: "", attributes: {} }, item) >= 0.99
  );
}
