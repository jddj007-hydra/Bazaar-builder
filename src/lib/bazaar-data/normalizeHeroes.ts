import { asRecord, getCollection, getStringArray, stringValue } from "./cardRecord";
import { slugify, uniqueSlug } from "./slug";
import type { HeroDef } from "./types";

const HERO_DISPLAY_NAMES_ZH: Record<string, string> = {
  Common: "通用",
  Vanessa: "瓦妮莎",
  Pygmalien: "皮格马利恩",
  Dooley: "杜利",
  Mak: "马克",
  Stelle: "斯特尔",
  Jules: "朱尔斯",
  Karnok: "卡诺克",
  Hero8: "巨龙"
};

function heroArtByRawName(manifests: Record<string, unknown> | undefined): Map<string, string> {
  const art = asRecord(manifests?.["hero_art.json"]);
  const result = new Map<string, string>();
  for (const [rawName, entry] of Object.entries(art)) {
    const imageUrl = stringValue(asRecord(entry).image_url);
    if (imageUrl) result.set(rawName.toLowerCase(), imageUrl);
  }
  return result;
}

export function normalizeHeroes(
  rawHeroes: unknown,
  rawCards?: unknown,
  manifests?: Record<string, unknown>
): HeroDef[] {
  const artByRawName = heroArtByRawName(manifests);
  const heroes = getCollection(rawHeroes, "heroes")
    .map((record) => stringValue(record.hero) ?? stringValue(record.name))
    .filter((value): value is string => Boolean(value));

  if (heroes.length === 0 && rawCards) {
    for (const card of getCollection(rawCards, "cards")) {
      heroes.push(...getStringArray(asRecord(card), "Heroes"));
    }
  }

  const seenNames = new Set<string>();
  const seenSlugs = new Set<string>();

  return heroes
    .filter((name) => {
      const key = name.toLowerCase();
      if (seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    })
    .map((name) => {
      const slug = uniqueSlug(name, seenSlugs, "hero");
      return {
        id: slugify(name, "hero"),
        name: HERO_DISPLAY_NAMES_ZH[name] ?? name,
        slug,
        imageUrl: artByRawName.get(name.toLowerCase()) ?? null
      };
    });
}
