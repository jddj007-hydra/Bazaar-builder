import { loadRawData } from "./loadRawData";
import { asRecord, getRawSizeValue } from "./cardRecord";
import { normalizeEnchantments } from "./normalizeEnchantments";
import { normalizeHeroes } from "./normalizeHeroes";
import { normalizeItems } from "./normalizeItems";
import { normalizeSkills } from "./normalizeSkills";
import { normalizeTags } from "./normalizeTags";
import { createImageResolver } from "./resolveImages";
import type { NormalizedData, RawDataBundle } from "./types";

export function normalizeAll(rawData: RawDataBundle): NormalizedData {
  const tags = normalizeTags(rawData.tags);
  const imageResolver = createImageResolver(rawData);
  const heroes = normalizeHeroes(rawData.heroes, rawData.cards);
  const items = normalizeItems(rawData.items, rawData.cards, rawData.sources, imageResolver, tags);
  const skills = normalizeSkills(rawData.skills, rawData.cards, imageResolver, tags);
  const enchantments = normalizeEnchantments(rawData.enchantments, rawData.cards, tags);
  const missingSizeItems = items.filter((item) => getRawSizeValue(asRecord(item.raw)) == null);
  const sizeWarnings =
    missingSizeItems.length === 0
      ? []
      : [
          ...missingSizeItems.slice(0, 20).map((item) => `${item.name} 缺少尺寸字段，已按 1 格小型物品处理。`),
          ...(missingSizeItems.length > 20 ? [`另有 ${missingSizeItems.length - 20} 个物品缺少尺寸字段，已按 1 格处理。`] : [])
        ];

  return {
    heroes,
    tags,
    items,
    skills,
    enchantments,
    warnings: sizeWarnings
  };
}

export function loadAndNormalizeData(dataRoot?: string): NormalizedData {
  return normalizeAll(loadRawData(dataRoot));
}

export * from "./types";
export * from "./semanticEffects";
export * from "./semanticConsumption";
export * from "./slug";
export * from "./loadRawData";
export { parseStructuredEffectsFromTexts } from "./parseEffects";
export {
  structuredEffectHasAction,
  structuredEffectHasUnknown,
  structuredEffectFacets,
  structuredEffectFacetsList,
  structuredEffectView,
  structuredEffectViews
} from "./structuredEffects";
export type { StructuredEffectView } from "./structuredEffects";
export * from "./synergy";
export * from "./positionEffects";
export * from "./layout";
export * from "./optimizeLayout";
export * from "./mechanics";
export * from "./generateBuilds";
export * from "./searchGeneratedBuilds";
