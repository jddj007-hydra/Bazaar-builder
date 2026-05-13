import { slugify } from "./slug";
import type { EffectDef, EffectTargetScope, ItemDef, ItemSize, TagDef } from "./types";

type TagLike = TagDef | string;

const SIZE_WORDS: Array<[RegExp, ItemSize]> = [
  [/\bsmall\b(?:\s+items?)?/, 1],
  [/\bmedium\b(?:\s+items?)?/, 2],
  [/\blarge\b(?:\s+items?)?/, 3]
];

const NON_FILTER_TAGS = new Set([
  "common",
  "dooley",
  "item",
  "jules",
  "karnok",
  "large",
  "mak",
  "medium",
  "pygmalien",
  "skill",
  "small",
  "stelle",
  "vanessa"
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lower(value: string): string {
  return value.toLowerCase();
}

function tagName(tag: TagLike): string {
  return typeof tag === "string" ? tag : tag.name;
}

function knownTagNames(tags: TagLike[] = []): string[] {
  return tags
    .map(tagName)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

function targetTagNames(tags: TagLike[] = []): string[] {
  return knownTagNames(tags).filter((tag) => !NON_FILTER_TAGS.has(slugify(tag)));
}

function windowAfter(text: string, pattern: RegExp, length = 72): string | null {
  const match = pattern.exec(text);
  if (!match) return null;
  return text.slice(match.index, match.index + length).split(/[,.]/)[0];
}

function positionalWindow(text: string, scope: EffectTargetScope): string {
  const value = lower(text);
  const patterns: Partial<Record<EffectTargetScope, RegExp[]>> = {
    adjacent: [/\badjacent(?:\s+items?)?\b/i, /\bnext to\b/i],
    left: [/\bitems?\s+to\s+the\s+left\b/i, /\bleft\s+items?\b/i, /\bto\s+the\s+left\s+of\s+this\b/i],
    right: [/\bitems?\s+to\s+the\s+right\b/i, /\bright\s+items?\b/i, /\bto\s+the\s+right\s+of\s+this\b/i],
    leftmost: [/\bleftmost\s+items?\b/i, /\byour\s+leftmost\s+items?\b/i],
    rightmost: [/\brightmost\s+items?\b/i, /\byour\s+rightmost\s+items?\b/i]
  };

  for (const pattern of patterns[scope] ?? []) {
    const segment = windowAfter(value, pattern);
    if (segment) return segment;
  }

  return value;
}

function findPositionalTag(text: string, scope: EffectTargetScope, tags: TagLike[] = []): string | undefined {
  const value = lower(text);
  const side = scope === "leftmost" || scope === "rightmost" ? scope : null;
  const direction = scope === "left" || scope === "right" ? scope : null;

  for (const tag of targetTagNames(tags)) {
    const normalizedTag = escapeRegExp(tag.toLowerCase());
    const pluralTag = `${normalizedTag}s?`;

    const patterns: RegExp[] = [];
    if (side) {
      patterns.push(
        new RegExp(`\\b${side}\\s+(?:and\\s+(?:leftmost|rightmost)\\s+)?(?:[a-z-]+\\s+)*${pluralTag}\\s+items?\\b`, "i"),
        new RegExp(`\\b${side}\\s+(?:and\\s+(?:leftmost|rightmost)\\s+)?(?:[a-z-]+\\s+)*${pluralTag}\\b(?=\\s+(?:has|have|gains?|deals?|freezes?|slows?|burns?|poisons?|heals?|shields?|cooldowns?))`, "i")
      );
    } else if (scope === "adjacent") {
      patterns.push(
        new RegExp(`\\badjacent\\s+(?:[a-z-]+\\s+)*${pluralTag}\\s+items?\\b`, "i"),
        new RegExp(`\\badjacent\\s+(?:[a-z-]+\\s+)*${pluralTag}\\b`, "i")
      );
    } else if (direction) {
      patterns.push(
        new RegExp(`\\b(?:the\\s+)?(?:[a-z-]+\\s+)*${pluralTag}\\s+items?\\s+to\\s+the\\s+${direction}\\b`, "i"),
        new RegExp(`\\b(?:the\\s+)?(?:[a-z-]+\\s+)*${pluralTag}\\s+to\\s+the\\s+${direction}\\b`, "i"),
        new RegExp(`\\bitems?\\s+to\\s+the\\s+${direction}\\s+(?:is|are)\\s+(?:a|an)?\\s*${pluralTag}\\b`, "i")
      );
    }

    if (patterns.some((pattern) => pattern.test(value))) {
      return slugify(tag);
    }
  }

  return undefined;
}

function findSize(text: string): ItemSize | undefined {
  const value = lower(text);
  for (const [pattern, size] of SIZE_WORDS) {
    if (pattern.test(value)) {
      return size;
    }
  }
  return undefined;
}

export function inferPositionalTarget(text: string, tags: TagLike[] = []): EffectDef["target"] | null {
  const value = lower(text);
  let scope: EffectTargetScope | null = null;

  if (/\bleftmost\b/.test(value)) scope = "leftmost";
  else if (/\brightmost\b/.test(value)) scope = "rightmost";
  else if (/\bitems?\s+to\s+the\s+left\b|\bleft\s+items?\b|\bto\s+the\s+left\s+of\s+this\b|\bto\s+the\s+left\b/.test(value)) scope = "left";
  else if (/\bitems?\s+to\s+the\s+right\b|\bright\s+items?\b|\bto\s+the\s+right\s+of\s+this\b|\bto\s+the\s+right\b/.test(value)) scope = "right";
  else if (/\badjacent(?:\s+items?)?\b|\bnext to\b/.test(value)) scope = "adjacent";

  if (!scope) {
    return null;
  }

  const targetText = positionalWindow(text, scope);
  const tag = findPositionalTag(text, scope, tags);
  const size = findSize(targetText);

  return {
    scope,
    ...(tag ? { tag } : {}),
    ...(size ? { size } : {})
  };
}

export function itemMatchesEffectTarget(item: ItemDef, target: EffectDef["target"]): boolean {
  if (!target) return true;
  if (target.tag && !item.tags.includes(target.tag)) return false;
  if (target.size && item.size !== target.size) return false;
  return true;
}

export function hasPositionalTarget(effect: EffectDef): boolean {
  return ["adjacent", "left", "right", "leftmost", "rightmost"].includes(effect.target?.scope ?? "");
}
