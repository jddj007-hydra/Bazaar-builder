import {
  getBaseTier,
  getCardId,
  getCardName,
  getEnglishCardName,
  getCollection,
  getHeroSlug,
  getTags,
  getTooltipTexts,
  mergeMissingFields,
  stringValue
} from "./cardRecord";
import { parseStructuredEffectsFromTexts } from "./parseEffects";
import { resolveCardImage, type ImageResolver } from "./resolveImages";
import { parseSemanticEffectDocumentFromTexts } from "./semanticEffects";
import { uniqueSlug } from "./slug";
import type { SkillDef, TagDef } from "./types";

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

      return {
        id,
        slug: uniqueSlug(slugName, seenSlugs, id),
        name,
        hero: getHeroSlug(record),
        tags: getTags(record),
        rarity: getBaseTier(record),
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
