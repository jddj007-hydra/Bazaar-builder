import {
  asRecord,
  getBaseTier,
  getCardId,
  getCardName,
  getEnglishCardName,
  getCollection,
  getAvailableTiers,
  getAmmoMax,
  getAmmoMaxForTier,
  getCooldownMs,
  getCooldownMsForTier,
  getHeroSlug,
  getItemValue,
  getItemValueForTier,
  getRawSizeValue,
  getSourceIds,
  getTags,
  getTooltipTexts,
  getTooltipTextsForTier,
  mergeMissingFields,
  normalizeCardTier,
  normalizeSize,
  stringValue
} from "./cardRecord";
import { parseStructuredEffectsFromTexts } from "./parseEffects";
import { resolveCardImage, type ImageResolver } from "./resolveImages";
import { parseSemanticEffectDocumentFromTexts } from "./semanticEffects";
import { uniqueSlug } from "./slug";
import { itemTierAttributesForRecord } from "./tierAttributes";
import type { CardTier, ItemDef, ItemTierAttributes, TagDef } from "./types";

function isItem(record: unknown): boolean {
  const type = stringValue(asRecord(record).Type);
  return !type || type.toLowerCase() === "item";
}

export function normalizeItems(
  rawItems: unknown,
  rawCards: unknown,
  rawSources: unknown,
  imageResolver: ImageResolver,
  tags: TagDef[]
): ItemDef[] {
  const itemRecords = getCollection(rawItems, "items").filter(isItem);
  const cardItemRecords = getCollection(rawCards, "cards").filter((record) => stringValue(record.Type)?.toLowerCase() === "item");
  const cardById = new Map(cardItemRecords.map((record) => [getCardId(record, "card"), record]));
  const recordsById = new Map<string, Record<string, unknown>>();

  for (const item of itemRecords) {
    const id = getCardId(item, "item");
    recordsById.set(id, mergeMissingFields(item, cardById.get(id) ?? {}));
  }

  for (const card of cardItemRecords) {
    const id = getCardId(card, "card-item");
    if (!recordsById.has(id)) {
      recordsById.set(id, card);
    }
  }

  const seenSlugs = new Set<string>();
  const sourceIdsByCard = new Map<string, string[]>();
  for (const source of getCollection(rawSources, "sources")) {
    const sourceId = stringValue(source.source_id) ?? stringValue(source.id) ?? stringValue(source.title);
    if (!sourceId) continue;
    for (const cardId of Array.isArray(source.card_ids) ? source.card_ids : []) {
      const id = stringValue(cardId);
      if (!id) continue;
      sourceIdsByCard.set(id, [...(sourceIdsByCard.get(id) ?? []), sourceId]);
    }
  }

  return [...recordsById.values()]
    .map((record) => {
      const id = getCardId(record, "item");
      const name = getCardName(record);
      const slugName = getEnglishCardName(record);
      const tooltipTexts = getTooltipTexts(record, "en-US");
      const displayTooltipTexts = getTooltipTexts(record, "zh-CN");
      const droppedSourceIds = getSourceIds(record);
      const sourceIds = [...new Set([...droppedSourceIds, ...(sourceIdsByCard.get(id) ?? [])])];
      const structuredEffects = parseStructuredEffectsFromTexts(tooltipTexts, tags);
      const rawAvailableTiers = getAvailableTiers(record);
      const defaultTier = normalizeCardTier(getBaseTier(record)) ?? rawAvailableTiers[0] ?? "Bronze";
      const availableTiers = rawAvailableTiers.length > 0 ? rawAvailableTiers : [defaultTier];
      const tierAttributes = itemTierAttributesForRecord(record);
      const tierAttributesByTier = new Map<CardTier, ItemTierAttributes>(tierAttributes.map((entry) => [entry.tier, entry]));
      const tiers = availableTiers.map((tier) => {
        const tierTooltipTexts = getTooltipTextsForTier(record, tier, "en-US");
        const tierDisplayTooltipTexts = getTooltipTextsForTier(record, tier, "zh-CN");
        const tierStructuredEffects = parseStructuredEffectsFromTexts(tierTooltipTexts, tags);

        return {
          tier,
          attrs: tierAttributesByTier.get(tier)?.attrs ?? [],
          text: tierDisplayTooltipTexts.join(" "),
          structuredEffects: tierStructuredEffects,
          cooldownMs: getCooldownMsForTier(record, tier),
          ammoMax: getAmmoMaxForTier(record, tier),
          value: getItemValueForTier(record, tier)
        };
      });

      return {
        id,
        slug: uniqueSlug(slugName, seenSlugs, id),
        name,
        nameEn: slugName,
        hero: getHeroSlug(record),
        size: normalizeSize(getRawSizeValue(record)),
        tags: getTags(record),
        cooldownMs: getCooldownMs(record),
        ammoMax: getAmmoMax(record),
        value: getItemValue(record),
        defaultTier,
        availableTiers,
        tiers,
        tierAttributes,
        rarity: defaultTier,
        sourceIds,
        imageUrl: resolveCardImage(record, imageResolver),
        text: displayTooltipTexts.join(" "),
        structuredEffects,
        semanticEffects: parseSemanticEffectDocumentFromTexts(tooltipTexts, tags, {
          sourceCardId: id,
          sourceCardName: slugName,
          structuredEffectIds: structuredEffects.map((effect) => effect.id)
        }),
        raw: record
      } satisfies ItemDef;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
