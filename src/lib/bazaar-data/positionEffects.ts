import { slugify } from "./slug";
import type { StructuredEffectView } from "./structuredEffects";
import type { ParsedEffectTarget } from "./effectParserTypes";
import type { EffectTargetScope, ItemDef, ItemSize, StructuredCondition, TagDef } from "./types";

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
  const rawValue = lower(text);
  const isAssignmentAction = /^(?:your|the|adjacent|leftmost|rightmost|items?\s+to\s+the|.+\s+to\s+the)\b.*\b(?:is|are)\s+(?:a|an)?\s+\w+/i.test(rawValue);
  const value = isAssignmentAction && !/^(?:if|when|while)\b/i.test(rawValue)
    ? (rawValue.split(/\b(?:is|are)\s+(?:a|an)?\b/i)[0] ?? rawValue)
    : rawValue;
  const side = scope === "leftmost" || scope === "rightmost" ? scope : null;
  const direction = scope === "left" || scope === "right" ? scope : null;

  for (const tag of targetTagNames(tags)) {
    const normalizedTag = escapeRegExp(tag.toLowerCase());
    const pluralTag = `${normalizedTag}s?`;

    const patterns: RegExp[] = [];
    if (side) {
      patterns.push(
        new RegExp(`\\b${side}\\s+(?:and\\s+(?:leftmost|rightmost)\\s+)?(?:[a-z-]+\\s+)*${pluralTag}\\s+items?\\b`, "i"),
        new RegExp(`\\b${side}\\s+(?:and\\s+(?:leftmost|rightmost)\\s+)?(?:[a-z-]+\\s+)*${pluralTag}\\b(?=\\s*$|\\s+(?:has|have|gains?|deals?|freezes?|slows?|burns?|poisons?|heals?|shields?|cooldowns?))`, "i")
      );
    } else if (scope === "adjacent") {
      patterns.push(
        new RegExp(`\\badjacent\\s+(?:[a-z-]+\\s+)*${pluralTag}\\s+items?\\b`, "i"),
        new RegExp(`\\badjacent\\s+(?:[a-z-]+\\s+)*${pluralTag}\\b(?=\\s*$|\\s+(?:items?|has|have|gains?|deals?|freezes?|slows?|burns?|poisons?|heals?|shields?|cooldowns?))`, "i")
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

function findNegativePositionalTag(text: string, tags: TagLike[] = []): StructuredCondition | undefined {
  const match = text.match(/\bnon-([a-z-]+)\b/i);
  if (!match?.[1]) return undefined;
  const tag = targetTagNames(tags).find((entry) => new RegExp(`^${escapeRegExp(match[1])}s?$`, "i").test(entry));
  const normalized = slugify(tag ?? match[1]);
  return { $type: "TCardConditionalTagExpr", Expr: { $type: "NoneOf", Tags: [normalized] } };
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

export function inferPositionalTarget(text: string, tags: TagLike[] = []): ParsedEffectTarget | null {
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
  const negativeTagCondition = findNegativePositionalTag(text, tags);
  const tag = findPositionalTag(text, scope, tags);
  const size = findSize(targetText);

  return {
    scope,
    ...(negativeTagCondition ? { conditions: [negativeTagCondition] } : tag ? { tag } : {}),
    ...(size ? { size } : {})
  };
}

export function itemMatchesStructuredEffectTarget(item: ItemDef, target: StructuredEffectView["target"]): boolean {
  if (!target) return true;
  if (target.tag && !item.tags.includes(target.tag)) return false;
  if (target.size && item.size !== target.size) return false;
  return true;
}

export function hasPositionalTarget(effect: StructuredEffectView): boolean {
  return ["adjacent", "left", "right", "leftmost", "rightmost"].includes(effect.target?.scope ?? "");
}
