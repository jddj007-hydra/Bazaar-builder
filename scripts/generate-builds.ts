import fs from "node:fs";
import path from "node:path";
import {
  daysForAvailableTiers,
  generateBuilds,
  getMerchantDefinitions,
  loadRawData,
  normalizeAll,
  normalizeMerchantIndex,
  normalizeSourceIndex,
  normalizeSpawnTiersByDay
} from "../src/lib/bazaar-data";
import type { BuildGeneratorMeta, ItemIndexEntry, SkillIndexEntry, SourceIndexEntry } from "../src/lib/bazaar-data";

const outputDir = path.resolve(process.cwd(), "public");
fs.mkdirSync(outputDir, { recursive: true });

const raw = loadRawData();
const normalized = normalizeAll(raw);
const builds = generateBuilds(normalized);
const sourceIndex: SourceIndexEntry[] = normalizeSourceIndex(raw.sources);
// The game's own day -> tier table. Source records almost never carry a day
// window, so this is what makes the catalog's day filter meaningful.
const spawnTiersByDay = normalizeSpawnTiersByDay(raw.manifests["spawn_tiers_by_day.json"]);
const merchantIndex: SourceIndexEntry[] = normalizeMerchantIndex(
  normalized.items,
  sourceIndex,
  getMerchantDefinitions(raw.manifests["merchant_data.json"])
);

const itemIndex: ItemIndexEntry[] = normalized.items.map(({ id, slug, name, nameEn, hero, heroes, spawningEligibility, combatRelevance, size, tags, cooldownMs, ammoMax, value, defaultTier, availableTiers, tiers, tierAttributes, rarity, sourceIds, merchantIds, imageUrl, text, structuredEffects, semanticEffects }) => ({
  id,
  slug,
  name,
  nameEn,
  hero,
  heroes,
  spawningEligibility,
  combatRelevance,
  size,
  tags,
  cooldownMs,
  ammoMax,
  value,
  defaultTier,
  availableTiers,
  tiers,
  tierAttributes,
  rarity: rarity ?? null,
  sourceIds,
  merchantIds,
  imageUrl: imageUrl ?? null,
  text,
  structuredEffects,
  semanticEffects,
  availableDays: daysForAvailableTiers(availableTiers, spawnTiersByDay)
}));

const skillIndex: SkillIndexEntry[] = normalized.skills.map(({ id, slug, name, nameEn, hero, heroes, spawningEligibility, combatRelevance, tags, defaultTier, availableTiers, tiers, tierAttributes, rarity, imageUrl, text, structuredEffects, semanticEffects }) => ({
  id,
  slug,
  name,
  nameEn,
  hero,
  heroes,
  spawningEligibility,
  combatRelevance,
  tags,
  defaultTier,
  availableTiers,
  tiers,
  tierAttributes,
  rarity: rarity ?? null,
  imageUrl: imageUrl ?? null,
  text,
  structuredEffects,
  semanticEffects,
  availableDays: daysForAvailableTiers(availableTiers, spawnTiersByDay)
}));

const nonCombatItems = normalized.items.filter((item) => item.combatRelevance === "economy");
const nonCombatSkills = normalized.skills.filter((skill) => skill.combatRelevance === "economy");

const meta: BuildGeneratorMeta = {
  generatedAt: new Date().toISOString(),
  itemCount: normalized.items.length,
  skillCount: normalized.skills.length,
  heroCount: normalized.heroes.length,
  buildCount: builds.length,
  nonCombatItemCount: nonCombatItems.length,
  nonCombatSkillCount: nonCombatSkills.length,
  warnings: [
    "生成构筑只用于理论构筑参考，不是真实胜率预测。",
    "生成过程未使用数据库、抓取、游戏客户端、游戏服务端、封包流、内存读取或官方 API。",
    `非战斗卡（战利品、商人包裹、每日奖励等）不计入构筑生成：${nonCombatItems.length} 个物品、${nonCombatSkills.length} 个技能。`,
    ...normalized.warnings
  ]
};

const outputs: Record<string, unknown> = {
  "item-index.json": itemIndex,
  "skill-index.json": skillIndex,
  "source-index.json": sourceIndex,
  "merchant-index.json": merchantIndex,
  "hero-index.json": normalized.heroes,
  "build-generator-meta.json": meta
};

for (const [fileName, data] of Object.entries(outputs)) {
  fs.writeFileSync(path.join(outputDir, fileName), JSON.stringify(data));
}

// Builds are split per hero so the page only downloads the selected hero's
// boards. The whole set is ~18 MB compact, which is too much to load up front.
const buildsDir = path.join(outputDir, "builds");
fs.mkdirSync(buildsDir, { recursive: true });
const buildsByHero = new Map<string, typeof builds>();
for (const build of builds) {
  buildsByHero.set(build.hero, [...(buildsByHero.get(build.hero) ?? []), build]);
}
for (const [heroSlug, heroBuilds] of buildsByHero) {
  fs.writeFileSync(path.join(buildsDir, `${heroSlug}.json`), JSON.stringify(heroBuilds));
}
const buildsManifest = normalized.heroes.map((hero) => ({
  hero: hero.slug,
  count: buildsByHero.get(hero.slug)?.length ?? 0,
  path: `/builds/${hero.slug}.json`
}));
fs.writeFileSync(path.join(buildsDir, "index.json"), JSON.stringify(buildsManifest));

console.log(`Wrote ${builds.length} theoretical generated builds across ${buildsByHero.size} hero files.`);
console.log(`Items: ${itemIndex.length}, skills: ${skillIndex.length}, heroes: ${normalized.heroes.length}.`);
console.log(`Output directory: ${outputDir}`);
