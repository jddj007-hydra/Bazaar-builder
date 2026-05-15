import {
  getAvailableTiers,
  getBaseTier,
  getCardId,
  getCardName,
  getEnglishCardName,
  getCollection,
  getHeroSlug,
  getTags,
  getTooltipTexts,
  getTooltipTextsForTier,
  mergeMissingFields,
  normalizeCardTier,
  stringValue
} from "./cardRecord";
import { parseStructuredEffectsFromTexts } from "./parseEffects";
import { resolveCardImage, type ImageResolver } from "./resolveImages";
import { parseSemanticEffectDocumentFromTexts } from "./semanticEffects";
import { uniqueSlug } from "./slug";
import { skillTierAttributesForRecord } from "./tierAttributes";
import type { CardTier, ItemTierAttributes, SkillDef, TagDef } from "./types";

export function normalizeSkills(
  rawSkills: unknown,
  rawCards: unknown,
  imageResolver: ImageResolver,
  tags: TagDef[]
): SkillDef[] {
  const skillRecords = getCollection(rawSkills, "skills");
  const cardSkillRecords = getCollection(rawCards, "cards").filter((record) => stringValue(record.Type)?.toLowerCase() === "skill");
  const cardById = new Map(cardSkillRecords.map((record) => [getCardId(record, "card"), record]));
  const recordsById = new Map<string, Record<string, unknown>>();

  for (const skill of skillRecords) {
    const id = getCardId(skill, "skill");
    recordsById.set(id, mergeMissingFields(skill, cardById.get(id) ?? {}));
  }

  for (const card of cardSkillRecords) {
    const id = getCardId(card, "card-skill");
    if (!recordsById.has(id)) {
      recordsById.set(id, card);
    }
  }

  const seenSlugs = new Set<string>();

  return [...recordsById.values()]
    .map((record) => {
      const id = getCardId(record, "skill");
      const name = getCardName(record);
      const slugName = getEnglishCardName(record);
      const tooltipTexts = getTooltipTexts(record, "en-US");
      const displayTooltipTexts = getTooltipTexts(record, "zh-CN");
      const structuredEffects = parseStructuredEffectsFromTexts(tooltipTexts, tags);
      const rawAvailableTiers = getAvailableTiers(record);
      const defaultTier = normalizeCardTier(getBaseTier(record)) ?? rawAvailableTiers[0] ?? "Bronze";
      const availableTiers = rawAvailableTiers.length > 0 ? rawAvailableTiers : [defaultTier];
      const tierAttributes = skillTierAttributesForRecord(record);
      const tierAttributesByTier = new Map<CardTier, ItemTierAttributes>(tierAttributes.map((entry) => [entry.tier, entry]));
      const tiers = availableTiers.map((tier) => {
        const tierTooltipTexts = getTooltipTextsForTier(record, tier, "en-US");
        const tierDisplayTooltipTexts = getTooltipTextsForTier(record, tier, "zh-CN");
        const tierStructuredEffects = parseStructuredEffectsFromTexts(tierTooltipTexts, tags);

        return {
          tier,
          attrs: tierAttributesByTier.get(tier)?.attrs ?? [],
          text: tierDisplayTooltipTexts.join(" "),
          structuredEffects: tierStructuredEffects
        };
      });

      return {
        id,
        slug: uniqueSlug(slugName, seenSlugs, id),
        name,
        nameEn: slugName,
        hero: getHeroSlug(record),
        tags: getTags(record),
        defaultTier,
        availableTiers,
        tiers,
        tierAttributes,
        rarity: defaultTier,
        imageUrl: resolveCardImage(record, imageResolver),
        text: displayTooltipTexts.join(" "),
        structuredEffects,
        semanticEffects: parseSemanticEffectDocumentFromTexts(tooltipTexts, tags, {
          sourceCardId: id,
          sourceCardName: slugName,
          structuredEffectIds: structuredEffects.map((effect) => effect.id)
        }),
        raw: record
      } satisfies SkillDef;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
