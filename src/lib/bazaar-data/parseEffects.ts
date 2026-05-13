import { inferPositionalTarget } from "./positionEffects";
import { slugify } from "./slug";
import { toStructuredEffect } from "./structuredEffects";
import type { ParsedEffect } from "./effectParserTypes";
import type {
  EffectActionType,
  EffectCondition,
  EffectTargetScope,
  StructuredCondition,
  StructuredEffect,
  StructuredEffectPredicate,
  StructuredTagExpr,
  StructuredTrigger,
  TagDef
} from "./types";

type TagLike = TagDef | string;

const NUMBER_PATTERN = "[-+]?\\d+(?:\\.\\d+)?";
const STATUS_PAST_TENSE = new Map([
  ["enraged", "Enraged"],
  ["heated", "Heated"],
  ["chilled", "Chilled"],
  ["frozen", "Frozen"],
  ["slowed", "Slowed"],
  ["hasted", "Hasted"]
]);
const STAT_ALIASES: Array<[RegExp, string]> = [
  [/\bcrit%?(?:\s+crit\s+chance|\s+chance)?\b/i, "crit"],
  [/\bmax\s+ammo\b|\bammo\b/i, "ammo"],
  [/\bmax\s+health\b|\bhealth\b/i, "health"],
  [/\bprestige\b/i, "prestige"],
  [/\brage\b/i, "rage"],
  [/\bvalue\b|\bsell\s+price\b|\bbuy\s+price\b/i, "value"],
  [/\bdamage\b/i, "damage"],
  [/\bshield\b/i, "shield"],
  [/\bheal\b/i, "heal"],
  [/\bburn\b|\bheated\b/i, "burn"],
  [/\bpoison\b/i, "poison"],
  [/\bregen\b/i, "regen"],
  [/\bgold\b|\bincome\b/i, "gold"],
  [/\bcooldown\b/i, "cooldown"],
  [/\bmulticast\b/i, "multicast"]
];
const CONDITION_TAG_TYPES = new Set<EffectCondition["type"]>([
  "exactly_one",
  "has_tag",
  "minimum_count",
  "maximum_count"
]);
const NON_TRIGGER_TAGS = new Set([
  "common",
  "dooley",
  "item",
  "jules",
  "karnok",
  "mak",
  "pygmalien",
  "skill",
  "stelle",
  "vanessa"
]);
const NON_TARGET_TAGS = new Set([...NON_TRIGGER_TAGS, "large", "medium", "small"]);

function lower(value: string): string {
  return value.toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstNumber(text: string): number | undefined {
  const match = text.match(new RegExp(NUMBER_PATTERN));
  return match ? Number(match[0]) : undefined;
}

function lastNumber(text: string): number | undefined {
  const matches = [...text.matchAll(new RegExp(NUMBER_PATTERN, "g"))];
  const value = matches.at(-1)?.[0];
  return value == null ? undefined : Number(value);
}

function knownTagNames(tags: TagLike[] = []): string[] {
  return tags
    .map((tag) => (typeof tag === "string" ? tag : tag.name))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

function findKnownTag(text: string, tags: TagLike[] = []): string | undefined {
  const normalizedText = lower(text);
  for (const tag of knownTagNames(tags)) {
    const pattern = new RegExp(`\\b${escapeRegExp(tag).toLowerCase()}s?\\b`, "i");
    if (pattern.test(normalizedText)) {
      return slugify(tag);
    }
  }
  return undefined;
}

function findKnownTagInSegment(text: string, tags: TagLike[] = []): string | undefined {
  return findKnownTag(text, tags);
}

function parseNumber(text: string): number | undefined {
  if (/\bhalf\b/i.test(text)) return 0.5;
  return firstNumber(text);
}

function fixedValue(value: number): NonNullable<StructuredEffect["action"]["Value"]> {
  return { $type: "TFixedValue", Value: value };
}

function fractionValue(numerator: number, denominator: number): NonNullable<StructuredEffect["action"]["Value"]> {
  return { $type: "TFractionValue", Numerator: numerator, Denominator: denominator };
}

function parseDuration(text: string): NonNullable<StructuredEffect["action"]["Value"]> | undefined {
  const match = text.match(new RegExp(`\\b(?<value>${NUMBER_PATTERN})\\s+(?:\\w+\\s+)?second(?:\\(s\\))?s?\\b`, "i"));
  return match?.groups?.value ? fixedValue(Number(match.groups.value)) : undefined;
}

function parseStatusPastTense(text: string): string | undefined {
  const normalized = lower(text).trim();
  return STATUS_PAST_TENSE.get(normalized);
}

function parseSlotTerrain(text: string): { terrain: "Stove" | "Cooler"; occupantStatusHint: "Heated" | "Chilled" } | null {
  const match = text.match(/\bone of your slots becomes a (?<terrain>stove|cooler)\b.*\bitem here is (?<status>heated|chilled)\b/i);
  if (!match?.groups?.terrain || !match.groups.status) return null;
  return {
    terrain: match.groups.terrain.toLowerCase() === "stove" ? "Stove" : "Cooler",
    occupantStatusHint: match.groups.status.toLowerCase() === "heated" ? "Heated" : "Chilled"
  };
}

function parseEffectFamily(text: string): string | undefined {
  const match = text.match(/\ball\s+(?<family>[a-z]+)\s+effects?\b/i);
  return match?.groups?.family ? slugify(match.groups.family) : undefined;
}

function tagExprForTags(type: "AnyOf" | "AllOf" | "NoneOf", tags: string[]): StructuredTagExpr {
  return { $type: type, Tags: [...new Set(tags)] };
}

function parseTagExpr(text: string, tags: TagLike[], options: { role: "trigger" | "target" }): StructuredTagExpr | undefined {
  const value = text
    .replace(/\b(items?|item\(s\)|cards?|skills?)\b/gi, " ")
    .replace(/\b(your|enemy|all|other|another|a|an|the|this|that|with|of|to|for)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return undefined;

  const nonTokens = [...value.matchAll(/\bnon-([a-z-]+)\b/gi)]
    .map((match) => findKnownTag(match[1], tags) ?? slugify(match[1]))
    .filter(Boolean);
  if (nonTokens.length > 0) {
    return tagExprForTags("NoneOf", nonTokens);
  }

  const separator = /\s+or\s+/i.test(value) ? "or" : /\s+and\s+/i.test(value) ? "and" : undefined;
  const parts = separator ? value.split(new RegExp(`\\s+${separator}\\s+`, "i")) : [value];
  const tagParts = parts
    .map((part) => findKnownTag(part, tags) ?? slugify(part.trim()))
    .filter((tag) => tag && !NON_TARGET_TAGS.has(tag));
  if (tagParts.length === 0) return undefined;
  if (tagParts.length === 1) return { $type: "HasTag", Tag: tagParts[0] };

  if (separator === "or") return tagExprForTags("AnyOf", tagParts);
  if (separator === "and" && options.role === "target") return tagExprForTags("AnyOf", tagParts);
  return tagExprForTags("AllOf", tagParts);
}

function tagExprCondition(text: string, tags: TagLike[], role: "trigger" | "target"): StructuredCondition | undefined {
  const expr = parseTagExpr(text, tags, { role });
  return expr ? { $type: "TCardConditionalTagExpr", Expr: expr } : undefined;
}

function parseSizeCondition(text: string): StructuredCondition | undefined {
  const match = text.match(/\b(small|medium|large)\b/i);
  if (!match) return undefined;
  const size = match[1].toLowerCase() === "small" ? 1 : match[1].toLowerCase() === "medium" ? 2 : 3;
  return { $type: "TCardConditionalSize", Sizes: [size] };
}

function triggerLimitFirstEachFight(key: string): NonNullable<StructuredEffect["trigger"]>["Limit"] {
  return {
    Mode: "First",
    Count: 1,
    Reset: "Fight",
    Scope: "SourceEffectInstance",
    Key: key
  };
}

function parseFirstTriggerLimit(text: string): NonNullable<StructuredEffect["trigger"]>["Limit"] | undefined {
  const value = lower(text);
  if (!/\bthe first\b/.test(value)) return undefined;

  const countMatch = value.match(/\bthe first (?<count>\d+) times?\b/);
  const count = countMatch?.groups?.count ? Number(countMatch.groups.count) : 1;
  const reset = /\beach fight\b|\bin a fight\b/.test(value)
    ? "Fight"
    : /\beach day\b|\beach hour\b/.test(value)
      ? "Day"
      : /\beach run\b/.test(value)
        ? "Run"
        : "Never";
  const mode = count === 1 ? "First" : "MaxTimes";
  const key = slugify(value.replace(/[^a-z0-9]+/g, " ").trim()).slice(0, 80) || "first-trigger";
  return {
    Mode: mode,
    Count: count,
    Reset: reset,
    Scope: "SourceEffectInstance",
    Key: key
  };
}

function halfHealthThreshold(): NonNullable<StructuredEffect["trigger"]>["Threshold"] {
  return {
    $type: "TExpressionValue",
    Operator: "Multiply",
    Values: [
      { $type: "TFixedValue", Value: 0.5 },
      {
        $type: "TReferenceValuePlayerAttribute",
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" },
        AttributeType: "HealthMax"
      }
    ]
  };
}

function effectFamilyPredicate(family: string): StructuredEffectPredicate {
  return { $type: "TEffectPredicateFamily", Family: family };
}

function selfEffectPredicate(): StructuredEffectPredicate {
  return { $type: "TEffectPredicateAttribute", AttributeType: "EffectTrigger" };
}

function actionTargetWithTagExpr(text: string, tags: TagLike[]): NonNullable<StructuredEffect["action"]["Target"]> {
  const condition = tagExprCondition(text, tags, "target");
  return {
    $type: "TTargetCardSection",
    TargetSection: "SelfHand",
    ...(condition ? { Conditions: [condition] } : {})
  };
}

function structuredSlotTerrainEffect(text: string, index: number): StructuredEffect | null {
  const parsed = parseSlotTerrain(text);
  if (!parsed) return null;
  return {
    id: String(index),
    kind: "aura",
    activeIn: "hand_only",
    action: {
      $type: "TActionBoardSlotSetTerrain",
      SourceAction: "modify_slot",
      Terrain: parsed.terrain,
      OccupantStatusHint: parsed.occupantStatusHint,
      Target: { $type: "TTargetBoardSlotRandom", TargetSection: "SelfBoard" }
    },
    projectionStatus: "exact",
    rawText: text
  };
}

function structuredEffectModifierEffect(text: string, index: number): StructuredEffect | null {
  const family = parseEffectFamily(text);
  if (!family || !/\breduced by half\b/i.test(text)) return null;
  const predicate = effectFamilyPredicate(family);
  return {
    id: String(index),
    kind: "aura",
    activeIn: "hand_only",
    action: {
      $type: "TActionEffectModify",
      SourceAction: "modify_effect",
      AttributeType: "EffectMagnitude",
      Operation: "Multiply",
      Value: fractionValue(1, 2),
      Target: { $type: "TTargetEffect", Entity: "EffectTemplate", Owner: "Any", Predicate: predicate },
      EffectPredicate: predicate,
      Rounding: "Unknown"
    },
    projectionStatus: "exact",
    projectionWarnings: ["Rounding behavior for reduced-by-half effect modifiers is not specified."],
    rawText: text
  };
}

function structuredFirstUseEffect(text: string, index: number, tags: TagLike[]): StructuredEffect | null {
  const match = text.match(/^the first time you use (?<subject>.+?) each fight,\s*charge (?<target>.+?) (?<amount>[-+]?\d+(?:\.\d+)?)\s+charge\s+second(?:\(s\))?s?$/i);
  if (!match?.groups?.subject || !match.groups.target || !match.groups.amount) return null;
  const subjectCondition = tagExprCondition(match.groups.subject, tags, "trigger");
  return {
    id: String(index),
    kind: "ability",
    activeIn: "hand_only",
    trigger: {
      $type: "TTriggerOnItemUsed",
      SourceEvent: "item_used",
      Subject: {
        $type: "TTargetCardSection",
        TargetSection: "SelfHand",
        ...(subjectCondition ? { Conditions: [subjectCondition] } : {})
      },
      Limit: triggerLimitFirstEachFight("first-use")
    },
    action: {
      $type: "TActionCardCharge",
      SourceAction: "charge",
      AttributeType: "ChargeAmount",
      Value: fixedValue(Number(match.groups.amount)),
      Target: actionTargetWithTagExpr(match.groups.target, tags)
    },
    projectionStatus: "exact",
    rawText: text
  };
}

function structuredHealthThresholdEffect(text: string, index: number, tags: TagLike[]): StructuredEffect | null {
  const match = text.match(/^the first time you fall below half health each fight,\s*haste (?<target>.+?) (?:for\s+)?(?<amount>[-+]?\d+(?:\.\d+)?)\s+haste\s+second(?:\(s\))?s?$/i);
  if (!match?.groups?.target || !match.groups.amount) return null;
  return {
    id: String(index),
    kind: "ability",
    activeIn: "hand_only",
    trigger: {
      $type: "TTriggerOnPlayerAttributeThresholdCrossed",
      SourceEvent: "player_attribute_threshold",
      Subject: { $type: "TTargetPlayerRelative", TargetMode: "Self" },
      AttributeType: "Health",
      Threshold: {
        $type: "TExpressionValue",
        Operator: "Multiply",
        Values: [
          { $type: "TFixedValue", Value: 0.5 },
          {
            $type: "TReferenceValuePlayerAttribute",
            Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" },
            AttributeType: "HealthMax"
          }
        ]
      },
      Crossing: "FromAtOrAboveToBelow",
      Limit: triggerLimitFirstEachFight("health-below-half")
    },
    action: {
      $type: "TActionCardHaste",
      SourceAction: "haste",
      AttributeType: "HasteAmount",
      Value: fixedValue(Number(match.groups.amount)),
      Target: actionTargetWithTagExpr(match.groups.target, tags)
    },
    projectionStatus: "exact",
    rawText: text
  };
}

function structuredBonusEffects(texts: string[], tags: TagLike[]): StructuredEffect[] | null {
  const combined = texts.join(" ");
  const match = combined.match(/\byour items have\s+\+(?<base>[-+]?\d+(?:\.\d+)?)\s+(?<stat>shield|damage)\.\s*when you sell a (?<size>small|medium|large) item,\s*this gains (?<delta>[-+]?\d+(?:\.\d+)?) bonus\b/i);
  if (!match?.groups?.base || !match.groups.stat || !match.groups.size || !match.groups.delta) return null;

  const stat = match.groups.stat.toLowerCase();
  const attribute = stat === "shield" ? "Shield" : "DamageAmount";
  const variableId = `bonus_${stat}`;
  const sizeCondition = parseSizeCondition(match.groups.size);
  const rawAura = combined.match(/\byour items have\b[^.]+/i)?.[0] ?? texts[0] ?? combined;
  const rawBonus = combined.match(/\bwhen you sell\b.+$/i)?.[0] ?? texts.at(-1) ?? combined;

  return [
    {
      id: "0",
      kind: "aura",
      activeIn: "hand_only",
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: attribute,
        Operation: "Add",
        Value: { $type: "TVariableValue", VariableId: variableId },
        Target: { $type: "TTargetCardSection", TargetSection: "SelfHand" }
      },
      semanticSourceIds: ["c_bonus_aura"],
      projectionStatus: "exact",
      groupId: `g_${variableId}`,
      variableDeclarations: [
        {
          id: variableId,
          name: "bonus",
          valueType: "number",
          defaultValue: fixedValue(Number(match.groups.base)),
          attributeHint: attribute,
          lifetime: "Run"
        }
      ],
      rawText: rawAura
    },
    {
      id: "1",
      kind: "ability",
      activeIn: "hand_only",
      trigger: {
        $type: "TTriggerOnCardSold",
        SourceEvent: "sell",
        Subject: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          ...(sizeCondition ? { Conditions: [sizeCondition] } : {})
        }
      },
      action: {
        $type: "TActionVariableModify",
        SourceAction: "modify_variable",
        VariableId: variableId,
        Operation: "Add",
        Value: fixedValue(Number(match.groups.delta))
      },
      semanticSourceIds: ["c_bonus_sell"],
      projectionStatus: "exact",
      groupId: `g_${variableId}`,
      rawText: rawBonus
    }
  ];
}

function structuredStatusDurationEffect(text: string, index: number): StructuredEffect | null {
  const match = text.match(/^you are (?<status>[a-z]+) for (?<duration>[-+]?\d+(?:\.\d+)?)\s+second(?:\(s\))?s?\s+(?<direction>longer|shorter)$/i);
  if (!match?.groups?.status || !match.groups.duration || !match.groups.direction) return null;
  const status = parseStatusPastTense(match.groups.status) ?? match.groups.status;
  return {
    id: String(index),
    kind: "aura",
    activeIn: "hand_only",
    action: {
      $type: "TActionStatusDurationModify",
      SourceAction: "modify_status_duration",
      AttributeType: "EffectDuration",
      Operation: match.groups.direction.toLowerCase() === "longer" ? "Add" : "Subtract",
      Value: parseDuration(match.groups.duration + " second") ?? fixedValue(Number(match.groups.duration)),
      Target: {
        $type: "TTargetStatusApplication",
        Status: status,
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" }
      }
    },
    projectionStatus: "exact",
    rawText: text
  };
}

function structuredPlayerStateEffect(text: string, index: number): StructuredEffect | null {
  const match = text.match(/^you have joined the (?<faction>[a-z][a-z -]*)$/i);
  if (!match?.groups?.faction) return null;
  const faction = match.groups.faction.trim().replace(/\s+/g, " ");
  return {
    id: String(index),
    kind: "aura",
    activeIn: "hand_only",
    action: {
      $type: "TActionPlayerModifyState",
      SourceAction: "modify_player_state",
      Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" },
      StateType: "FactionMembership",
      StateValue: { $type: "TIdentifierValue", Value: faction }
    },
    projectionStatus: "exact",
    rawText: text
  };
}

function structuredTriggerReplacementEffect(text: string, index: number, tags: TagLike[]): StructuredEffect | null {
  const match = text.match(/^this triggers the first (?<count>\d+|one|two|three) times? (?<event>.+)$/i);
  if (!match?.groups?.count || !match.groups.event) return null;
  const wordCounts: Record<string, number> = { one: 1, two: 2, three: 3 };
  const count = wordCounts[match.groups.count.toLowerCase()] ?? Number(match.groups.count);
  if (!Number.isFinite(count)) return null;

  const eventText = match.groups.event.trim();
  const triggerEventText = `When ${eventText}`;
  const eventTrigger = inferTrigger(triggerEventText, tags);
  const eventSubject = inferTriggerTarget(triggerEventText, tags);
  const subjectConditions = eventSubject?.tag ? [{ $type: "TCardConditionalTag" as const, Tags: [eventSubject.tag] }] : undefined;
  const subjectTarget: StructuredTrigger["Subject"] | undefined = eventSubject
    ? eventSubject.scope === "enemy_items"
      ? {
          $type: "TTargetCardSection",
          TargetSection: "OpponentBoard",
          ...(subjectConditions ? { Conditions: subjectConditions } : {})
        }
      : {
          $type: "TTargetCardSelf",
          ...(subjectConditions ? { Conditions: subjectConditions } : {})
        }
    : undefined;
  const replacementTrigger: StructuredTrigger = {
    $type: triggerTypeToStructuredEvent(eventTrigger.event),
    SourceEvent: eventTrigger.event,
    ...(subjectTarget ? { Subject: subjectTarget } : {})
  };

  const predicate = selfEffectPredicate();
  return {
    id: String(index),
    kind: "aura",
    activeIn: "hand_only",
    action: {
      $type: "TActionEffectModify",
      SourceAction: "modify_effect",
      AttributeType: "EffectTrigger",
      Operation: "Set",
      Value: fixedValue(count),
      Target: { $type: "TTargetEffect", Entity: "EffectTemplate", Owner: "Self", Predicate: predicate },
      EffectPredicate: predicate,
      ReplacementTrigger: {
        ...replacementTrigger,
        Limit: {
          Mode: "MaxTimes",
          Count: count,
          Reset: "Fight",
          Scope: "SourceEffectInstance",
          Key: "replacement-trigger"
        }
      }
    },
    projectionStatus: "partial",
    projectionWarnings: [
      "Tooltip replaces this card's trigger with another event; IR captures trigger event and first-N limit but cannot prove enchantment merge semantics."
    ],
    rawText: text
  };
}

function triggerTypeToStructuredEvent(event: ParsedEffect["trigger"]["event"]): NonNullable<StructuredEffect["trigger"]>["$type"] {
  switch (event) {
    case "item_used":
    case "tag_item_used":
    case "adjacent_item_used":
      return "TTriggerOnItemUsed";
    case "crit":
      return "TTriggerOnCardCritted";
    case "sell":
      return "TTriggerOnCardSold";
    case "player_attribute_threshold":
      return "TTriggerOnPlayerAttributeThresholdCrossed";
    case "condition_active":
      return "TTriggerOnConditionMet";
    default:
      return "TTriggerUnknown";
  }
}

function structuredMulticastInsteadEffect(text: string, index: number, tags: TagLike[]): StructuredEffect | null {
  const match = text.match(/^all (?<target>your .+?) have multicast instead$/i);
  if (!match?.groups?.target) return null;
  const condition = tagExprCondition(match.groups.target, tags, "target");
  return {
    id: String(index),
    kind: "aura",
    activeIn: "hand_only",
    action: {
      $type: "TActionCardModifyAttribute",
      SourceAction: "multicast",
      AttributeType: "Multicast",
      Operation: "Set",
      Value: fixedValue(1),
      Target: {
        $type: "TTargetCardSection",
        TargetSection: "SelfHand",
        ...(condition ? { Conditions: [condition] } : {})
      }
    },
    projectionStatus: "partial",
    projectionWarnings: [
      "Tooltip uses 'instead', likely replacing enchantment behavior; IR captures a multicast-granting aura but not full replacement ordering."
    ],
    rawText: text
  };
}

function parseSpecialStructuredEffect(text: string, index: number, tags: TagLike[]): StructuredEffect | null {
  return (
    structuredSlotTerrainEffect(text, index) ??
    structuredEffectModifierEffect(text, index) ??
    structuredFirstUseEffect(text, index, tags) ??
    structuredHealthThresholdEffect(text, index, tags) ??
    structuredStatusDurationEffect(text, index) ??
    structuredPlayerStateEffect(text, index) ??
    structuredTriggerReplacementEffect(text, index, tags) ??
    structuredMulticastInsteadEffect(text, index, tags)
  );
}

function findTriggerTag(text: string, tags: TagLike[] = []): string | undefined {
  const tag = findKnownTag(text, tags);
  if (!tag || NON_TRIGGER_TAGS.has(tag)) {
    return undefined;
  }
  return tag;
}

function asTargetTag(tag: string | undefined): string | undefined {
  return tag && !NON_TARGET_TAGS.has(tag) ? tag : undefined;
}

function statFromText(text: string): string | undefined {
  for (const [pattern, stat] of STAT_ALIASES) {
    if (pattern.test(text)) {
      return stat;
    }
  }
  return undefined;
}

function isStatOnlyTag(tag: string | undefined, action: ParsedEffect["action"], text: string): boolean {
  if (!tag || tag !== action.stat) {
    return false;
  }

  const value = lower(text);
  const tagPattern = escapeRegExp(tag);
  return new RegExp(`\\b(?:gain|gains|have|has|permanently\\s+gain|permanently\\s+gains)\\b[^,.]*\\b${tagPattern}\\b`, "i").test(value);
}

function findAssignedTag(text: string, tags: TagLike[] = []): string | undefined {
  const value = lower(text);
  for (const tag of knownTagNames(tags)) {
    const normalizedTag = escapeRegExp(tag).toLowerCase();
    const assignmentPatterns = [
      new RegExp(`\\b(?:is|are)\\s+(?:a|an)?\\s*${normalizedTag}s?\\b`, "i"),
      new RegExp(`\\bhas\\s+(?:the\\s+)?${normalizedTag}\\s+(?:type|core type)\\b`, "i")
    ];
    if (assignmentPatterns.some((pattern) => pattern.test(value))) {
      return slugify(tag);
    }
  }
  return undefined;
}

function subjectSegmentBeforeAssignment(text: string): string | null {
  const match = text.match(/\b(your|this|all|other|adjacent|the)\b(.+?)\b(?:is|are|has\s+(?:the\s+)?[a-z -]+\s+(?:type|core type))\b/i);
  return match ? `${match[1]}${match[2]}` : null;
}

function subjectSegmentBeforeAction(text: string): string | null {
  const actionText = actionSegment(text);
  const match = actionText.match(
    /^(?<subject>.+?)\b(?:gain|gains|have|has|is|are|starts?|stops?|deals?|deal|slows?|freezes?|burns?|poisons?|heals?|shields?|costs?|lasts?|cooldowns?)\b/i
  );
  return match?.groups?.subject?.trim() ?? null;
}

function findSubjectTag(text: string, tags: TagLike[] = []): string | undefined {
  const subject = subjectSegmentBeforeAssignment(text);
  return subject ? asTargetTag(findKnownTagInSegment(subject, tags)) : undefined;
}

function findActionSubjectTag(text: string, tags: TagLike[] = []): string | undefined {
  const subject = subjectSegmentBeforeAction(text);
  return subject ? asTargetTag(findKnownTagInSegment(subject, tags)) : undefined;
}

function uniqueConditions(conditions: EffectCondition[]): EffectCondition[] {
  const seen = new Set<string>();
  return conditions.filter((condition) => {
    const count = "count" in condition ? condition.count ?? "" : "";
    const key = `${condition.type}:${condition.tag ?? ""}:${count}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferConditionTag(rawTag: string | undefined, tags: TagLike[]): string | undefined {
  if (!rawTag) return undefined;
  const cleaned = rawTag
    .replace(/\b(?:items?|item\(s\)|other|same|amount|of|the|a|an|with|on|both|sides|or|more|fewer|at|least|from|another|hero)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return undefined;
  return findKnownTag(cleaned, tags) ?? slugify(cleaned);
}

function inferConditions(
  text: string,
  tags: TagLike[],
  inheritedConditions: EffectCondition[] = []
): EffectCondition[] {
  const conditions: EffectCondition[] = [];
  const exactlyOneMatch =
    text.match(/\bif (?:this is your only|you have (?:exactly|only) one|you have no other) ([a-z -]+?)(?: items?| item)?(?:,|\b)/i) ??
    text.match(/\bif you have only one ([a-z -]+?)(?: items?| item)?(?:,|\b)/i);
  const alsoTagMatch = text.match(/(?:^|\b)(?:\.\.\.|…+)?if it is also ([a-z -]+?)(?:,|\b)/i);
  const minimumMatch =
    text.match(/\bif you have (?<count>\d+) or more (?<tag>[a-z -]+?)(?: items?| item)?(?:,|\b)/i) ??
    text.match(/\bif you have at least (?<count>\d+) (?:other )?(?<tag>[a-z -]+?)(?: items?| item)?(?:,|\b)/i);
  const maximumMatch = text.match(/\bif you have (?<count>\d+) or fewer (?<tag>[a-z -]+?)(?: items?| item)?(?:,|\b)/i);
  const genericHaveMatch = text.match(/\bif you have (?:a|an|another) (?<tag>[a-z -]+?)(?: items?| item)?(?:,|\b| this\b)/i);

  if (exactlyOneMatch) {
    conditions.push({
      type: "exactly_one",
      tag: inferConditionTag(exactlyOneMatch[1], tags)
    });
  }

  if (alsoTagMatch) {
    conditions.push(...inheritedConditions.filter((condition) => condition.type === "exactly_one"));
    conditions.push({
      type: "target_has_tag",
      tag: inferConditionTag(alsoTagMatch[1], tags)
    });
  }

  if (minimumMatch?.groups) {
    conditions.push({
      type: "minimum_count",
      count: Number(minimumMatch.groups.count),
      tag: inferConditionTag(minimumMatch.groups.tag, tags)
    });
  }

  if (maximumMatch?.groups) {
    conditions.push({
      type: "maximum_count",
      count: Number(maximumMatch.groups.count),
      tag: inferConditionTag(maximumMatch.groups.tag, tags)
    });
  }

  if (!exactlyOneMatch && !minimumMatch && !maximumMatch && genericHaveMatch?.groups?.tag) {
    conditions.push({
      type: "has_tag",
      tag: inferConditionTag(genericHaveMatch.groups.tag, tags)
    });
  }

  return uniqueConditions(conditions);
}

function targetTagFromConditions(conditions: EffectCondition[] = []): string | undefined {
  return conditions.find((condition) => CONDITION_TAG_TYPES.has(condition.type) && condition.tag)?.tag;
}

function isTriggerLead(text: string): boolean {
  return /^(?:\.\.\.|…+)?(when|if|while|at the|on day|the first|for each|for every)\b/i.test(text.trim());
}

function isDirectActionVerbStart(text: string): boolean {
  const value = text.trim();
  return (
    /^(?:deal|gain|gains?|heal|burn|poison|haste|slow|freeze|charge|destroy|remove|reduce|increase|reload|repair|cleanse|transform|double|use|enchant|heat|upgrade|get|gets|create|creates|recover|take|set)\b/i.test(value) ||
    /^shield(?:\s+[-+]?\d|\s+(?:an?|your|this|it|them|all|enemy|both)\b)/i.test(value) ||
    /^(?:multicast:|lifesteal\b|regen\b)/i.test(value)
  );
}

function isSubjectActionStart(text: string): boolean {
  const value = text.trim();
  if (/^(?:this|it|its|they|their|them)\s+(?:gains?|gain|has|have|is|are|starts?|stops?|deals?|deal|slows?|freezes?|burns?|poisons?|heals?|shields?|costs?|lasts?|cooldowns?)\b/i.test(value)) {
    return true;
  }
  if (/^your\s+(?:(?:[a-z-]+|and|or)\s+){0,5}(?:items?|weapons?|tools?|friends?|vehicles?|drones?|relics?|potions?|properties|cores?)\s+(?:gains?|gain|has|have|is|are|starts?|stops?|deals?|deal|slows?|freezes?|burns?|poisons?|heals?|shields?|costs?|lasts?|cooldowns?)\b/i.test(value)) {
    return true;
  }
  if (/^adjacent\s+(?:(?:[a-z-]+|and|or)\s+){0,4}(?:items?|weapons?|tools?|friends?|vehicles?|drones?|relics?|potions?|properties|cores?)\s+(?:gains?|gain|has|have|is|are|starts?|stops?|deals?|deal|slows?|freezes?|burns?|poisons?|heals?|shields?|costs?|lasts?|cooldowns?)\b/i.test(value)) {
    return true;
  }
  if (/^all\s+(?:your\s+)?(?:(?:[a-z-]+|and|or)\s+){0,4}(?:items?|weapons?|tools?|friends?|vehicles?|drones?|relics?|potions?|properties|cores?)\s+(?:gains?|gain|has|have|is|are|starts?|stops?|deals?|deal|slows?|freezes?|burns?|poisons?|heals?|shields?|costs?|lasts?|cooldowns?)\b/i.test(value)) {
    return true;
  }
  if (/^(?:the|an?|another|other)\s+(?:(?:[a-z-]+|and|or)\s+){0,5}(?:item|weapon|tool|friend|vehicle|drone|relic|potion|property|core|food)\s+(?:to\s+the\s+(?:left|right)\s+)?(?:gains?|gain|has|have|is|are|starts?|stops?|deals?|deal|slows?|freezes?|burns?|poisons?|heals?|shields?|costs?|lasts?|cooldowns?)\b/i.test(value)) {
    return true;
  }
  return false;
}

function isActionStart(text: string): boolean {
  const trimmed = text.trim().replace(/^if you have\b.+?,\s*/i, "");
  return isDirectActionVerbStart(trimmed) || isSubjectActionStart(trimmed);
}

function hasActionStarted(text: string): boolean {
  return /\b(?:deal|gain|gains|have|has|heal|burn|poison|haste|slow|freeze|charge|destroy|remove|reduce|increase|reload|repair|cleanse|transform|use|enchant|upgrade|get|create|recover|take|shield\s+[-+]?\d|regen|lifesteal|multicast)\b/i.test(
    text
  );
}

function splitLead(text: string): { triggerText?: string; actionText: string } {
  const trimmed = text.trim();
  if (!isTriggerLead(trimmed)) {
    return { actionText: trimmed };
  }

  const commaIndexes = [...trimmed.matchAll(/,/g)].map((match) => match.index ?? -1).filter((index) => index >= 0);
  for (const commaIndex of [...commaIndexes].reverse()) {
    const after = trimmed.slice(commaIndex + 1).trim();
    if (isActionStart(after)) {
      return {
        triggerText: trimmed.slice(0, commaIndex).trim(),
        actionText: after
      };
    }
  }

  const inlineAction = trimmed.match(/\b(?<action>(?:this|it|they|their|your\s+items?|adjacent\s+items?)\s+(?:has|have|gains?|gain|is|are)\b.+)$/i);
  if (inlineAction?.groups?.action) {
    const actionIndex = trimmed.indexOf(inlineAction.groups.action);
    return {
      triggerText: trimmed.slice(0, actionIndex).replace(/,\s*$/, "").trim(),
      actionText: inlineAction.groups.action.trim()
    };
  }

  const firstComma = commaIndexes[0];
  if (firstComma != null) {
    return {
      triggerText: trimmed.slice(0, firstComma).trim(),
      actionText: trimmed.slice(firstComma + 1).trim()
    };
  }

  return { actionText: trimmed };
}

function actionSegment(text: string): string {
  return splitLead(text).actionText;
}

function triggerSegment(text: string): string {
  return splitLead(text).triggerText ?? text.trim();
}

function splitCompoundAssignment(text: string, tags: TagLike[] = []): string[] {
  for (const tag of knownTagNames(tags)) {
    const normalizedTag = escapeRegExp(tag);
    const pattern = new RegExp(`^(?<assignment>(?<subject>.+?)\\b(?:is|are)\\s+(?:a|an)?\\s*${normalizedTag}s?)\\s+and\\s+(?<rest>.+)$`, "i");
    const match = text.match(pattern);
    const groups = match?.groups as { assignment?: string; subject?: string; rest?: string } | undefined;
    if (!groups?.assignment || !groups.subject || !groups.rest) continue;

    const assignment = groups.assignment.trim();
    const rest = groups.rest.trim();
    const followup = /^(your|all|the|this|adjacent|other)\b/i.test(rest)
      ? rest
      : `${groups.subject.trim()} ${rest}`;
    return [assignment, followup];
  }

  return [text];
}

function statFragments(text: string): string[] {
  const statWords = "Damage|Shield|Heal|Burn|Poison|Regen|Rage|value|Crit%?(?:\\s+Crit\\s+Chance|\\s+Chance)?|Ammo(?:\\s+Max\\s+Ammo)?";
  return [...text.matchAll(new RegExp(`(?:\\+?${NUMBER_PATTERN}%?\\s+(?:${statWords})|\\+?(?:${statWords})(?:\\s+equal\\s+to\\b.+)?)`, "gi"))]
    .map((match) => match[0].trim())
    .filter(Boolean);
}

function splitStatListAction(actionText: string): string[] | null {
  const match = actionText.match(/^(?<prefix>.+?\b(?:gain|gains|have|has)\s+)(?<stats>.+)$/i);
  if (!match?.groups?.prefix || !match.groups.stats) {
    return null;
  }

  const stats = statFragments(match.groups.stats);
  if (stats.length < 2) {
    return null;
  }

  return stats.map((fragment) => `${match.groups!.prefix}${fragment}`);
}

function splitDirectCompoundAction(actionText: string): string[] {
  const separators = [...actionText.matchAll(/(?:,\s*(?:and\s+)?|\s+and\s+|\s+then\s+)/gi)];
  if (separators.length === 0) {
    return [actionText];
  }

  const parts: string[] = [];
  let start = 0;
  for (const separator of separators) {
    const index = separator.index ?? -1;
    if (index < 0) continue;
    const before = actionText.slice(start, index);
    const afterStart = index + separator[0].length;
    const after = actionText.slice(afterStart).trim();
    if (!hasActionStarted(before) || !isActionStart(after)) {
      continue;
    }
    parts.push(actionText.slice(start, index).trim());
    start = afterStart;
  }

  parts.push(actionText.slice(start).trim());
  return parts.filter(Boolean);
}

function splitCompoundActions(text: string): string[] {
  const { triggerText, actionText } = splitLead(text);
  const actionParts = splitStatListAction(actionText) ?? splitDirectCompoundAction(actionText);
  if (actionParts.length <= 1) {
    return [text];
  }

  return actionParts.map((part) => (triggerText ? `${triggerText}, ${part}` : part));
}

function splitEffectText(text: string, tags: TagLike[] = []): string[] {
  return splitCompoundAssignment(text, tags).flatMap(splitCompoundActions);
}

function inferTriggerTarget(text: string, tags: TagLike[]): ParsedEffect["triggerTarget"] | undefined {
  const triggerText = triggerSegment(text);
  if (!isTriggerLead(triggerText)) {
    return undefined;
  }

  const positionalTarget = inferPositionalTarget(triggerText, tags);
  if (positionalTarget) {
    return positionalTarget;
  }

  const triggerValue = lower(triggerText);
  const tag = asTargetTag(findKnownTag(triggerText, tags));
  if (/\bthis\b|\bwith this\b/.test(triggerValue)) {
    return { scope: "self", ...(tag ? { tag } : {}) };
  }
  if (/\bone of your enemy'?s items\b|\benemy items?\b|\ban enemy uses an? item\b|\ban enemy uses\b|\byour enemy uses\b|\byour opponent uses\b/.test(triggerValue)) {
    return { scope: "enemy_items", ...(tag ? { tag } : {}) };
  }
  if (/\bone of your items\b|\byour items?\b|\bwhen your items?\b/.test(triggerValue)) {
    return { scope: "allied_items", ...(tag ? { tag } : {}) };
  }
  if (/\bwhen you use\b/.test(triggerValue) && tag) {
    return { scope: "allied_items", tag };
  }
  if (/^if\b/.test(triggerValue) && tag) {
    return { scope: "allied_items", tag };
  }
  if (/\bwhen (?:a|an|the|another|different)?\s*[a-z -]*(?:item|weapon|tool|friend|vehicle|drone|relic|potion|property|core|food)\b/.test(triggerValue) && tag) {
    return { scope: "allied_items", tag };
  }

  return undefined;
}

function inferTrigger(text: string, tags: TagLike[]): ParsedEffect["trigger"] {
  const value = lower(text);
  const triggerText = triggerSegment(text);
  const triggerValue = lower(triggerText);
  const limit = parseFirstTriggerLimit(triggerText);
  const withLimit = (trigger: ParsedEffect["trigger"]): ParsedEffect["trigger"] => ({
    ...trigger,
    ...(limit ? { limit } : {})
  });
  const healthThresholdTrigger = (): ParsedEffect["trigger"] =>
    withLimit({
      event: "player_attribute_threshold",
      attributeType: "Health",
      threshold: halfHealthThreshold(),
      crossing: "FromAtOrAboveToBelow"
    });

  if (!text.trim()) {
    return { event: "unknown" };
  }
  if (/^(multicast:|lifesteal$|regen\b|heated:|chilled:)/.test(value)) {
    return { event: "always" };
  }
  if (/\bthe sandstorm begins\b/.test(value)) {
    return { event: "cooldown_ready" };
  }
  if (/\b(when combat starts|at the start of each fight|at the start of combat|start of each fight)\b/.test(triggerValue)) {
    return { event: "combat_start" };
  }
  if (/\bat the start of each day\b|\bat the start of each hour\b/.test(triggerValue)) {
    return { event: "level_up" };
  }
  if (/^on day \d+\b/.test(triggerValue)) {
    return { event: "level_up" };
  }
  if (/\bat the end of each (?:hero )?fight\b/.test(triggerValue)) {
    return { event: "fight_end" };
  }
  if (/\bwhen this item'?s value reaches\b/.test(triggerValue)) {
    return { event: "condition_active" };
  }
  if (/\bmerchant items?\b|\bwhen you visit a merchant\b|\bmerchants?\s+(?:sell|buy)\b|\bfor every \d+ merchants?\b/.test(triggerValue)) {
    return { event: "merchant" };
  }
  if (/\bwhen you buy\b|\bon buy\b/.test(triggerValue)) {
    return { event: "buy" };
  }
  if (/\bwhen you sell\b|\bon sell\b/.test(triggerValue)) {
    return { event: "sell" };
  }
  if (/\bwhen (you )?win\b|\bwhen you defeat\b/.test(triggerValue)) {
    return { event: "win" };
  }
  if (/\bwhen (you )?lose\b/.test(triggerValue)) {
    return { event: "lose" };
  }
  if (/\bthe first \d+ times?\s+(?:you|your enemy|an enemy|one of your items|your items)?\s*\b/.test(triggerValue)) {
    const triggerTag = findTriggerTag(triggerText, tags);
    if (/\buses?\b/.test(triggerValue) && triggerTag) {
      return withLimit({ event: "tag_item_used", tag: triggerTag });
    }
    if (/\bfall below half health\b/.test(triggerValue)) return healthThresholdTrigger();
    if (/\buses?\b/.test(triggerValue)) return withLimit({ event: "item_used" });
    if (/\bcrits?\b/.test(triggerValue)) return withLimit({ event: "crit" });
    if (/\bshield\b/.test(triggerValue)) return withLimit({ event: "gain_shield" });
    if (/\bheal\b|\bregen\b/.test(triggerValue)) return withLimit({ event: "heal" });
    if (/\bburn\b/.test(triggerValue)) return withLimit({ event: "apply_burn" });
    if (/\bpoison\b/.test(triggerValue)) return withLimit({ event: "apply_poison" });
    if (/\bdestroyed\b/.test(triggerValue)) return withLimit({ event: "destroyed" });
    return withLimit({ event: "condition_active" });
  }
  if (/\bthe first time\b/.test(triggerValue)) {
    if (/\bfall below half health\b/.test(triggerValue)) return healthThresholdTrigger();
    if (/\bwould be defeated\b/.test(triggerValue)) return withLimit({ event: "condition_active" });
    if (/\buses?\b/.test(triggerValue)) {
      const triggerTag = findTriggerTag(triggerText, tags);
      return triggerTag ? withLimit({ event: "tag_item_used", tag: triggerTag }) : withLimit({ event: "item_used" });
    }
    return withLimit({ event: "condition_active" });
  }
  if (/\bif you have\b|(?:^|\b)(?:\.\.\.|…+)?if it is also\b/.test(triggerValue)) {
    return { event: "condition_active" };
  }
  if (/\bwhen you use an adjacent item\b|\bwhen you use adjacent item\b/.test(triggerValue)) {
    return { event: "adjacent_item_used" };
  }
  if (/\bwhen (?:you|any player|your opponent|your enemy|an enemy|enemy)\s+uses?\b/.test(triggerValue)) {
    const triggerTag = findTriggerTag(triggerText, tags);
    return triggerTag ? { event: "tag_item_used", tag: triggerTag } : { event: "item_used" };
  }
  if (/\bwhen you use\b/.test(triggerValue)) {
    const triggerTag = findTriggerTag(triggerText, tags);
    return triggerTag ? { event: "tag_item_used", tag: triggerTag } : { event: "item_used" };
  }
  if (/\bwhen this is transformed\b/.test(triggerValue)) {
    return { event: "transformed" };
  }
  if (/\bwhen this runs out of ammo\b|\bwhen (?:your items?|one of your items?) runs? out of ammo\b/.test(triggerValue)) {
    return { event: "ammo_empty" };
  }
  if (/\bwhen (?:this is|this|an item|your items?) (?:is )?destroyed\b|\bwhen you destroy\b|\bwhen you stop being\b|\bwhen an enemy would destroy\b|\bwhen this destroys\b/.test(triggerValue)) {
    return { event: "destroyed" };
  }
  if (/\bwhen you crit\b|\bwhen .* crits?\b/.test(triggerValue)) {
    return { event: "crit" };
  }
  if (/\bwhen you enrage\b|\bwhen you become enraged\b|\bwhile you are enraged\b/.test(triggerValue)) {
    return { event: "enrage" };
  }
  if (/\bwhen you (?:gain )?(?:shield|barrier)\b/.test(triggerValue)) {
    return { event: "gain_shield" };
  }
  if (/\bwhen you (?:gain max health|over-?heal|heal)\b/.test(triggerValue)) {
    return { event: "heal" };
  }
  if (/\bwhen you (?:burn|apply burn)\b/.test(triggerValue)) {
    return { event: "apply_burn" };
  }
  if (/\bwhen you (?:poison|apply poison)\b/.test(triggerValue)) {
    return { event: "apply_poison" };
  }
  if (/\bwhen you (?:damage|deal damage)\b/.test(triggerValue)) {
    return { event: "deal_damage" };
  }
  if (/\bwhen an enemy (?:is )?damaged\b|\bwhen an enemy takes damage\b/.test(triggerValue)) {
    return { event: "enemy_damaged" };
  }
  if (/\bwhen an enemy (?:is )?healed\b/.test(triggerValue)) {
    return { event: "enemy_healed" };
  }
  if (/\bwhen an enemy (?:is )?shielded\b/.test(triggerValue)) {
    return { event: "enemy_shielded" };
  }
  if (/\bwhile\b/.test(triggerValue)) {
    return { event: "always" };
  }
  if (/\bwhen the sandstorm starts\b|\bwhen you (?:haste|slow|freeze|regen|repair|transform)\b|\bwhen .* gains?\b|\bwhen .* starts? flying\b|\bwhen .* slows?\b/.test(triggerValue)) {
    return { event: "condition_active" };
  }
  if (/\bwhen .* (?:is|are) (?:frozen|slowed|hasted|used)\b|\bwhen .* (?:burns|poisons|deals? damage|stops? flying|reloads?)\b/.test(triggerValue)) {
    return { event: "condition_active" };
  }
  if (/\bwhen you level up\b|\blevel up\b/.test(triggerValue)) {
    return { event: "level_up" };
  }
  if (/^(?:deal|gain|shield|heal|burn|poison|haste|slow|freeze|charge|destroy|remove|reduce|increase|reload|repair|cleanse|transform|double|use|enchant|heat|upgrade|get|create|recover|set)\b/.test(value)) {
    return { event: "cooldown_ready" };
  }
  if (/^this deals?\b|^use all\b|^use another\b|\bthe sandstorm begins\b/.test(value)) {
    return { event: "cooldown_ready" };
  }
  if (/^sells?\s+for\s+gold\b/.test(value)) {
    return { event: "sell" };
  }
  if (/^(?:this|it|an?|all|2|1|adjacent|other|your|the item|the weapon).*\b(?:starts?|stops?|start or stop)\s+flying\b/.test(value)) {
    return { event: "cooldown_ready" };
  }
  if (/^(?:this|it)\s+(?:permanently\s+)?(?:gains?|loses?|has|starts?|stops?)\b|^your\s+items?\s+gains?\b|^adjacent\s+items?\s+gains?\b|^a\s+\w+\s+gains?\b|^\d+\s+other\s+items?\s+starts?\b/.test(value)) {
    return { event: "cooldown_ready" };
  }
  if (/\balways\b|\byou have\b|^you [a-z -]+ have\b|^you are enraged\b|^you need\b|^this\s+has\b|^this\s+and\s+.*\s+(?:have|has|gain|gains|are|is)\b|^all items?\s+have\b|^an?\s+adjacent\s+.*\s+gains?\b|^your\s+.*\s+(?:have|has|gain|gains|are|is|deal|deals|slow|slows|cost|lasts)\b|^adjacent\s+.*\s+(?:have|has|gain|gains|are|is)\b|^your\s+flying\s+items?\b|^items? to the (?:left|right)\b|^the highest enemy\b|^the item to the (?:left|right)\b|^the weapon to the (?:left|right)\b|^the potion to the (?:left|right)\b|^the [a-z -]+ item to the (?:left|right)\b|^the [a-z -]+ to the (?:left|right)\b|^the cooldowns? of\b|^for each\b|^for every\b|^every \d+(?:st|nd|rd|th)\s+hit\b|^if\b|^[a-z ]+\s+have\s+\d+.*value\b|cooldowns?\s+(?:are\s+)?(?:reduced|decreased|increased)\b/.test(value)) {
    return { event: "always" };
  }
  if (/^you take\b|^the cooldown of\b|^(?:this item'?s|its) cooldown\b|^permanently gain\b|^every \d+\b/.test(value)) {
    return { event: "always" };
  }

  return { event: "unknown" };
}

function durationValue(text: string): number | undefined {
  const forMatch = text.match(new RegExp(`\\bfor\\s+(${NUMBER_PATTERN})\\s+(?:\\w+\\s+)?second(?:\\(s\\))?s?\\b`, "i"));
  if (forMatch) {
    return Number(forMatch[1]);
  }

  const durationMatches = [...text.matchAll(new RegExp(`(${NUMBER_PATTERN})\\s+(?:charge|haste|slow|freeze)?\\s*second(?:\\(s\\))?s?\\b`, "gi"))];
  const lastDuration = durationMatches.at(-1)?.[1];
  return lastDuration == null ? undefined : Number(lastDuration);
}

function statAmount(text: string, stat: string | undefined): number | undefined {
  if (!stat) {
    return firstNumber(text);
  }

  const aliases: Record<string, string> = {
    crit: "crit%?(?:\\s+crit\\s+chance|\\s+chance)?",
    ammo: "(?:max\\s+ammo|ammo)",
    health: "(?:max\\s+health|health)",
    value: "value",
    damage: "damage",
    shield: "shield",
    heal: "heal",
    burn: "(?:burn|heated)",
    poison: "poison",
    regen: "regen",
    rage: "rage",
    prestige: "prestige",
    gold: "(?:gold|income)"
  };
  const alias = aliases[stat];
  if (!alias) {
    return firstNumber(text);
  }

  const beforeStat = text.match(new RegExp(`(${NUMBER_PATTERN})%?\\s+${alias}\\b`, "i"));
  if (beforeStat) {
    return Number(beforeStat[1]);
  }

  const afterStat = text.match(new RegExp(`\\b${alias}\\b\\s+(?:equal\\s+to\\s+)?(${NUMBER_PATTERN})`, "i"));
  return afterStat ? Number(afterStat[1]) : firstNumber(text);
}

function actionValue(type: EffectActionType, text: string, stat?: string): number | undefined {
  if (["haste", "slow", "freeze", "charge"].includes(type)) {
    return durationValue(text) ?? firstNumber(text);
  }

  if (["lifesteal", "flying", "cleanse", "redirect", "start_sandstorm"].includes(type)) {
    return undefined;
  }

  if (type === "increase_value" && /\bbetween\s+\d+\s+and\s+\d+\b/i.test(text)) {
    return undefined;
  }

  if (type === "gain_stat") {
    return statAmount(text, stat);
  }

  if (type === "multicast") {
    return firstNumber(text);
  }

  if (type === "modify_stat") {
    return firstNumber(text);
  }

  return firstNumber(text);
}

function inferAction(text: string, tags: TagLike[]): ParsedEffect["action"] {
  const actionText = actionSegment(text);
  const value = lower(actionText);
  const assignedTag = findAssignedTag(actionText, tags);
  const numericStat = statFromText(actionText);
  let type: EffectActionType = "unknown";
  let stat: string | undefined;
  let tag: string | undefined;

  if (!actionText.trim()) {
    type = "unknown";
  } else if (/\bthe sandstorm begins\b/.test(value)) {
    type = "start_sandstorm";
  } else if (/\bis targeted instead\b|\btargeted instead\b/.test(value)) {
    type = "redirect";
  } else if (/\b(?:lasts?|last) half as long\b|\bneed twice as much\b|\baffected by (?:freeze|slow).+half as long\b/.test(value)) {
    type = "modify_stat";
    stat = /rage|enrage/.test(value) ? "enrage" : statFromText(actionText);
  } else if (/^multicast:\s*\d+|has\s+\+\d+.*\bmulticast\b/.test(value)) {
    type = "multicast";
  } else if (/^lifesteal$|\b(?:has|have|gains?)\s+lifesteal\b/.test(value)) {
    type = "lifesteal";
  } else if (/\bmax health\b|\bgain health\b/.test(value) && /\b(?:gain|gains|increase|increases|double|doubles|permanently)\b/.test(value)) {
    type = "gain_health";
  } else if (/^regen\b|\bregen\s+\d+|^you have \+?\d+\s+regen\b/.test(value)) {
    type = "regen";
  } else if (/\breload\b/.test(value)) {
    type = "reload";
  } else if (/\buse this\b|\buse the\b|\buse your\b|^use all\b|^use another\b/.test(value)) {
    type = "use";
  } else if (/\brepair\b/.test(value)) {
    type = "repair";
  } else if (/\bcleanse\b|\bremove\s+(?:freeze|slow|burn|poison)\b/.test(value)) {
    type = "cleanse";
  } else if (/\bthis is destroyed instead\b|\bis destroyed instead\b/.test(value)) {
    type = "destroy";
  } else if (/\btransform\b/.test(value)) {
    type = "transform";
  } else if (/\benchant\b/.test(value)) {
    type = "enchant";
  } else if (/\bupgrade\b/.test(value)) {
    type = "upgrade";
  } else if (/\btrigger an additional time\b/.test(value)) {
    type = "use";
  } else if (/\bdiscount\b/.test(value)) {
    type = "increase_value";
  } else if (/\bset\b.*\bvalue\b|\bvalue\b|\bsell price\b|\bbuy price\b/.test(value) && /\b(?:increase|increases|gain|gains|set|double|doubles|reduced|decreased)\b/.test(value)) {
    type = "increase_value";
  } else if (/\b(?:starts?|stops?|start or stop)\s+flying\b/.test(value)) {
    type = "flying";
  } else if (/\btake no damage\b|\btakes no damage\b|\bless damage\b/.test(value)) {
    type = "shield";
  } else if (/\b(?:learn|embark|expedition)\b/.test(value)) {
    type = "gain_item";
  } else if (/\b(?:get|gets|create|creates)\s+(?:a|an|\d+)\b/.test(value)) {
    type = "gain_item";
  } else if (/\bget\s+[a-z -]+equal to\b/.test(value)) {
    type = "gain_item";
  } else if (/^sells?\s+for\s+gold\b|\brecover\s+\d+\s+gold\b/.test(value)) {
    type = "gain_gold";
  } else if (/\bcosts?\b.*\bless\s+gold\b|\brerolls cost\b|\bsell items for\b|\bbuy items for\b/.test(value)) {
    type = "gain_gold";
  } else if (/\brecover\s+\d+\s+prestige\b/.test(value)) {
    type = "gain_stat";
    stat = "prestige";
  } else if (/\bspend all .*ammo\b/.test(value)) {
    type = "gain_stat";
    stat = "ammo";
  } else if (/\bincrease this\b/.test(value) && !numericStat) {
    type = "gain_stat";
  } else if (/\bcooldowns?\b.*\b(?:reduced|decreased|increased|halved)\b|\b(?:reduce|decrease|increase)\b.*\bcooldowns?\b|\bcooldown\b.*\breduce\b|\bcut\b.*\bcooldown\b/.test(value)) {
    type = "reduce_cooldown";
  } else if (/\bpermanently increase\b.*\b(?:damage|shield|heal|burn|poison|regen|crit|ammo|value)\b/.test(value)) {
    type = "gain_stat";
    stat = numericStat;
  } else if (/\b(?:gain|gains|have|has|loses?|permanently\s+gain|permanently\s+gains)\b/.test(value) && numericStat) {
    if (/^gain\s+[-+]?\d+(?:\.\d+)?\s+shield\b/.test(value)) {
      type = "shield";
    } else if (/^gain\s+[-+]?\d+(?:\.\d+)?\s+heal\b|^heal\s+[-+]?\d+(?:\.\d+)?\s+heal\b/.test(value)) {
      type = "heal";
    } else {
      type = numericStat === "health" && /\bmax health\b/.test(value) ? "gain_health" : "gain_stat";
      stat = numericStat === "health" && type === "gain_stat" ? "health" : numericStat;
    }
  } else if (assignedTag || /\bare\s+(?:relics|dinosaurs|vehicles|friends|aquatic|drones)\b|\bis a relic\b|\b(?:has|have)\s+the\s+(?:types?|core type)\b|\bis a vehicle\b|\bgains? that item'?s types?\b|\bgains? \d+ random types?\b/.test(value)) {
    type = "buff_tag";
    tag = assignedTag ?? (/random types?\b/.test(value) ? undefined : findKnownTag(actionText, tags));
  } else if (/^heat\b/.test(value)) {
    type = "burn";
  } else if (/^deal\b|^this deals?\b/.test(value)) {
    type = "damage";
  } else if (/^shield\b/.test(value)) {
    type = "shield";
  } else if (/^heal\b/.test(value)) {
    type = "heal";
  } else if (/^burn\b|^heated:\s*burn\b/.test(value)) {
    type = "burn";
  } else if (/^poison\b/.test(value)) {
    type = "poison";
  } else if (/\bchilled\b|\bfrozen\b|\bimmune to freeze\b|\baffected by freeze\b/.test(value)) {
    type = "freeze";
  } else if (/\bdestroy\b/.test(value)) type = "destroy";
  else if (/\bmulticast\b/.test(value)) type = "multicast";
  else if (/\bcharge\b/.test(value)) type = "charge";
  else if (/\bhaste\b/.test(value)) type = "haste";
  else if (/\bslows?\b/.test(value)) type = "slow";
  else if (/\bfreeze|frozen\b/.test(value)) type = "freeze";
  else if (/\bpoison\b/.test(value)) type = "poison";
  else if (/\bburn|heated\b/.test(value)) type = "burn";
  else if (/\bshield\b/.test(value)) type = "shield";
  else if (/\bover-?heal|\bheal\b/.test(value)) type = "heal";
  else if (/\bmax health\b|\bgain health\b|\bhealth\b/.test(value)) type = "gain_health";
  else if (/\bdamage\b/.test(value)) {
    type = /\b(?:gain|gains|have|has|\+)\b/.test(value) ? "gain_stat" : "damage";
    stat = type === "gain_stat" ? "damage" : undefined;
  } else if (/\bcrit\b/.test(value)) {
    type = "gain_stat";
    stat = "crit";
  } else if (/\bgold\b|\bincome\b/.test(value)) type = "gain_gold";
  else if (/^double this\b/.test(value)) type = "increase_value";
  else if (/\bgain\b|\bhave \+|\bhas \+|\bpermanently gains?\b/.test(value)) {
    type = "gain_stat";
    stat = numericStat ?? findKnownTag(actionText, tags) ?? value.match(/\bgain ([a-z ]+)/)?.[1]?.trim();
  }

  if (type === "gain_stat") {
    stat = stat ?? numericStat ?? findKnownTag(actionText, tags) ?? value.match(/\bgain ([a-z ]+)/)?.[1]?.trim();
  }

  const amount = actionValue(type, actionText, stat);
  return {
    type,
    ...(amount != null ? { value: amount } : {}),
    ...(stat ? { stat } : {}),
    ...(tag ? { tag } : {})
  };
}

function inferTarget(
  text: string,
  action: ParsedEffect["action"],
  tags: TagLike[],
  conditions: EffectCondition[] = [],
  triggerTarget?: ParsedEffect["triggerTarget"]
): ParsedEffect["target"] {
  const targetText = actionSegment(text);
  const value = lower(targetText);
  const positionalTarget = inferPositionalTarget(targetText, tags);
  if (positionalTarget) {
    return positionalTarget;
  }

  if (triggerTarget && /\b(?:it|its|that item|they|their|them)\b/.test(value)) {
    return triggerTarget;
  }

  const assignmentSubjectTag = action.type === "buff_tag" ? findSubjectTag(text, tags) : undefined;
  const actionSubjectTag = findActionSubjectTag(text, tags);
  const knownTargetTag = asTargetTag(findKnownTagInSegment(targetText, tags));
  const conditionTargetTag = targetTagFromConditions(conditions);
  let scope: EffectTargetScope = "unknown";
  const defaultEnemyAction = ["damage", "burn", "poison", "slow", "freeze"].includes(action.type);
  const defaultSelfAction = [
    "shield",
    "heal",
    "regen",
    "lifesteal",
    "gain_health",
    "gain_stat",
    "gain_gold",
    "gain_item",
    "increase_value",
    "multicast",
    "repair",
    "reload",
    "reduce_cooldown",
    "flying",
    "cleanse",
    "transform",
    "enchant",
    "upgrade",
    "use",
    "redirect",
    "modify_stat",
    "start_sandstorm"
  ].includes(action.type);

  if (conditionTargetTag && /\b(?:it|its|they|their|them)\b/.test(value)) scope = "allied_items";
  else if (/\byourself\b/.test(value)) scope = "self";
  else if (/^this\s+gains?\b|^this\s+has\b|^this\s+is\b/.test(value)) scope = "self";
  else if (defaultSelfAction && /\bthis item\b|\bthis item's\b|\bits cooldown\b|\bits cooldowns\b/.test(value)) scope = "self";
  else if (/^use this\b|^this\b/.test(value)) scope = "self";
  else if (/\b(?:it|its|them|their)\b/.test(value)) scope = triggerTarget?.scope ?? "self";
  else if (/^(?:regen|shield|heal|multicast:|lifesteal|sells?\s+for|recover)\b/.test(value)) scope = "self";
  else if (/\benemy items?\b|\ban enemy item\b|\btheir items?\b|\ball enemy items?\b/.test(value)) scope = "enemy_items";
  else if (/\benemy\b|\bthat player\b/.test(value)) scope = "enemy";
  else if (defaultEnemyAction && /^(?:deal|burn|poison|slow|freeze|heat)\b/.test(value)) scope = "enemy";
  else if (/\byour skills?\b/.test(value)) scope = "allied_skills";
  else if (/\byour\b.*\b(?:items?|weapons?|tools?|friends?|vehicles?|drones?|relics?|potions?|properties|cores?)\b/.test(value)) scope = "allied_items";
  else if (/\byour (?:other )?(?:core|food|friends?|vehicles?|drones?|relics?|tools?|weapons?|potions?|properties|slushees?)\b|\ball (?:weapon|non-weapon|tech|non-tech|friend|vehicle|drone|tool|property|item)\b|\b(?:a|another|other|\d+)\s+(?:core|food|friend|vehicle|drone|relic|tool|weapon|potion|property|toy|enchanted|flying)\b|\byour items?\b|\ball (?:your )?items?\b|\bother items?\b|\ban? item\b|\ban?\s+(?:non-)?[a-z-]+\s+items?\b|\ban?\s+[a-z-]+\s+or\s+[a-z-]+\s+items?\b|\bthat item\b|\banother item\b|\blargest item\b|\blowest value item\b|\b\d+\s+item\(s\)|\bitem\(s\)|\bitems\b/.test(value)) scope = "allied_items";
  else if (/\bthis\b|\bself\b/.test(value)) scope = "self";
  else if (/\brandom\b/.test(value)) scope = "random";
  else if (defaultEnemyAction) scope = "enemy";
  else if (defaultSelfAction) scope = "self";

  const taggableScopes: EffectTargetScope[] = ["adjacent", "left", "right", "leftmost", "rightmost", "allied_items", "enemy_items", "allied_skills"];
  const subjectTag = assignmentSubjectTag ?? actionSubjectTag;
  const fallbackTag = isStatOnlyTag(knownTargetTag, action, targetText) ? undefined : knownTargetTag;
  const pronounTag = /\b(?:it|its|them|their)\b/.test(value) ? triggerTarget?.tag : undefined;
  const targetTag = taggableScopes.includes(scope) ? pronounTag ?? conditionTargetTag ?? subjectTag ?? fallbackTag : undefined;

  return {
    scope,
    ...(targetTag && targetTag !== action.type && targetTag !== action.tag ? { tag: targetTag } : {})
  };
}

function parseEffectDraft(
  text: string,
  tags: TagLike[] = [],
  inheritedConditions: EffectCondition[] = []
): ParsedEffect {
  const action = inferAction(text, tags);
  const trigger = inferTrigger(text, tags);
  const conditions = inferConditions(text, tags, inheritedConditions);
  const triggerTarget = inferTriggerTarget(text, tags);

  return {
    trigger,
    action,
    target: inferTarget(text, action, tags, conditions, triggerTarget),
    ...(triggerTarget ? { triggerTarget } : {}),
    ...(conditions.length > 0 ? { conditions } : {}),
    rawText: text
  };
}

function parseEffectDraftsFromTexts(texts: string[], tags: TagLike[] = []): ParsedEffect[] {
  const normalizedTexts = texts.map((text) => text.trim()).filter(Boolean);
  if (normalizedTexts.length === 0) return [];

  const effects: ParsedEffect[] = [];
  let inheritedConditions: EffectCondition[] = [];

  for (const text of normalizedTexts) {
    for (const part of splitEffectText(text, tags)) {
      const effect = parseEffectDraft(part, tags, inheritedConditions);
      effects.push(effect);
      const exactlyOneConditions = effect.conditions?.filter((condition) => condition.type === "exactly_one") ?? [];
      if (exactlyOneConditions.length > 0) {
        inheritedConditions = exactlyOneConditions;
      }
    }
  }

  return effects;
}

export function parseStructuredEffectsFromTexts(texts: string[], tags: TagLike[] = []): StructuredEffect[] {
  const normalizedTexts = texts.map((text) => text.trim()).filter(Boolean);
  const bonusEffects = structuredBonusEffects(normalizedTexts, tags);
  if (bonusEffects) {
    return bonusEffects;
  }

  if (normalizedTexts.length === 0) return [];

  const effects: StructuredEffect[] = [];
  let inheritedConditions: EffectCondition[] = [];

  for (const text of normalizedTexts) {
    const specialWholeText = parseSpecialStructuredEffect(text, effects.length, tags);
    if (specialWholeText) {
      effects.push(specialWholeText);
      continue;
    }

    for (const part of splitEffectText(text, tags)) {
      const special = parseSpecialStructuredEffect(part, effects.length, tags);
      if (special) {
        effects.push(special);
        continue;
      }

      const effect = parseEffectDraft(part, tags, inheritedConditions);
      effects.push(toStructuredEffect(effect, effects.length));
      const exactlyOneConditions = effect.conditions?.filter((condition) => condition.type === "exactly_one") ?? [];
      if (exactlyOneConditions.length > 0) {
        inheritedConditions = exactlyOneConditions;
      }
    }
  }

  return effects;
}
