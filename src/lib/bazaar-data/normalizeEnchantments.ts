import { asArray, asRecord, getCollection, stringValue } from "./cardRecord";
import { parseEffectsFromTexts } from "./parseEffects";
import { slugify, uniqueSlug } from "./slug";
import type { EnchantmentDef, TagDef } from "./types";

function getEnchantmentTexts(name: string, rawCards: unknown): string[] {
  const texts: string[] = [];

  for (const card of getCollection(rawCards, "cards")) {
    const enchantment = asRecord(asRecord(card.Enchantments)[name]);
    const localization = asRecord(enchantment.Localization);
    for (const tooltip of asArray(localization.Tooltips)) {
      const text = stringValue(asRecord(asRecord(tooltip).Content).Text);
      if (text) {
        texts.push(text);
      }
    }
    if (texts.length >= 3) {
      break;
    }
  }

  return [...new Set(texts)];
}

export function normalizeEnchantments(rawEnchantments: unknown, rawCards: unknown, tags: TagDef[]): EnchantmentDef[] {
  const seenSlugs = new Set<string>();

  return getCollection(rawEnchantments, "enchantments").map((record) => {
    const name = stringValue(record.enchantment) ?? stringValue(record.name) ?? "Unknown Enchantment";
    const texts = getEnchantmentTexts(name, rawCards);

    return {
      id: slugify(name, "enchantment"),
      slug: uniqueSlug(name, seenSlugs, "enchantment"),
      name,
      text: texts.join(" "),
      effects: parseEffectsFromTexts(texts, tags),
      raw: record
    };
  });
}
