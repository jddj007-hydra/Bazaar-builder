import { asArray, asRecord, getCollection, stringValue } from "./cardRecord";
import { parseStructuredEffectsFromTexts, type ParseEffectOptions } from "./parseEffects";
import { parseSemanticEffectDocumentFromTexts } from "./semanticEffects";
import { slugify, uniqueSlug } from "./slug";
import type { EnchantmentDef, TagDef } from "./types";

function getEnchantmentTextContext(name: string, rawCards: unknown): { texts: string[]; options: ParseEffectOptions } {
  const texts: string[] = [];
  const placeholderKeywords: Record<string, string> = {};

  for (const card of getCollection(rawCards, "cards")) {
    const enchantment = asRecord(asRecord(card.Enchantments)[name]);
    const localization = asRecord(enchantment.Localization);
    const tooltipKeywords = asRecord(enchantment.TooltipReplacementKeywords);
    for (const tooltip of asArray(localization.Tooltips)) {
      const text = stringValue(asRecord(asRecord(tooltip).Content).Text);
      if (text) {
        texts.push(text);
        for (const token of text.match(/\{[^}]+\}/g) ?? []) {
          const keyword = stringValue(tooltipKeywords[token]);
          if (keyword) {
            placeholderKeywords[token] = keyword;
          }
        }
      }
    }
    if (texts.length >= 3) {
      break;
    }
  }

  return { texts: [...new Set(texts)], options: { placeholderKeywords } };
}

export function normalizeEnchantments(rawEnchantments: unknown, rawCards: unknown, tags: TagDef[]): EnchantmentDef[] {
  const seenSlugs = new Set<string>();

  return getCollection(rawEnchantments, "enchantments").map((record) => {
    const name = stringValue(record.enchantment) ?? stringValue(record.name) ?? "Unknown Enchantment";
    const { texts, options } = getEnchantmentTextContext(name, rawCards);
    const id = slugify(name, "enchantment");
    const structuredEffects = parseStructuredEffectsFromTexts(texts, tags, options);

    return {
      id,
      slug: uniqueSlug(name, seenSlugs, "enchantment"),
      name,
      text: texts.join(" "),
      structuredEffects,
      semanticEffects: parseSemanticEffectDocumentFromTexts(texts, tags, {
        sourceCardId: id,
        sourceCardName: name,
        structuredEffectIds: structuredEffects.map((effect) => effect.id),
        placeholderKeywords: options.placeholderKeywords
      }),
      raw: record
    };
  });
}
