import type { ItemIndexEntry } from "./types";

/**
 * Predicates behind the catalog filter panel, kept out of the view so their
 * semantics can be tested directly.
 *
 * Multi-select facets combine as OR within a facet and AND across facets:
 * 武器 + 工具 means "weapon or tool", and adding 小 means "…and small". The
 * competitor filter bars (How Bazaar, the community wikis) read the same way;
 * requiring every selected tag made a two-chip selection collapse to the ~70
 * items carrying both tags, with nothing on screen explaining why.
 */

export function itemMatchesHero(item: Pick<ItemIndexEntry, "hero" | "heroes">, hero: string): boolean {
  if (item.heroes) {
    return item.heroes.length === 0 || item.heroes.includes(hero);
  }
  return item.hero == null || item.hero === hero;
}

export function itemMatchesCategory(item: Pick<ItemIndexEntry, "tags">, categories: string[]): boolean {
  return categories.length === 0 || categories.some((category) => item.tags.includes(category));
}

export function itemMatchesSize(item: Pick<ItemIndexEntry, "size">, size: string): boolean {
  return !size || item.size === Number(size);
}

export function itemMatchesStartTier(item: Pick<ItemIndexEntry, "defaultTier">, startTier: string): boolean {
  return !startTier || item.defaultTier === startTier;
}

export function itemHasAmmo(item: Pick<ItemIndexEntry, "ammoMax" | "tags">): boolean {
  return Boolean(item.ammoMax) || item.tags.includes("ammo");
}

/**
 * The day filter asks "can this card show up on day N?", which the game
 * answers with its per-day tier table — not with source windows, which almost
 * never exist (7 of 224 sources carry one).
 */
export function itemMatchesDay(item: Pick<ItemIndexEntry, "availableDays">, day: string): boolean {
  if (!day) return true;
  const selectedDay = Number(day);
  if (!Number.isInteger(selectedDay)) return true;
  const days = item.availableDays;
  // No table for this card: keep it rather than silently hiding data.
  if (!days || days.length === 0) return true;
  return days.includes(selectedDay);
}

export function itemMatchesSourceFilters(
  item: Pick<ItemIndexEntry, "sourceIds">,
  sourceId: string
): boolean {
  if (!sourceId) return true;
  return Boolean(item.sourceIds?.includes(sourceId));
}

export function itemMatchesMerchantFilters(
  item: Pick<ItemIndexEntry, "merchantIds">,
  merchantId: string
): boolean {
  if (!merchantId) return true;
  return Boolean(item.merchantIds?.includes(merchantId));
}

/**
 * Facets combine as AND. The day chip is no longer entangled with the source
 * and merchant pickers: it filters on the card's own spawn days, so a day plus
 * a merchant means "this merchant, on a day this card can appear".
 */
export function itemMatchesItemFilters(
  item: Pick<ItemIndexEntry, "tags" | "size" | "defaultTier" | "sourceIds" | "merchantIds" | "availableDays">,
  categories: string[],
  size: string,
  startTier = "",
  sourceId = "",
  merchantId = "",
  day = ""
): boolean {
  return (
    itemMatchesCategory(item, categories) &&
    itemMatchesSize(item, size) &&
    itemMatchesStartTier(item, startTier) &&
    itemMatchesDay(item, day) &&
    itemMatchesSourceFilters(item, sourceId) &&
    itemMatchesMerchantFilters(item, merchantId)
  );
}
