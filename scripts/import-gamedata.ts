import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  buildEnchantmentIndex,
  buildHeroes,
  buildImageManifest,
  buildRawCard,
  buildSpawnTiersByDay,
  buildTags,
  deriveMerchants,
  deriveSources,
  isDebugCard,
  isItemOrSkill,
  type ArtIndex,
  type GameCard,
  type MonsterRecord,
  type StandardPrices,
  type TranslationLookup
} from "../src/lib/bazaar-data/gamedataImport";

type Options = {
  dbPath: string;
  translationPath: string;
  outputDir: string;
  artIndexPath: string | null;
  existingImageDir: string;
  patch: string;
};

const DEFAULT_DB_PATH =
  process.env.BAZAAR_GAMEDATA_DB ??
  "/mnt/c/Users/jddj0/AppData/LocalLow/Tempo Storm/The Bazaar/prod/cache/GameData.db";
const DEFAULT_TRANSLATION_PATH =
  process.env.BAZAAR_ZH_TRANSLATIONS ??
  "/mnt/c/Users/jddj0/AppData/LocalLow/Tempo Storm/The Bazaar/prod/cache/translations/zh-CN.bytes";
const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), "data/raw/gamedata");
const DEFAULT_EXISTING_IMAGE_DIR = path.resolve(process.cwd(), "public/images/cards");

function parseArgs(argv: string[]): Options {
  const options: Options = {
    dbPath: DEFAULT_DB_PATH,
    translationPath: DEFAULT_TRANSLATION_PATH,
    outputDir: DEFAULT_OUTPUT_DIR,
    artIndexPath: path.resolve(process.cwd(), "data/raw/gamedata/manifests/art_index.json"),
    existingImageDir: DEFAULT_EXISTING_IMAGE_DIR,
    patch: "2026-10-13"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--db" && value) options.dbPath = path.resolve(value);
    else if (flag === "--translations" && value) options.translationPath = path.resolve(value);
    else if (flag === "--out" && value) options.outputDir = path.resolve(value);
    else if (flag === "--art-index" && value) options.artIndexPath = path.resolve(value);
    else if (flag === "--images" && value) options.existingImageDir = path.resolve(value);
    else if (flag === "--patch" && value) options.patch = value;
    else if (flag === "--no-art-index") options.artIndexPath = null;
    else if (flag.startsWith("--")) throw new Error(`Unknown flag: ${flag}`);
  }

  return options;
}

function readTable(db: DatabaseSync, table: string): GameCard[] {
  const rows = db.prepare(`SELECT Data FROM "${table}"`).all() as Array<{ Data: Uint8Array }>;
  return rows.map((row) => JSON.parse(Buffer.from(row.Data).toString("utf8")) as GameCard);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function md5(value: string): string {
  return crypto.createHash("md5").update(value).digest("hex");
}

function createTranslator(translationPath: string): TranslationLookup {
  if (!fs.existsSync(translationPath)) {
    return (_key, english) => english;
  }

  const translations = new DatabaseSync(translationPath, { readOnly: true });
  const statement = translations.prepare("SELECT text FROM translation WHERE hash = ?");
  const cache = new Map<string, string | null>();

  const lookup = (hash: string): string | null => {
    if (cache.has(hash)) return cache.get(hash) ?? null;
    const row = statement.get(hash) as { text?: string } | undefined;
    const text = row?.text ?? null;
    cache.set(hash, text);
    return text;
  };

  return (key, english) => {
    if (key) {
      const byKey = lookup(key);
      if (byKey) return byKey;
    }
    return lookup(md5(english)) ?? english;
  };
}

function readArtIndex(artIndexPath: string | null): ArtIndex {
  if (!artIndexPath || !fs.existsSync(artIndexPath)) {
    return {};
  }
  return readJson<ArtIndex>(artIndexPath);
}

function existingImageIds(imageDir: string): Set<string> {
  if (!fs.existsSync(imageDir)) return new Set();
  return new Set(
    fs
      .readdirSync(imageDir)
      .filter((file) => file.endsWith(".webp"))
      .map((file) => file.replace(/\.webp$/, ""))
  );
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const db = new DatabaseSync(options.dbPath, { readOnly: true });
  const cards = readTable(db, "cards");
  const monsters = readTable(db, "monsters") as MonsterRecord[];
  const gameModes = readTable(db, "game_modes");
  const standardPrices = (gameModes[0]?.StandardPrices ?? {}) as StandardPrices;
  const spawnTiersByDay = buildSpawnTiersByDay(gameModes[0] ?? {});
  db.close();

  const translate = createTranslator(options.translationPath);
  const artIndex = readArtIndex(options.artIndexPath);
  const images = existingImageIds(options.existingImageDir);
  const scrapedAt = new Date().toISOString();

  const playable = cards.filter((card) => isItemOrSkill(card) && !isDebugCard(card));
  const items = playable.filter((card) => card.Type === "Item");
  const skills = playable.filter((card) => card.Type === "Skill");

  const rawCards = playable
    .map((card) =>
      buildRawCard(card, {
        standardPrices,
        translate,
        artIndex,
        existingImageIds: images,
        patch: options.patch,
        scrapedAt
      })
    )
    .sort((a, b) => String(a.Id).localeCompare(String(b.Id)));

  const sources = deriveSources(cards, monsters, translate);
  const merchants = deriveMerchants(cards, translate);
  const tags = buildTags(playable);
  const heroes = buildHeroes(playable);
  const enchantments = buildEnchantmentIndex(playable);
  const imageManifest = buildImageManifest(playable, artIndex, images);

  const itemIds = new Set(items.map((card) => String(card.Id)));
  const skillIds = new Set(skills.map((card) => String(card.Id)));
  const itemCards = rawCards.filter((card) => itemIds.has(String(card.Id)));
  const skillCards = rawCards.filter((card) => skillIds.has(String(card.Id)));

  const header = { patch: options.patch, scraped_at: scrapedAt, count: rawCards.length, locales: ["en-US", "zh-CN"] };

  writeJson(path.join(options.outputDir, "cards.json"), { ...header, cards: rawCards });
  writeJson(path.join(options.outputDir, "items.json"), {
    ...header,
    count: itemCards.length,
    items: itemCards
  });
  writeJson(path.join(options.outputDir, "skills.json"), {
    ...header,
    count: skillCards.length,
    skills: skillCards
  });
  writeJson(path.join(options.outputDir, "heroes.json"), heroes);
  writeJson(path.join(options.outputDir, "enchantments.json"), enchantments);
  writeJson(path.join(options.outputDir, "sources.json"), { sources });
  writeJson(path.join(options.outputDir, "tags.json"), tags);
  writeJson(path.join(options.outputDir, "image_manifest.json"), {
    scraped_at: scrapedAt,
    counts: {
      cards_considered: imageManifest.length,
      reused: imageManifest.filter((entry) => entry.status === "reused").length,
      extractable: imageManifest.filter((entry) => entry.status === "extractable").length,
      missing: imageManifest.filter((entry) => entry.status === "missing").length
    },
    images: imageManifest
  });

  writeJson(path.join(options.outputDir, "manifests", "build_manifest.json"), {
    generated_at: scrapedAt,
    patch: options.patch,
    source: {
      kind: "game-runtime-cache",
      database: path.basename(options.dbPath),
      translations: path.basename(options.translationPath)
    },
    counts: {
      items: itemCards.length,
      skills: skillCards.length,
      cards: rawCards.length,
      sources: sources.length,
      merchants: merchants.length
    }
  });
  writeJson(path.join(options.outputDir, "manifests", "merchant_data.json"), merchants);
  writeJson(path.join(options.outputDir, "manifests", "spawn_tiers_by_day.json"), {
    patch: options.patch,
    source: "game_modes[0].ItemSkillSpawnTierPercantagesByDay",
    tiersByDay: spawnTiersByDay
  });
  writeJson(path.join(options.outputDir, "meta.json"), {
    patch: options.patch,
    generated_at: scrapedAt,
    source_files: {
      database: options.dbPath,
      translations: options.translationPath,
      art_index: options.artIndexPath
    },
    counts: {
      database_cards: cards.length,
      playable_cards: playable.length,
      items: itemCards.length,
      skills: skillCards.length,
      debug_excluded: cards.filter((card) => isItemOrSkill(card) && isDebugCard(card)).length,
      sources: sources.length,
      merchants: merchants.length,
      images_reused: imageManifest.filter((entry) => entry.status === "reused").length,
      images_extractable: imageManifest.filter((entry) => entry.status === "extractable").length,
      images_missing: imageManifest.filter((entry) => entry.status === "missing").length
    },
    spawning_eligibility: Object.fromEntries(
      ["Always", "GuidOnly", "Never"].map((eligibility) => [
        eligibility,
        rawCards.filter((card) => card.SpawningEligibility === eligibility).length
      ])
    )
  });

  console.log(`Imported ${rawCards.length} cards (${itemCards.length} items, ${skillCards.length} skills).`);
  console.log(`Sources: ${sources.length}, merchants: ${merchants.length}.`);
  console.log(
    `Images: ${imageManifest.filter((entry) => entry.status === "reused").length} reused, ` +
      `${imageManifest.filter((entry) => entry.status === "extractable").length} extractable, ` +
      `${imageManifest.filter((entry) => entry.status === "missing").length} missing.`
  );
  console.log(`Output: ${options.outputDir}`);
}

main();
