import type { SpawningEligibility } from "./types";

export type CatalogSortKey =
  | "name"
  | "hero"
  | "size-asc"
  | "size-desc"
  | "tier-asc"
  | "tier-desc"
  | "value-asc"
  | "value-desc"
  | "cooldown-asc"
  | "cooldown-desc";

/**
 * Card names are mostly Chinese, so the browser's default collation (which
 * follows `<html lang>` and the OS locale) orders them by code point and looks
 * arbitrary — "塔架" landed before "阿尔法射线". Sort with an explicit zh-Hans
 * collator so names read in pinyin order.
 */
export const catalogNameCollator = new Intl.Collator("zh-Hans-CN", { sensitivity: "base" });

export function compareCatalogNames(a: string, b: string): number {
  return catalogNameCollator.compare(a, b);
}

export type CatalogSortable = {
  entityType: "item" | "skill";
  name: string;
  heroes?: string[];
  size?: number;
  value?: number | null;
  cooldownMs?: number | null;
  defaultTier?: string | null;
  rarity?: string | null;
};

const tierRanks: Record<string, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  diamond: 4,
  legendary: 5
};

export function tierRank(tier: string | null | undefined): number {
  return tierRanks[tier?.toLowerCase() ?? ""] ?? 0;
}

/**
 * The card's starting tier. `rarity` is the selected tier in some views, so
 * prefer `defaultTier` when present and fall back to `rarity`.
 */
function startingTier(entity: CatalogSortable): number {
  return tierRank(entity.defaultTier ?? entity.rarity);
}

/** Universal cards (no hero) sort first, then the hero filter's own order. */
function heroRank(entity: CatalogSortable, heroOrder: string[]): number {
  const heroes = entity.heroes ?? [];
  if (heroes.length === 0) return -1;
  const rank = heroOrder.indexOf(heroes[0]);
  return rank < 0 ? heroOrder.length : rank;
}

/**
 * Missing values sort last in both directions: a card without a cooldown is
 * passive, not "faster than 0 seconds", and a card without a value is not the
 * cheapest one.
 */
function compareWithMissing(a: number | null, b: number | null, direction: number): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return (a - b) * direction;
}

function sortValue(entity: CatalogSortable, sort: CatalogSortKey, heroOrder: string[]): number | null {
  switch (sort) {
    case "hero":
      return heroRank(entity, heroOrder);
    case "size-asc":
    case "size-desc":
      // Skills have no board size; they keep the medium slot and sort together.
      return entity.entityType === "item" ? (entity.size ?? 2) : 2;
    case "tier-asc":
    case "tier-desc":
      return startingTier(entity);
    case "value-asc":
    case "value-desc":
      return entity.value ?? null;
    case "cooldown-asc":
    case "cooldown-desc":
      return entity.cooldownMs ?? null;
    default:
      return 0;
  }
}

/**
 * Sorts catalog results. Every non-name sort falls back to the pinyin name
 * order so equal heroes/tiers/sizes/values stay readable, matching the way the
 * community databases (How Bazaar: Name / Tier / Size / Hero) tie-break.
 */
export function compareCatalogEntities(
  a: CatalogSortable,
  b: CatalogSortable,
  sort: CatalogSortKey,
  heroOrder: string[] = []
): number {
  if (sort === "name") return compareCatalogNames(a.name, b.name);

  const direction = sort.endsWith("-desc") ? -1 : 1;
  const valueDelta = compareWithMissing(sortValue(a, sort, heroOrder), sortValue(b, sort, heroOrder), direction);
  if (valueDelta !== 0) return valueDelta;
  return compareCatalogNames(a.name, b.name);
}

/**
 * Cards the catalog hides by default: `Never` cards cannot be obtained in a
 * run at all, and `package` cards (merchant/enchantment packages) are shop
 * rewards that are never placed on the board.
 */
export function isHiddenByDefault(entity: { spawningEligibility?: SpawningEligibility; tags?: string[] }): boolean {
  return entity.spawningEligibility === "Never" || Boolean(entity.tags?.includes("package"));
}
