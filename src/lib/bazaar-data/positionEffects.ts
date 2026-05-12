import { slugify } from "./slug";
import type { EffectDef, EffectTargetScope, ItemDef, ItemSize, TagDef } from "./types";

type TagLike = TagDef | string;

const SIZE_WORDS: Array<[RegExp, ItemSize]> = [
  [/\b(small|s)\b(?:\s+items?)?/, 1],
  [/\b(medium|m)\b(?:\s+items?)?/, 2],
  [/\b(large|l)\b(?:\s+items?)?/, 3]
];

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

function findKnownTag(text: string, tags: TagLike[] = []): string | undefined {
  const normalizedText = lower(text);
  for (const tag of knownTagNames(tags)) {
    const pattern = new RegExp(`\\b${escapeRegExp(tag.toLowerCase())}s?\\b`, "i");
    if (pattern.test(normalizedText)) {
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

  if (/\byour\s+leftmost\s+items?\b|\bleftmost\s+items?\b/.test(value)) scope = "leftmost";
  else if (/\byour\s+rightmost\s+items?\b|\brightmost\s+items?\b/.test(value)) scope = "rightmost";
  else if (/\bitems?\s+to\s+the\s+left\b|\bleft\s+items?\b|\bto\s+the\s+left\s+of\s+this\b/.test(value)) scope = "left";
  else if (/\bitems?\s+to\s+the\s+right\b|\bright\s+items?\b|\bto\s+the\s+right\s+of\s+this\b/.test(value)) scope = "right";
  else if (/\badjacent(?:\s+items?)?\b|\bnext to\b/.test(value)) scope = "adjacent";

  if (!scope) {
    return null;
  }

  const targetText = positionalWindow(text, scope);
  const tag = findKnownTag(targetText, tags);
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
