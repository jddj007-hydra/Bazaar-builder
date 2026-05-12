import { asArray, asRecord, stringValue } from "./cardRecord";
import { slugify, uniqueSlug } from "./slug";
import type { TagDef } from "./types";

export function normalizeTags(rawTags: unknown): TagDef[] {
  const root = asRecord(rawTags);
  const names = [
    ...asArray(root.visible_tags),
    ...asArray(root.hidden_tags),
    ...asArray(root.mechanic_tags),
    ...asArray(root.all_tags)
  ]
    .map(stringValue)
    .filter((value): value is string => Boolean(value));

  const seenNames = new Set<string>();
  const seenSlugs = new Set<string>();

  return names
    .filter((name) => {
      const key = name.toLowerCase();
      if (seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    })
    .map((name) => {
      const slug = uniqueSlug(name, seenSlugs, "tag");
      return {
        id: slugify(name, "tag"),
        name,
        slug
      };
    });
}
