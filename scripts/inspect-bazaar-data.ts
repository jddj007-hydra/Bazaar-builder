import { asRecord, getCollection } from "../src/lib/bazaar-data/cardRecord";
import { loadRawData } from "../src/lib/bazaar-data/loadRawData";
import { normalizeAll } from "../src/lib/bazaar-data";

function fieldNames(raw: unknown, key: string): string[] {
  return [...new Set(getCollection(raw, key).slice(0, 10).flatMap((entry) => Object.keys(entry)))].sort();
}

function count(raw: unknown, key: string): number {
  return getCollection(raw, key).length;
}

const raw = loadRawData();
const normalized = normalizeAll(raw);
const rootTags = asRecord(raw.tags);
const imageRoot = asRecord(raw.imageManifest);

console.log("Raw counts:");
console.log(`- cards: ${count(raw.cards, "cards")}`);
console.log(`- items: ${count(raw.items, "items")}`);
console.log(`- skills: ${count(raw.skills, "skills")}`);
console.log(`- heroes: ${count(raw.heroes, "heroes")}`);
console.log(`- enchantments: ${count(raw.enchantments, "enchantments")}`);
console.log(`- sources: ${count(raw.sources, "sources")}`);
console.log(`- tags: ${Array.isArray(rootTags.all_tags) ? rootTags.all_tags.length : 0}`);
console.log(`- images: ${Array.isArray(imageRoot.images) ? imageRoot.images.length : 0}`);

console.log("\nDetected field names:");
console.log(`- cards: ${fieldNames(raw.cards, "cards").join(", ")}`);
console.log(`- items: ${fieldNames(raw.items, "items").join(", ")}`);
console.log(`- skills: ${fieldNames(raw.skills, "skills").join(", ")}`);
console.log(`- heroes: ${fieldNames(raw.heroes, "heroes").join(", ")}`);
console.log(`- enchantments: ${fieldNames(raw.enchantments, "enchantments").join(", ")}`);
console.log(`- sources: ${fieldNames(raw.sources, "sources").join(", ")}`);
console.log(`- image_manifest.images: ${fieldNames(raw.imageManifest, "images").join(", ")}`);

console.log("\nFirst 3 normalized items:");
console.log(
  JSON.stringify(
    normalized.items.slice(0, 3).map(({ raw: _raw, structuredEffects, ...item }) => ({
      ...item,
      structuredEffects: structuredEffects.slice(0, 3)
    })),
    null,
    2
  )
);

console.log("\nFirst 3 normalized skills:");
console.log(
  JSON.stringify(
    normalized.skills.slice(0, 3).map(({ raw: _raw, structuredEffects, ...skill }) => ({
      ...skill,
      structuredEffects: structuredEffects.slice(0, 3)
    })),
    null,
    2
  )
);

console.log("\nFirst 3 normalized heroes:");
console.log(JSON.stringify(normalized.heroes.slice(0, 3), null, 2));
