import fs from "node:fs";
import path from "node:path";
import { generateBuilds, loadRawData, normalizeAll } from "../src/lib/bazaar-data";
import type { BuildGeneratorMeta, ItemIndexEntry, SkillIndexEntry } from "../src/lib/bazaar-data";

const outputDir = path.resolve(process.cwd(), "public");
fs.mkdirSync(outputDir, { recursive: true });

const raw = loadRawData();
const normalized = normalizeAll(raw);
const builds = generateBuilds(normalized);

const itemIndex: ItemIndexEntry[] = normalized.items.map(({ id, slug, name, hero, size, tags, cooldownMs, rarity, sourceIds, imageUrl, text, effects }) => ({
  id,
  slug,
  name,
  hero,
  size,
  tags,
  cooldownMs,
  rarity: rarity ?? null,
  sourceIds,
  imageUrl: imageUrl ?? null,
  text,
  effects
}));

const skillIndex: SkillIndexEntry[] = normalized.skills.map(({ id, slug, name, hero, tags, rarity, imageUrl, text, effects }) => ({
  id,
  slug,
  name,
  hero,
  tags,
  rarity: rarity ?? null,
  imageUrl: imageUrl ?? null,
  text,
  effects
}));

const meta: BuildGeneratorMeta = {
  generatedAt: new Date().toISOString(),
  itemCount: normalized.items.length,
  skillCount: normalized.skills.length,
  heroCount: normalized.heroes.length,
  buildCount: builds.length,
  warnings: [
    "生成构筑只用于理论构筑参考，不是真实胜率预测。",
    "生成过程未使用数据库、抓取、游戏客户端、游戏服务端、封包流、内存读取或官方 API。",
    ...normalized.warnings
  ]
};

const outputs: Record<string, unknown> = {
  "generated-builds.json": builds,
  "item-index.json": itemIndex,
  "skill-index.json": skillIndex,
  "hero-index.json": normalized.heroes,
  "build-generator-meta.json": meta
};

for (const [fileName, data] of Object.entries(outputs)) {
  fs.writeFileSync(path.join(outputDir, fileName), `${JSON.stringify(data, null, 2)}\n`);
}

console.log(`Wrote ${builds.length} theoretical generated builds.`);
console.log(`Items: ${itemIndex.length}, skills: ${skillIndex.length}, heroes: ${normalized.heroes.length}.`);
console.log(`Output directory: ${outputDir}`);
