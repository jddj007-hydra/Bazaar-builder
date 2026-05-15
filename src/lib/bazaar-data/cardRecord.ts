import { slugify } from "./slug";
import type { CardTier } from "./types";

const CARD_TIER_ORDER: CardTier[] = ["Bronze", "Silver", "Gold", "Diamond", "Legendary"];

export type RawRecord = Record<string, unknown>;

const HERO_TAGS = new Set([
  "Common",
  "Vanessa",
  "Pygmalien",
  "Dooley",
  "Mak",
  "Stelle",
  "Jules",
  "Karnok"
]);

const SIZE_TAGS = new Set(["Small", "Medium", "Large"]);
const TYPE_TAGS = new Set(["Item", "Skill"]);

export function asRecord(value: unknown): RawRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RawRecord) : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function stringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

export function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

export function getCollection(raw: unknown, key: string): RawRecord[] {
  const root = asRecord(raw);
  return asArray(root[key]).map(asRecord).filter((record) => Object.keys(record).length > 0);
}

export function getStringArray(record: RawRecord, key: string): string[] {
  return asArray(record[key]).map(stringValue).filter((value): value is string => Boolean(value));
}

export function getCardId(record: RawRecord, fallbackPrefix: string): string {
  return stringValue(record.Id) ?? stringValue(record.id) ?? `${fallbackPrefix}-${getCardName(record)}`;
}

export function getCardName(record: RawRecord, locale = "zh-CN"): string {
  const title = asRecord(record.Title);
  const i18nRoot = asRecord(record.i18n);
  const preferredLocale = asRecord(i18nRoot[locale]);
  const preferredTitle = asRecord(preferredLocale.Title);
  const i18nEn = asRecord(i18nRoot["en-US"]);
  const i18nTitle = asRecord(i18nEn.Title);

  return (
    stringValue(preferredTitle.Text) ??
    stringValue(title.Text) ??
    stringValue(record.Name) ??
    stringValue(record.name) ??
    stringValue(i18nTitle.Text) ??
    stringValue(record._originalTitleText) ??
    "Unknown"
  );
}

export function getEnglishCardName(record: RawRecord): string {
  return getCardName(record, "en-US");
}

export function getBaseTier(record: RawRecord): string | null {
  return stringValue(record.BaseTier) ?? stringValue(record.baseTier) ?? null;
}

export function normalizeCardTier(value: unknown): CardTier | null {
  const tier = stringValue(value)?.toLowerCase();
  if (tier === "bronze") return "Bronze";
  if (tier === "silver") return "Silver";
  if (tier === "gold") return "Gold";
  if (tier === "diamond") return "Diamond";
  if (tier === "legendary") return "Legendary";
  return null;
}

export function getAvailableTiers(record: RawRecord): CardTier[] {
  const tiers = Object.keys(asRecord(record.Tiers)).map(normalizeCardTier).filter((tier): tier is CardTier => Boolean(tier));
  const baseTier = normalizeCardTier(getBaseTier(record));
  return [...new Set([baseTier, ...tiers].filter((tier): tier is CardTier => Boolean(tier)))]
    .sort((a, b) => CARD_TIER_ORDER.indexOf(a) - CARD_TIER_ORDER.indexOf(b));
}

function effectiveAttributes(record: RawRecord, tier?: string | null): RawRecord {
  const baseAttributes = asRecord(record.BaseAttributes);
  const normalizedTier = normalizeCardTier(tier);
  const overrideAttributes = normalizedTier
    ? asRecord(asRecord(asRecord(record.Tiers)[normalizedTier]).OverrideAttributes)
    : {};

  return { ...baseAttributes, ...overrideAttributes };
}

export function normalizeSize(value: unknown): 1 | 2 | 3 {
  const size = stringValue(value)?.toLowerCase();
  if (size === "small" || size === "s" || size === "1") return 1;
  if (size === "medium" || size === "m" || size === "2") return 2;
  if (size === "large" || size === "l" || size === "3") return 3;
  return 1;
}

export function getRawSizeValue(record: RawRecord): unknown {
  const explicit = record.Size ?? record.size;
  if (explicit != null) {
    return explicit;
  }

  const sizeTag = [
    ...getStringArray(record, "DisplayTags"),
    ...getStringArray(record, "HiddenTags"),
    ...getStringArray(record, "Tags")
  ].find((tag) => SIZE_TAGS.has(tag));

  return sizeTag ?? null;
}

export function getCooldownMs(record: RawRecord): number | null {
  return getCooldownMsForTier(record, getBaseTier(record));
}

export function getCooldownMsForTier(record: RawRecord, tier?: string | null): number | null {
  const attrs = effectiveAttributes(record, tier);
  const cooldown =
    numberValue(attrs.CooldownMax) ??
    numberValue(attrs.cooldownMax) ??
    numberValue(record.CooldownMax) ??
    numberValue(record.cooldownMs);

  if (cooldown == null || cooldown <= 0) {
    return null;
  }

  return cooldown < 100 ? Math.round(cooldown * 1000) : Math.round(cooldown);
}

export function getAmmoMax(record: RawRecord): number | null {
  return getAmmoMaxForTier(record, getBaseTier(record));
}

export function getAmmoMaxForTier(record: RawRecord, tier?: string | null): number | null {
  const attrs = effectiveAttributes(record, tier);
  const ammoMax =
    numberValue(attrs.AmmoMax) ??
    numberValue(attrs.ammoMax) ??
    numberValue(record.AmmoMax) ??
    numberValue(record.ammoMax);

  return ammoMax == null || ammoMax <= 0 ? null : Math.round(ammoMax);
}

export function getItemValue(record: RawRecord): number | null {
  return getItemValueForTier(record, getBaseTier(record));
}

export function getItemValueForTier(record: RawRecord, tier?: string | null): number | null {
  const attrs = effectiveAttributes(record, tier);
  const value =
    numberValue(attrs.SellPrice) ??
    numberValue(attrs.Value) ??
    numberValue(attrs.value) ??
    numberValue(record.SellPrice) ??
    numberValue(record.Value) ??
    numberValue(record.value);

  return value == null || value < 0 ? null : value;
}

export function getRawHeroes(record: RawRecord): string[] {
  const heroes = getStringArray(record, "Heroes");
  if (heroes.length > 0) {
    return heroes;
  }

  return getStringArray(record, "Tags").filter((tag) => HERO_TAGS.has(tag));
}

export function getHeroSlug(record: RawRecord): string | null {
  const heroSlugs = getRawHeroes(record)
    .filter((hero) => hero.toLowerCase() !== "common")
    .map((hero) => slugify(hero));

  return heroSlugs.length === 1 ? heroSlugs[0] : null;
}

export function isEntityAvailableForHero(record: unknown, heroSlug: string): boolean {
  const heroes = getRawHeroes(asRecord(record)).map((hero) => slugify(hero));
  return heroes.length === 0 || heroes.includes("common") || heroes.includes(heroSlug);
}

export function getTags(record: RawRecord): string[] {
  const tags = [
    ...getStringArray(record, "DisplayTags"),
    ...getStringArray(record, "HiddenTags"),
    ...getStringArray(record, "Tags")
  ];

  return [...new Set(tags)]
    .filter((tag) => !HERO_TAGS.has(tag) && !SIZE_TAGS.has(tag) && !TYPE_TAGS.has(tag))
    .map((tag) => slugify(tag));
}

export function getSourceIds(record: RawRecord): string[] {
  return asArray(record.DroppedBy)
    .map(asRecord)
    .map((entry) => stringValue(entry.id) ?? stringValue(entry.source_id))
    .filter((value): value is string => Boolean(value));
}

function replacementValue(value: unknown, baseTier: string | null): string | null {
  const record = asRecord(value);
  const fixed = numberValue(record.Fixed);
  if (fixed != null) return String(fixed);
  if (baseTier) {
    const tierValue = numberValue(record[baseTier]);
    if (tierValue != null) return String(tierValue);
  }

  const firstNumber = Object.values(record).map(numberValue).find((num): num is number => num != null);
  return firstNumber == null ? null : String(firstNumber);
}

const LOCALIZED_KEYWORDS_ZH: Record<string, string> = {
  Damage: "伤害",
  Shield: "护盾",
  Heal: "治疗",
  Burn: "燃烧",
  Poison: "中毒",
  Regen: "再生",
  Haste: "加速",
  Slow: "减速",
  Freeze: "冻结",
  Charge: "充能",
  Crit: "暴击",
  Value: "价值",
  Gold: "金币",
  Health: "生命值",
  Multicast: "多重施放"
};

function localizedKeyword(keyword: string | null, locale: string): string | null {
  if (!keyword) return null;
  return locale === "zh-CN" ? LOCALIZED_KEYWORDS_ZH[keyword] ?? keyword : keyword;
}

export function getTooltipTexts(record: RawRecord, locale = "en-US"): string[] {
  return getTooltipTextsForTier(record, getBaseTier(record), locale);
}

export function getTooltipTextsForTier(record: RawRecord, tier: string | null, locale = "en-US"): string[] {
  const localizedRecord = asRecord(asRecord(record.i18n)[locale]);
  const source = Object.keys(localizedRecord).length > 0 ? localizedRecord : record;
  const baseTier = tier ?? getBaseTier(record) ?? getBaseTier(source);
  const replacements = asRecord(source.TooltipReplacements);
  const fallbackReplacements = asRecord(record.TooltipReplacements);
  const keywords = asRecord(record.TooltipReplacementKeywords);

  const replaceTokens = (text: string) =>
    text.replace(/\{[^}]+\}/g, (token, offset: number, fullText: string) => {
      const value = replacementValue(replacements[token] ?? fallbackReplacements[token], baseTier);
      const keyword = localizedKeyword(stringValue(keywords[token]), locale);
      if (locale === "zh-CN") {
        const nextText = fullText.slice(offset + token.length).trimStart();
        if (keyword && nextText.startsWith(keyword)) {
          return value ?? "";
        }
        return [value, keyword].filter(Boolean).join("") || token;
      }
      return [value, keyword].filter(Boolean).join(" ") || token;
    });

  const tooltipTexts = asArray(source.Tooltips)
    .map(asRecord)
    .map((tooltip) => stringValue(asRecord(tooltip.Content).Text))
    .filter((text): text is string => Boolean(text))
    .map(replaceTokens);

  const description = stringValue(asRecord(source.Description).Text) ?? stringValue(source.Description);
  return tooltipTexts.length > 0 ? tooltipTexts : description ? [replaceTokens(description)] : [];
}

export function mergeMissingFields<T extends RawRecord>(primary: T, fallback: RawRecord): T {
  const merged: RawRecord = { ...fallback, ...primary };

  for (const [key, fallbackValue] of Object.entries(fallback)) {
    const primaryValue = primary[key];
    const primaryMissing =
      primaryValue == null ||
      (Array.isArray(primaryValue) && primaryValue.length === 0) ||
      (typeof primaryValue === "object" &&
        !Array.isArray(primaryValue) &&
        primaryValue != null &&
        Object.keys(primaryValue).length === 0);

    if (primaryMissing) {
      merged[key] = fallbackValue;
    }
  }

  return merged as T;
}
