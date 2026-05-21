import merchantData from "./merchant-data.json";
import type { CardTier, ItemDef, ItemSize, SourceIndexEntry } from "./types";

type MerchantCardSize = "Small" | "Medium" | "Large";

type MerchantFilter = {
  tag?: string[];
  hiddenTag?: string[];
  tier?: CardTier[];
  size?: MerchantCardSize[];
  heroes?: string[];
  notTag?: string[];
  enchantmentOnly?: boolean;
  unrestricted?: boolean;
  ignoreHero?: boolean;
};

export type MerchantDefinition = {
  id: string;
  name: string;
  isHeroMerchant?: boolean;
  heroes: string[];
  filters?: MerchantFilter;
};

type MerchantItemCandidate = Pick<ItemDef, "hero" | "size" | "tags" | "defaultTier">;

const merchantDefinitions = merchantData as MerchantDefinition[];

const ITEM_HERO_NAMES: Record<string, string> = {
  common: "Common",
  vanessa: "Vanessa",
  pygmalien: "Pygmalien",
  dooley: "Dooley",
  mak: "Mak",
  stelle: "Stelle",
  jules: "Jules",
  karnok: "Karnok"
};

const ITEM_SIZE_NAMES: Record<ItemSize, MerchantCardSize> = {
  1: "Small",
  2: "Medium",
  3: "Large"
};

const MERCHANT_SUMMARY_LABELS: Record<string, string> = {
  Aero: "Drones/Vehicles",
  Aila: "Weapons",
  Aimbot: "Crit",
  Ande: "Small",
  Barkun: "Medium/Large",
  Chronos: "Haste",
  Cobweb: "Slow",
  Colt: "Ammo",
  Curio: "Junk",
  Dooley: "Dooley",
  Eli: "Potions",
  Flex: "Max Health",
  Freiya: "Freeze",
  Gaseo: "Apparel",
  Gastro: "Food",
  Goldie: "Gold tier",
  Hef: "Burn",
  Herma: "Heal/Regen",
  "Jay Jay": "General",
  Jules: "Jules",
  Karnok: "Karnok",
  "Kev's Armory": "Health/Shield",
  Kina: "Non-Weapon",
  Knightshade: "Poison",
  Luxe: "Diamond tier",
  Mak: "Mak",
  Midsworth: "Small/Large",
  Mittel: "Medium",
  "Mr. Morland": "Property",
  Nautica: "Aquatic",
  Orion: "Tools",
  Pinfeather: "Flying",
  Pol: "Large",
  Prospero: "Economy",
  Pygmalien: "Pyg",
  Quixel: "Small/Medium",
  Serafina: "Enchantments",
  "Shelter Shelby": "Friends",
  Silvia: "Silver tier",
  Stelle: "Stelle",
  Tatiana: "Toys",
  "The Antiquarian": "Relics",
  "The Tester": "Tech",
  Tinker: "Friends",
  "Tok's Clocks": "Haste/Slow/Cooldown",
  Valpak: "Discount",
  Vanessa: "Vanessa"
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function itemHeroName(item: Pick<MerchantItemCandidate, "hero">): string {
  return item.hero ? ITEM_HERO_NAMES[item.hero] ?? item.hero : "Common";
}

function itemSizeName(item: Pick<MerchantItemCandidate, "size">): MerchantCardSize {
  return ITEM_SIZE_NAMES[item.size];
}

function itemTagSet(item: Pick<MerchantItemCandidate, "tags">): Set<string> {
  return new Set(item.tags.map(normalizeToken));
}

function merchantFilterList<T>(values: T[] | undefined): T[] {
  return Array.isArray(values) ? values : [];
}

export function merchantSourceId(merchantId: string): string {
  return `merchant:${merchantId}`;
}

export function merchantSummaryLabel(merchant: MerchantDefinition): string {
  return MERCHANT_SUMMARY_LABELS[merchant.name] ?? "Merchant";
}

export function getMerchantDefinitions(): MerchantDefinition[] {
  return merchantDefinitions;
}

export function itemMatchesMerchant(
  item: MerchantItemCandidate,
  merchant: MerchantDefinition
): boolean {
  const hero = itemHeroName(item);
  if (merchant.isHeroMerchant) {
    return hero === merchant.name;
  }

  const filters = merchant.filters;
  if (filters?.enchantmentOnly) {
    return false;
  }

  const tags = itemTagSet(item);
  const size = itemSizeName(item);

  const requiredTags = merchantFilterList(filters?.tag);
  if (requiredTags.length > 0 && !requiredTags.some((tag) => tags.has(normalizeToken(tag)))) {
    return false;
  }

  const requiredHiddenTags = merchantFilterList(filters?.hiddenTag);
  if (requiredHiddenTags.length > 0 && !requiredHiddenTags.some((tag) => tags.has(normalizeToken(tag)))) {
    return false;
  }

  const blockedTags = merchantFilterList(filters?.notTag);
  if (blockedTags.some((tag) => tags.has(normalizeToken(tag)))) {
    return false;
  }

  const requiredTiers = merchantFilterList(filters?.tier);
  if (requiredTiers.length > 0 && !requiredTiers.includes(item.defaultTier)) {
    return false;
  }

  const requiredSizes = merchantFilterList(filters?.size);
  if (requiredSizes.length > 0 && !requiredSizes.includes(size)) {
    return false;
  }

  const filterHeroes = merchantFilterList(filters?.heroes);
  if (filterHeroes.length > 0 && !filterHeroes.includes(hero)) {
    return false;
  }

  if (!filters?.ignoreHero) {
    const merchantHeroes = merchantFilterList(merchant.heroes);
    if (merchantHeroes.length > 0 && hero !== "Common" && !merchantHeroes.includes(hero)) {
      return false;
    }
  }

  return true;
}

export function merchantIdsForItem(item: MerchantItemCandidate): string[] {
  return merchantDefinitions
    .filter((merchant) => itemMatchesMerchant(item, merchant))
    .map((merchant) => merchantSourceId(merchant.id));
}

export function normalizeMerchantIndex(
  items: Array<Pick<ItemDef, "merchantIds" | "sourceIds">>,
  sources: SourceIndexEntry[]
): SourceIndexEntry[] {
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  return merchantDefinitions
    .map((merchant) => {
      const id = merchantSourceId(merchant.id);
      const matchedItems = items.filter((item) => item.merchantIds?.includes(id));
      const days = new Set<number>();

      for (const item of matchedItems) {
        for (const sourceId of item.sourceIds ?? []) {
          const source = sourceById.get(sourceId);
          for (const day of source?.days ?? []) {
            days.add(day);
          }
        }
      }

      const normalizedDays = [...days].sort((a, b) => a - b);
      return {
        id,
        name: merchant.name,
        nameEn: merchant.name,
        category: "Merchants",
        categoryType: merchantSummaryLabel(merchant),
        days: normalizedDays,
        availabilityLabels: normalizedDays.map((day) => (day === 10 ? "Day 10+" : `Day ${day}`)),
        cardCount: matchedItems.length
      } satisfies SourceIndexEntry;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
