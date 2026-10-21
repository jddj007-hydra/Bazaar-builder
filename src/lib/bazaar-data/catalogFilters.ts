import type { ItemIndexEntry, SourceIndexEntry } from "./types";

/** Only the day window is consulted, so callers can pass lightweight maps. */
type DayWindowSource = Pick<SourceIndexEntry, "days">;

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

export function sourceMatchesDay(source: Pick<SourceIndexEntry, "days">, day: string): boolean {
  if (!day) return true;
  const selectedDay = Number(day);
  return Number.isInteger(selectedDay) && source.days.includes(selectedDay);
}

export const merchantMatchesDay = sourceMatchesDay;

export function itemMatchesSourceFilters(
  item: Pick<ItemIndexEntry, "sourceIds">,
  sourceId: string,
  day: string,
  sourceById: Map<string, DayWindowSource>
): boolean {
  if (!sourceId && !day) return true;
  return Boolean(
    item.sourceIds?.some((candidateSourceId) => {
      if (sourceId && candidateSourceId !== sourceId) return false;
      const source = sourceById.get(candidateSourceId);
      return source ? sourceMatchesDay(source, day) : !day;
    })
  );
}

export function itemMatchesMerchantFilters(
  item: Pick<ItemIndexEntry, "merchantIds">,
  merchantId: string,
  day: string,
  merchantById: Map<string, DayWindowSource>
): boolean {
  if (!merchantId) return true;
  return Boolean(
    item.merchantIds?.some((candidateMerchantId) => {
      if (candidateMerchantId !== merchantId) return false;
      const merchant = merchantById.get(candidateMerchantId);
      return merchant ? merchantMatchesDay(merchant, day) : !day;
    })
  );
}

/**
 * The day chip is a scope, not a standalone requirement: on its own it narrows
 * to cards from that day's encounters, and combined with a merchant it only
 * keeps the merchant's own day window.
 */
export function itemMatchesItemFilters(
  item: Pick<ItemIndexEntry, "tags" | "size" | "defaultTier" | "sourceIds" | "merchantIds">,
  categories: string[],
  size: string,
  startTier = "",
  sourceId = "",
  merchantId = "",
  day = "",
  sourceById: Map<string, DayWindowSource> = new Map(),
  merchantById: Map<string, DayWindowSource> = new Map()
): boolean {
  const sourceMatches = sourceId || (day && !merchantId) ? itemMatchesSourceFilters(item, sourceId, day, sourceById) : true;
  return (
    itemMatchesCategory(item, categories) &&
    itemMatchesSize(item, size) &&
    itemMatchesStartTier(item, startTier) &&
    sourceMatches &&
    itemMatchesMerchantFilters(item, merchantId, day, merchantById)
  );
}
