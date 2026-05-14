import {
  asRecord,
  getBaseTier,
  getCardId,
  getCardName,
  getEnglishCardName,
  getCollection,
  getAmmoMax,
  getCooldownMs,
  getHeroSlug,
  getItemValue,
  getRawSizeValue,
  getSourceIds,
  getTags,
  getTooltipTexts,
  mergeMissingFields,
  normalizeSize,
  stringValue
} from "./cardRecord";
import { parseStructuredEffectsFromTexts } from "./parseEffects";
import { resolveCardImage, type ImageResolver } from "./resolveImages";
import { parseSemanticEffectDocumentFromTexts } from "./semanticEffects";
import { uniqueSlug } from "./slug";
import type { ItemDef, TagDef } from "./types";

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

      return {
        id,
        slug: uniqueSlug(slugName, seenSlugs, id),
        name,
        hero: getHeroSlug(record),
        size: normalizeSize(getRawSizeValue(record)),
        tags: getTags(record),
        cooldownMs: getCooldownMs(record),
        ammoMax: getAmmoMax(record),
        value: getItemValue(record),
        rarity: getBaseTier(record),
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
