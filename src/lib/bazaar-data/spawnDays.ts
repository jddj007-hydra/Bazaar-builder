import { normalizeCardTier } from "./cardRecord";
import type { CardTier } from "./types";

/**
 * "Which days can this card appear on?" — answered from the game's own
 * per-day tier table rather than from source records.
 *
 * Source and merchant records almost never carry a day window (7 of 224
 * sources do), so the catalog's day filter used to intersect against a nearly
 * empty set: picking "第1天" on Vanessa left a single card. The game mode ships
 * `ItemSkillSpawnTierPercantagesByDay`, which states which tiers can roll on
 * each day, and a card's `availableTiers` says which tiers it exists in — the
 * intersection is the day window the player actually experiences.
 */

export type SpawnTiersByDay = Record<string, CardTier[]>;

export function normalizeSpawnTiersByDay(raw: unknown): SpawnTiersByDay {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const tiersByDay = (source.tiersByDay ?? source) as Record<string, unknown>;
  const table: SpawnTiersByDay = {};

  for (const [day, tiers] of Object.entries(tiersByDay)) {
    if (!/^\d+$/.test(day)) continue;
    if (!Array.isArray(tiers)) continue;
    const normalized = tiers
      .map((tier) => normalizeCardTier(tier))
      .filter((tier): tier is CardTier => Boolean(tier));
    if (normalized.length > 0) table[day] = normalized;
  }

  return table;
}

/**
 * Days on which a card with these `availableTiers` can spawn. Cards whose
 * tiers are missing from the table (or a table that is empty) fall back to
 * "every day", so a missing manifest degrades to the previous behaviour
 * instead of hiding cards.
 */
export function daysForAvailableTiers(availableTiers: CardTier[] | undefined, table: SpawnTiersByDay): number[] {
  const days = Object.keys(table);
  if (days.length === 0) return [];
  if (!availableTiers || availableTiers.length === 0) return [];

  return days
    .filter((day) => table[day].some((tier) => availableTiers.includes(tier)))
    .map(Number)
    .sort((a, b) => a - b);
}
