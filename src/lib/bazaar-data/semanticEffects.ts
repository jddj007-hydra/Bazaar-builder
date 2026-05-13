import { slugify } from "./slug";
import { SEMANTIC_IR_SCHEMA_VERSION } from "./effectParserVersions";
import { projectionStatusFromEffects } from "./effectParserAudit";
import type {
  EffectActionType,
  EffectEvent,
  StructuredActionType,
  StructuredAttributeType,
  StructuredCondition,
  StructuredEffect,
  StructuredEffectPredicate,
  StructuredTagExpr,
  StructuredTarget,
  StructuredTrigger,
  StructuredTriggerType,
  StructuredValue
} from "./types";

type TagLike = { name: string; slug?: string } | string;

export type SemanticId = string;
export type Confidence = "high" | "medium" | "low";
export type Owner = "self" | "enemy" | "any";
export type Unit = "seconds" | "percent" | "count" | "gold" | "health" | "damage" | "value";
export type Cmp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
export type NumericOp = "add" | "subtract" | "multiply" | "divide" | "set" | "halve" | "double";

export type KnownItemType =
  | "weapon"
  | "tool"
  | "vehicle"
  | "drone"
  | "relic"
  | "food"
  | "aquatic"
  | "friend"
  | "property"
  | "core"
  | "apparel"
  | "potion"
  | "reagent"
  | "dinosaur"
  | "dragon"
  | "tech"
  | "toy"
  | "trap"
  | "loot"
  | "ray"
  | "merchant";

export type ItemType = KnownItemType | (string & {});

export type MechanicKeyword =
  | "damage"
  | "burn"
  | "poison"
  | "shield"
  | "heal"
  | "regen"
  | "haste"
  | "slow"
  | "freeze"
  | "charge"
  | "cooldown"
  | "crit"
  | "multicast"
  | "flying"
  | "lifesteal"
  | "rage"
  | "reload"
  | "destroy"
  | "ammo"
  | (string & {});

export type StatusFlag =
  | "heated"
  | "chilled"
  | "frozen"
  | "slowed"
  | "hasted"
  | "enraged"
  | "flying"
  | "lifesteal_enabled"
  | "immune_to_freeze"
  | "immune_to_slow"
  | "immune_to_destroy"
  | (string & {});

export type EntityKind =
  | "item"
  | "skill"
  | "card"
  | "player"
  | "slot"
  | "board"
  | "merchant"
  | "shop"
  | "effect_template"
  | "effect_instance"
  | "event";

export type StatRef = {
  domain: "card" | "item" | "player" | "effect" | "slot" | "variable";
  id:
    | "ammo"
    | "damageAmount"
    | "burnAmount"
    | "poisonAmount"
    | "shieldAmount"
    | "healAmount"
    | "regenAmount"
    | "cooldownSeconds"
    | "cooldownReduction"
    | "critChance"
    | "critDamage"
    | "multicast"
    | "value"
    | "sellPrice"
    | "buyPrice"
    | "gold"
    | "income"
    | "prestige"
    | "experience"
    | "maxHealth"
    | "health"
    | "rageGain"
    | "rageRequirement"
    | "rerollCost"
    | "durationSeconds"
    | "chargeSeconds"
    | (string & {});
};

export type BoolExpr<T> =
  | { op: "atom"; atom: T }
  | { op: "and"; exprs: BoolExpr<T>[] }
  | { op: "or"; exprs: BoolExpr<T>[] }
  | { op: "not"; expr: BoolExpr<T> };

export type VariableRef = { variableId: SemanticId };

export type ValueExpr =
  | { kind: "fixed"; value: number; unit?: Unit }
  | { kind: "range"; min: number; max: number; unit?: Unit }
  | { kind: "tiered"; values: number[]; unit?: Unit }
  | { kind: "stat"; source: EntitySelector; stat: StatRef }
  | { kind: "stat_aggregate"; source: EntitySelector; stat: StatRef; aggregate: "sum" | "min" | "max" | "average" }
  | { kind: "stat_change"; owner?: Owner; stat: StatRef; scope?: "fight" | "day" | "run" | "encounter" }
  | { kind: "identifier"; value: string }
  | { kind: "variable"; ref: VariableRef }
  | { kind: "count"; selector: EntitySelector }
  | { kind: "scale"; factor: number; value: ValueExpr }
  | { kind: "formula"; op: "add" | "sub" | "mul" | "div" | "min" | "max"; args: ValueExpr[] };

export type EntityPredicate =
  | { kind: "has_item_type"; type: ItemType }
  | { kind: "has_mechanic"; mechanic: MechanicKeyword }
  | { kind: "has_status"; status: StatusFlag }
  | { kind: "has_size"; size: "small" | "medium" | "large" }
  | { kind: "has_rarity"; rarity: "bronze" | "silver" | "gold" | "diamond" | "legendary" }
  | { kind: "tier_compare"; cmp: Cmp; reference: EntitySelector }
  | { kind: "stat_compare"; stat: StatRef; cmp: Cmp; value: ValueExpr }
  | { kind: "count_compare"; selector: EntitySelector; cmp: Cmp; value: ValueExpr }
  | { kind: "position"; position: PositionSelector }
  | { kind: "slot_occupied_by_item" }
  | { kind: "item_in_source_slot" };

export type PositionSelector =
  | "self"
  | "adjacent"
  | "left"
  | "right"
  | "leftmost"
  | "rightmost"
  | "random"
  | "all"
  | "occupant_of_source_slot";

export type EntitySelector = {
  entity: EntityKind;
  owner?: Owner;
  zone?: "board" | "stash" | "hand" | "slot" | "shop" | "all";
  quantifier?: "self" | "one" | "all" | "random" | "first" | "leftmost" | "rightmost" | "x_most" | "up_to";
  position?: PositionSelector;
  predicates?: BoolExpr<EntityPredicate>;
  bindAs?: string;
  excludeSelf?: boolean;
};

export type EventName =
  | "fight_started"
  | "fight_ended"
  | "item_used"
  | "card_fired"
  | "item_sold"
  | "item_bought"
  | "item_transformed"
  | "item_destroyed"
  | "ammo_empty"
  | "combat_won"
  | "combat_lost"
  | "crit"
  | "effect_applied"
  | "health_threshold_crossed"
  | "would_be_defeated"
  | "enraged"
  | "status_ended"
  | "day_started"
  | "merchant_visited";

export type EventPattern = {
  event: EventName;
  actor?: EntitySelector;
  subject?: EntitySelector;
  object?: EntitySelector;
  sourceEventText?: string;
  threshold?: {
    attribute: StatRef;
    value: ValueExpr;
    crossing: "from_at_or_above_to_below" | "from_at_or_below_to_above" | "above" | "below";
  };
};

export type EffectPredicate =
  | { kind: "has_mechanic"; mechanic: MechanicKeyword }
  | { kind: "field_exists"; field: "amount" | "durationSeconds" | "chargeSeconds" }
  | { kind: "source_owner"; owner: Owner };

export type SemanticPredicate =
  | { domain: "entity"; predicate: EntityPredicate }
  | { domain: "effect"; predicate: EffectPredicate }
  | { domain: "player_state"; owner?: Owner; state: StatusFlag | string }
  | { domain: "event"; event: EventName };

export type FrequencyLimiter =
  | { kind: "none" }
  | { kind: "once"; reset: "fight" | "day" | "run" | "encounter" | "never"; consume: "on_trigger_match" | "on_action_resolve" }
  | { kind: "first_n"; count: ValueExpr; reset: "fight" | "day" | "run" | "never"; consume: "on_trigger_match" | "on_action_resolve" };

export type DurationSpec =
  | { kind: "instant" }
  | { kind: "for_seconds"; seconds: ValueExpr }
  | { kind: "for_fight" }
  | { kind: "permanent" }
  | { kind: "while_source_active" }
  | { kind: "while_condition"; condition: BoolExpr<SemanticPredicate>; reversible?: boolean };

export type SemanticVariable = {
  id: SemanticId;
  owner: "source_card" | "player" | "global";
  name: string;
  valueType: "number" | "boolean" | "set";
  defaultValue?: ValueExpr;
  statHint?: StatRef;
  lifetime: "combat" | "day" | "run" | "permanent";
  evidence?: Evidence[];
};

export type EffectSelector = {
  entity: "effect_template" | "effect_instance";
  owner?: Owner;
  predicates?: BoolExpr<EffectPredicate>;
};

export type EffectTransform =
  | { kind: "scale"; field: string; factor: number; rounding?: "unknown" | "floor" | "ceil" | "nearest" }
  | { kind: "set"; field: string; value: ValueExpr }
  | { kind: "add"; field: string; value: ValueExpr };

export type SemanticAction =
  | { type: "apply_effect"; mechanic: MechanicKeyword; target: EntitySelector; amount?: ValueExpr; duration?: DurationSpec }
  | { type: "modify_stat"; target: EntitySelector; stat: StatRef; op: NumericOp; amount: ValueExpr; duration?: DurationSpec }
  | { type: "modify_status"; target: EntitySelector; status: StatusFlag; op: "add" | "remove" | "set"; duration?: DurationSpec }
  | { type: "modify_variable"; variable: VariableRef; op: NumericOp; amount: ValueExpr }
  | { type: "modify_previous_action_value"; op: NumericOp; amount: ValueExpr; description?: string }
  | { type: "modify_slot"; target: EntitySelector; op: "set_terrain" | "add_terrain" | "remove_terrain"; terrain: string; linkedEffects?: SemanticClause[] }
  | { type: "modify_effect"; target: EffectSelector; transform: EffectTransform }
  | { type: "modify_tags"; target: EntitySelector; op: "copy_from" | "add_random"; source?: EntitySelector; amount?: ValueExpr; description?: string }
  | { type: "reset_variable"; variable?: VariableRef; target?: EntitySelector; description?: string }
  | { type: "add_player_state"; target: EntitySelector; state: string }
  | { type: "modify_status_duration"; target: EntitySelector; status: StatusFlag; op: "add" | "subtract" | "multiply" | "set"; amount: ValueExpr }
  | { type: "start_sandstorm"; target: EntitySelector }
  | { type: "redirect"; target: EntitySelector; replacement: EntitySelector; description?: string }
  | { type: "gain_item"; item: EntitySelector; amount?: ValueExpr; description?: string }
  | { type: "transform_item"; target: EntitySelector; into?: EntitySelector; amount?: ValueExpr; description?: string }
  | { type: "enchant_item"; target: EntitySelector; enchantment?: string }
  | { type: "upgrade_item"; target: EntitySelector }
  | { type: "prevent_damage"; target: EntitySelector; duration?: DurationSpec }
  | { type: "use_item"; target: EntitySelector }
  | { type: "destroy_item"; target: EntitySelector }
  | { type: "unknown"; rawText: string };

export type ActionNode =
  | { node: "atomic"; action: SemanticAction }
  | { node: "parallel"; actions: ActionNode[] }
  | { node: "sequence"; actions: ActionNode[] }
  | { node: "conditional"; if: BoolExpr<SemanticPredicate>; then: ActionNode[]; else?: ActionNode[] };

export type SemanticClause = {
  id: SemanticId;
  kind: "activated" | "triggered" | "aura" | "modifier" | "replacement" | "declarative";
  sourceText?: string;
  normalizedText?: string;
  activeIn?: ("combat" | "day" | "shop" | "encounter" | "sell" | "buy" | "stash")[];
  trigger?: EventPattern;
  condition?: BoolExpr<SemanticPredicate>;
  limiter?: FrequencyLimiter;
  duration?: DurationSpec;
  actions: ActionNode[];
  confidence?: Confidence;
  warnings?: SemanticWarning[];
};

export type Evidence = {
  source: "tooltip" | "card_tag" | "database_tag" | "parser_inference" | "deep_mechanics";
  text?: string;
  span?: [number, number];
};

export type SemanticWarning = {
  code:
    | "BOOLEAN_AMBIGUITY"
    | "TARGET_AMBIGUITY"
    | "ATTRIBUTE_INFERRED_FROM_TAG"
    | "ROUNDING_UNKNOWN"
    | "UNSUPPORTED_PROJECTION"
    | "STATUS_AS_TAG_LOSSY"
    | "UNSUPPORTED_SEMANTIC_PARSE";
  severity: "info" | "warning" | "error";
  message: string;
  evidence?: Evidence[];
};

export type ExtractedTags = {
  itemTypes: ItemType[];
  mechanics: MechanicKeyword[];
  statuses: StatusFlag[];
  playerStates: string[];
  sizes: string[];
  rarities: string[];
  zones: string[];
};

export type SemanticEffectDocument = {
  schemaVersion: typeof SEMANTIC_IR_SCHEMA_VERSION;
  sourceCardId?: string;
  sourceCardName?: string;
  rawText: string;
  variables?: SemanticVariable[];
  clauses: SemanticClause[];
  extractedTags: ExtractedTags;
  evidence: Evidence[];
  confidence: Confidence;
  warnings: SemanticWarning[];
  projection?: {
    structuredEffectIds: string[];
    status: "exact" | "partial" | "lossy" | "unsupported";
    warnings?: string[];
  };
};

export type SemanticParseOptions = {
  sourceCardId?: string;
  sourceCardName?: string;
  structuredEffectIds?: string[];
};

export type SemanticProjectionResult = {
  structuredEffects: StructuredEffect[];
  status: "exact" | "partial" | "lossy" | "unsupported";
  warnings: string[];
};

const NUMBER_PATTERN = "[-+]?\\d+(?:\\.\\d+)?";
const KNOWN_ITEM_TYPES = new Set<KnownItemType>([
  "weapon",
  "tool",
  "vehicle",
  "drone",
  "relic",
  "food",
  "aquatic",
  "friend",
  "property",
  "core",
  "apparel",
  "potion",
  "reagent",
  "dinosaur",
  "dragon",
  "tech",
  "toy",
  "trap",
  "loot",
  "ray",
  "merchant"
]);
const MECHANICS = new Set<MechanicKeyword>([
  "damage",
  "burn",
  "poison",
  "shield",
  "heal",
  "regen",
  "haste",
  "slow",
  "freeze",
  "charge",
  "cooldown",
  "crit",
  "multicast",
  "flying",
  "lifesteal",
  "rage",
  "reload",
  "destroy",
  "ammo"
]);
const STATUS_ALIASES: Array<[RegExp, StatusFlag]> = [
  [/\bheated\b/i, "heated"],
  [/\bchilled\b/i, "chilled"],
  [/\bfrozen\b/i, "frozen"],
  [/\bslowed\b/i, "slowed"],
  [/\bhasted\b/i, "hasted"],
  [/\benraged\b/i, "enraged"],
  [/\bflying\b/i, "flying"],
  [/\blifesteal\b/i, "lifesteal_enabled"]
];

function lower(value: string): string {
  return value.toLowerCase();
}

function fixed(value: number, unit?: Unit): ValueExpr {
  return { kind: "fixed", value, ...(unit ? { unit } : {}) };
}

function atom<T>(value: T): BoolExpr<T> {
  return { op: "atom", atom: value };
}

function not<T>(expr: BoolExpr<T>): BoolExpr<T> {
  return { op: "not", expr };
}

function semanticAtom(predicate: SemanticPredicate): BoolExpr<SemanticPredicate> {
  return atom(predicate);
}

function itemTypePredicate(type: ItemType): EntityPredicate {
  return { kind: "has_item_type", type };
}

function mechanicPredicate(mechanic: MechanicKeyword): EntityPredicate {
  return { kind: "has_mechanic", mechanic };
}

function statusPredicate(status: StatusFlag): EntityPredicate {
  return { kind: "has_status", status };
}

function playerStatePredicate(state: StatusFlag | string, owner: Owner = "self"): BoolExpr<SemanticPredicate> {
  return semanticAtom({ domain: "player_state", owner, state });
}

function evidence(text: string): Evidence {
  return { source: "tooltip", text };
}

function warning(code: SemanticWarning["code"], message: string, severity: SemanticWarning["severity"] = "warning", text?: string): SemanticWarning {
  return {
    code,
    severity,
    message,
    ...(text ? { evidence: [evidence(text)] } : {})
  };
}

function hasSameOrLowerTierComparison(text: string): boolean {
  return /\bsame\s+or\s+lower\s+tier\s+as\s+this\b/i.test(text);
}

function numberValues(text: string): number[] {
  return [...text.matchAll(new RegExp(NUMBER_PATTERN, "g"))].map((match) => Number(match[0]));
}

function placeholderValue(text: string): ValueExpr | undefined {
  const match = text.match(/\{(?<name>[a-z0-9_.-]+)\}/i);
  return match?.groups?.name ? { kind: "identifier", value: match.groups.name } : undefined;
}

function amountFromText(text: string, unit?: Unit): ValueExpr | undefined {
  const placeholder = placeholderValue(text);
  if (placeholder) {
    return placeholder;
  }
  const values = numberValues(text);
  if (values.length === 0) {
    return undefined;
  }
  if (values.length >= 2 && /\b(?:to|between)\b/i.test(text)) {
    return { kind: "range", min: values[0], max: values[1], ...(unit ? { unit } : {}) };
  }
  if (values.length > 1 && /[»>]/.test(text)) {
    return { kind: "tiered", values, ...(unit ? { unit } : {}) };
  }
  return fixed(values.at(-1) ?? values[0], unit);
}

function ownerFromText(text: string): Owner {
  return /\benemy\b|\bopponent\b/i.test(text) ? "enemy" : /\bany\b|\beach player\b|\bplayers?\b/i.test(text) ? "any" : "self";
}

function scopeFromText(text: string): "fight" | "day" | "run" | "encounter" | undefined {
  if (/\bfight\b|\bcombat\b/i.test(text)) return "fight";
  if (/\bday\b|\bhour\b/i.test(text)) return "day";
  if (/\brun\b/i.test(text)) return "run";
  if (/\bencounter\b/i.test(text)) return "encounter";
  return undefined;
}

function multiplierFromWords(text: string): number | undefined {
  if (/\bhalf\b|\bhalved\b/i.test(text)) return 0.5;
  if (/\bdouble\b|\btwice\b/i.test(text)) return 2;
  if (/\btriple\b|\bthree times\b/i.test(text)) return 3;
  const match = text.match(new RegExp(`\\b(?<factor>${NUMBER_PATTERN})\\s+times\\b`, "i"));
  return match?.groups?.factor ? Number(match.groups.factor) : undefined;
}

function attributeSourceFromText(text: string, tags: TagLike[]): EntitySelector {
  const value = lower(text);
  const owner = ownerFromText(text);
  if (/\badjacent\b/.test(value)) return itemSelector({ owner, position: "adjacent", predicates: predicatesFromFilter(text, tags) });
  if (/\bto the left\b|\bleft\b/.test(value)) return itemSelector({ owner, position: "left", predicates: predicatesFromFilter(text, tags) });
  if (/\bto the right\b|\bright\b/.test(value)) return itemSelector({ owner, position: "right", predicates: predicatesFromFilter(text, tags) });
  if (/\bthis\b|\bits\b|\bthis item'?s\b/.test(value)) return itemSelector({ owner: "self", quantifier: "self" });
  if (/\bthat\b|\btrigger\b|\bthat food\b|\bthat item\b/.test(value)) return itemSelector({ owner, quantifier: "self" });
  if (/\byou\b|\byour\b/.test(value) && !/\bitems?\b/.test(value)) return playerSelector(owner);
  return targetFromSubjectText(text, tags);
}

function valueReferenceFromText(text: string, tags: TagLike[], unit?: Unit): ValueExpr | undefined {
  const value = lower(text).replace(/[.。]+$/g, "").trim();
  if (!value) return undefined;

  const equalToMatch = value.match(/\bequal to\s+(?<expr>.+)$/i);
  if (equalToMatch?.groups?.expr) {
    const rhs = equalToMatch.groups.expr.trim();
    if (rhs && rhs !== value) {
      const reference = valueReferenceFromText(rhs, tags, unit);
      if (reference) return reference;
    }
  }

  const percentReferenceMatch = value.match(new RegExp(`\\b(?<percent>${NUMBER_PATTERN})%\\s+of\\s+(?<expr>.+)$`, "i"));
  if (percentReferenceMatch?.groups?.percent && percentReferenceMatch.groups.expr) {
    const inner = valueReferenceFromText(percentReferenceMatch.groups.expr, tags, unit);
    if (inner) {
      return { kind: "scale", factor: Number(percentReferenceMatch.groups.percent) / 100, value: inner };
    }
  }

  const rangeMatch = value.match(new RegExp(`\\bbetween\\s+(?<min>${NUMBER_PATTERN})\\s+and\\s+(?<max>${NUMBER_PATTERN})\\b`, "i"));
  if (rangeMatch?.groups?.min && rangeMatch.groups.max) {
    return { kind: "range", min: Number(rangeMatch.groups.min), max: Number(rangeMatch.groups.max), ...(unit ? { unit } : {}) };
  }

  const fixedAmount = amountFromText(value, unit);
  const hasReferencePhrase = /\bequal to\b|\bfor each\b|\bfor every\b|\bper\b|\btimes\b|\bhalf\b|\bdouble\b|\btwice\b|\btriple\b|\bamount of\b|\bvalue of\b|\bcurrent\b|\byou'?ve gained\b|\bgained this fight\b/i.test(value);
  if (!hasReferencePhrase && fixedAmount) return fixedAmount;

  const countMatch = value.match(/\b(?:for each|for every|per)\s+(?<selector>.+?)(?:\s+you have|\s+this has|\s+on each player'?s board|\s+item'?s|\s+items?|\s*$)/i);
  if (countMatch?.groups?.selector) {
    const countValue: ValueExpr = { kind: "count", selector: targetFromSubjectText(countMatch.groups.selector, tags) };
    const base = fixedAmount?.kind === "fixed" ? { kind: "scale", factor: fixedAmount.value, value: countValue } as ValueExpr : countValue;
    return base;
  }

  const statChangeMatch = value.match(/\b(?<stat>gold|rage|shield|health|damage|burn|poison|regen|xp|experience)\s+(?:you(?:'ve| have)?\s+)?gained(?:\s+this\s+(?<scope>fight|day|run))?\b/i);
  if (statChangeMatch?.groups?.stat) {
    const stat = statFromText(statChangeMatch.groups.stat);
    if (stat) {
      const statChange: ValueExpr = {
        kind: "stat_change",
        owner: "self",
        stat,
        ...(statChangeMatch.groups.scope ? { scope: scopeFromText(statChangeMatch.groups.scope) } : {})
      };
      const fixedFactor = fixedAmount?.kind === "fixed" ? fixedAmount.value : undefined;
      const factor = multiplierFromWords(value) ?? fixedFactor;
      return factor && /\btimes\b/i.test(value) ? { kind: "scale", factor, value: statChange } : statChange;
    }
  }

  const amountOfMatch = value.match(/\bamount of (?<stat>gold|rage|shield|health|damage|burn|poison|regen|xp|experience) gained\b/i);
  if (amountOfMatch?.groups?.stat) {
    const stat = statFromText(amountOfMatch.groups.stat);
    if (stat) {
      const scope = scopeFromText(value);
      const statChange: ValueExpr = { kind: "stat_change", owner: "self", stat, ...(scope ? { scope } : {}) };
      const factor = multiplierFromWords(value);
      return factor ? { kind: "scale", factor, value: statChange } : statChange;
    }
  }

  const aggregateMatch = value.match(/\b(?:value of|(?<stat>value|damage|shield|crit(?: chance)?|burn|poison|regen|ammo|max ammo|cooldown|max health|income|gold))\s+(?<selector>adjacent items|your items|all your items|items from other heroes|items?)\b/i);
  if (aggregateMatch?.groups?.selector) {
    const stat = statFromText(aggregateMatch.groups.stat ?? "value") ?? { domain: "card", id: "value" };
    const aggregate: ValueExpr = {
      kind: "stat_aggregate",
      source: targetFromSubjectText(aggregateMatch.groups.selector, tags),
      stat,
      aggregate: "sum"
    };
    const factor = multiplierFromWords(value);
    return factor ? { kind: "scale", factor, value: aggregate } : aggregate;
  }

  const statMatch = value.match(/\b(?<source>this item'?s|this|its|that item'?s|that food'?s|that food|that|your|enemy'?s|an enemy'?s|adjacent items?|the item to the left|the item to the right|the property to the left)?\s*(?<stat>value|damage|shield|crit(?: chance)?|burn|poison|regen|ammo|max ammo|cooldown|max health|health|income|gold|rage)\b/i);
  if (statMatch?.groups?.stat) {
    const stat = statFromText(statMatch.groups.stat);
    if (stat) {
      const source = attributeSourceFromText(statMatch.groups.source || value, tags);
      const reference: ValueExpr = { kind: "stat", source, stat };
      const factor = multiplierFromWords(value);
      return factor ? { kind: "scale", factor, value: reference } : reference;
    }
  }

  const factor = multiplierFromWords(value);
  if (factor && fixedAmount) {
    return { kind: "scale", factor, value: fixedAmount };
  }
  return fixedAmount;
}

function tagNames(tags: TagLike[]): string[] {
  return tags
    .map((tag) => (typeof tag === "string" ? tag : tag.name))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

function knownTypeFromText(text: string, tags: TagLike[]): ItemType | undefined {
  const value = lower(text);
  const candidates = [...KNOWN_ITEM_TYPES, ...tagNames(tags).map((tag) => slugify(tag))];
  for (const candidate of candidates) {
    const words = candidate.replace(/-/g, "[ -]");
    if (new RegExp(`\\b${words}s?\\b`, "i").test(value)) {
      return candidate as ItemType;
    }
  }
  return undefined;
}

function knownTypesFromText(text: string, tags: TagLike[]): ItemType[] {
  const value = lower(text);
  const candidates = [...KNOWN_ITEM_TYPES, ...tagNames(tags).map((tag) => slugify(tag))];
  const matches: ItemType[] = [];
  for (const candidate of candidates) {
    const words = candidate.replace(/-/g, "[ -]");
    if (new RegExp(`\\b${words}s?\\b`, "i").test(value)) {
      matches.push(candidate as ItemType);
    }
  }
  return [...new Set(matches)];
}

function mechanicFromText(text: string): MechanicKeyword | undefined {
  const value = lower(text);
  for (const mechanic of MECHANICS) {
    if (new RegExp(`\\b${mechanic}\\b`, "i").test(value)) {
      return mechanic;
    }
  }
  return undefined;
}

function statFromMechanic(mechanic: MechanicKeyword | undefined): StatRef | undefined {
  switch (mechanic) {
    case "damage":
      return { domain: "card", id: "damageAmount" };
    case "burn":
      return { domain: "card", id: "burnAmount" };
    case "poison":
      return { domain: "card", id: "poisonAmount" };
    case "shield":
      return { domain: "card", id: "shieldAmount" };
    case "heal":
      return { domain: "card", id: "healAmount" };
    case "regen":
      return { domain: "card", id: "regenAmount" };
    case "cooldown":
      return { domain: "card", id: "cooldownSeconds" };
    case "crit":
      return { domain: "card", id: "critChance" };
    case "multicast":
      return { domain: "card", id: "multicast" };
    case "charge":
      return { domain: "effect", id: "chargeSeconds" };
    default:
      return undefined;
  }
}

function mechanicFromStatRef(stat: StatRef | undefined): MechanicKeyword | undefined {
  switch (stat?.id) {
    case "damageAmount":
      return "damage";
    case "burnAmount":
      return "burn";
    case "poisonAmount":
      return "poison";
    case "shieldAmount":
      return "shield";
    case "healAmount":
      return "heal";
    case "regenAmount":
      return "regen";
    case "cooldownSeconds":
    case "cooldownReduction":
      return "cooldown";
    case "critChance":
      return "crit";
    case "multicast":
      return "multicast";
    case "rageGain":
      return "rage";
    case "chargeSeconds":
      return "charge";
    default:
      return undefined;
  }
}

function statFromText(text: string): StatRef | undefined {
  const value = lower(text);
  if (/\bcrit\s+damage\b/.test(value)) return { domain: "card", id: "critDamage" };
  if (/\bcrit(?:%|\s+chance)?\b/.test(value)) return { domain: "card", id: "critChance" };
  if (/\bmax\s+ammo\b/.test(value)) return { domain: "card", id: "ammo" };
  if (/\bammo\b/.test(value)) return { domain: "card", id: "ammo" };
  if (/\brerolls?\b|\breroll\s+cost\b/.test(value)) return { domain: "player", id: "rerollCost" };
  if (/\bsell\s+price\b|\bsell\s+value\b|\bsell\s+items?\s+for\b|\bmerchants?\s+buy\b/.test(value)) return { domain: "card", id: "sellPrice" };
  if (/\bbuy\s+price\b|\bsell\s+items?\b|\bmerchants?\s+sell\b/.test(value)) return { domain: "card", id: "buyPrice" };
  if (/\bgold\b/.test(value)) return { domain: "player", id: "gold" };
  if (/\bincome\b/.test(value)) return { domain: "player", id: "income" };
  if (/\bprestige\b/.test(value)) return { domain: "player", id: "prestige" };
  if (/\bxp\b|\bexperience\b/.test(value)) return { domain: "player", id: "experience" };
  if (/\bmax\s+health\b/.test(value)) return { domain: "player", id: "maxHealth" };
  if (/\bhealth\b/.test(value)) return { domain: "player", id: "health" };
  if (/\bvalue\b/.test(value)) return { domain: "card", id: "value" };
  if (/\brage\b.*\b(?:need|require|requirement)\b|\bneed\b.*\brage\b/.test(value)) return { domain: "player", id: "rageRequirement" };
  if (/\brage\b/.test(value)) return { domain: "player", id: "rageGain" };
  return statFromMechanic(mechanicFromText(text));
}

function statusFromText(text: string): StatusFlag | undefined {
  for (const [pattern, status] of STATUS_ALIASES) {
    if (pattern.test(text)) return status;
  }
  return undefined;
}

function statusFromStateText(text: string): StatusFlag | undefined {
  if (/\bflying\b/i.test(text)) return "flying";
  if (/\blifesteal\b/i.test(text)) return "lifesteal_enabled";
  return statusFromText(text);
}

function statusDurationStatusFromText(text: string): StatusFlag | undefined {
  const value = lower(text).trim();
  if (value === "freeze" || value === "frozen") return "freeze";
  if (value === "slow" || value === "slowed") return "slow";
  if (value === "enrage" || value === "enraged") return "enraged";
  return statusFromStateText(value);
}

function boolExprForPredicates(predicates: EntityPredicate[], op: "and" | "or" = "or"): BoolExpr<EntityPredicate> | undefined {
  const unique = predicates.filter(
    (predicate, index, all) => all.findIndex((entry) => JSON.stringify(entry) === JSON.stringify(predicate)) === index
  );
  if (unique.length === 0) return undefined;
  if (unique.length === 1) return atom(unique[0]);
  return { op, exprs: unique.map(atom) };
}

function predicatesFromFilter(text: string, tags: TagLike[]): BoolExpr<EntityPredicate> | undefined {
  const negativePredicates = [...text.matchAll(/\bnon-([a-z-]+)\b/gi)]
    .map((match) => predicateFromToken(match[1], tags))
    .filter((predicate): predicate is EntityPredicate => Boolean(predicate));
  const positiveText = text.replace(/\bnon-[a-z-]+\b/gi, " ");
  const predicates: EntityPredicate[] = [];
  for (const type of knownTypesFromText(positiveText, tags).filter((type) => type !== "item")) {
    predicates.push(itemTypePredicate(type));
  }
  for (const mechanic of MECHANICS) {
    if (mechanic !== "cooldown" && new RegExp(`\\b${mechanic}\\b`, "i").test(positiveText)) {
      predicates.push(mechanicPredicate(mechanic));
    }
  }
  for (const [pattern, status] of STATUS_ALIASES) {
    if (pattern.test(positiveText)) predicates.push(statusPredicate(status));
  }
  const size = positiveText.match(/\b(small|medium|large)\b/i)?.[1]?.toLowerCase() as "small" | "medium" | "large" | undefined;
  if (size) predicates.push({ kind: "has_size", size });
  const positiveExpr = boolExprForPredicates(predicates);
  const negativeExpr = boolExprForPredicates(negativePredicates);
  if (positiveExpr && negativeExpr) return { op: "and", exprs: [positiveExpr, not(negativeExpr)] };
  if (negativeExpr) return not(negativeExpr);
  return positiveExpr;
}

function targetFromSubjectText(subjectText: string, tags: TagLike[]): EntitySelector {
  const value = lower(subjectText);
  const actionSubject = value.replace(/^while\s+.+?,\s*/i, "").replace(/^if\s+.+?,\s*/i, "");
  if (/\bthat item\b|\bit\b/.test(value)) {
    return itemSelector({ quantifier: "self", bindAs: "trigger_source" });
  }
  const excludeSelf = /\bother\b|\banother\b/.test(actionSubject);
  const owner: Owner = /\bboth players?\b|\beach player\b/.test(actionSubject)
    ? "any"
    : /\benemy\b|\bopponent\b/.test(actionSubject)
      ? "enemy"
      : "self";
  const position: PositionSelector | undefined = /\badjacent\b/.test(actionSubject)
    ? "adjacent"
    : /\bleftmost\b/.test(actionSubject)
      ? "leftmost"
      : /\brightmost\b/.test(actionSubject)
        ? "rightmost"
        : /\bto the left\b|\bleft\b/.test(actionSubject)
          ? "left"
          : /\bto the right\b|\bright\b/.test(actionSubject)
            ? "right"
            : undefined;
  const quantifier: EntitySelector["quantifier"] = /\bthis\b/.test(actionSubject)
    ? "self"
    : /\ball\b|\byour\b.*\bitems\b|\bitems\b/.test(actionSubject)
      ? "all"
      : /\bone\b|\ban?\b|\banother\b|\b\d+\b/.test(actionSubject)
        ? "one"
        : undefined;
  return itemSelector({ owner, quantifier, position, predicates: predicatesFromFilter(actionSubject, tags), excludeSelf });
}

function statMultiplierFactorFromText(text: string): number | undefined {
  const value = lower(text);
  if (/\bquadruple\b/.test(value)) return 4;
  return multiplierFromWords(text);
}

function parseStatMultiplierAction(actionText: string, tags: TagLike[]): SemanticAction | null {
  const normalizedText = actionText.replace(/[.。]+$/g, "").trim();
  const statPattern = "crit\\s+damage|crit\\s+chance|damage|shield|max\\s+health|health|value|rage\\s+gain|charge|cooldown|burn|poison|heal|regen";
  const ofMatch = normalizedText.match(new RegExp(`^(?<multiplier>double|twice|triple|quadruple)\\s+(?:the\\s+)?(?<stat>${statPattern})\\s+of\\s+(?<target>.+?)(?:\\s+(?:during|in)\\s+combat)?$`, "i"));
  const subjectMatch =
    normalizedText.match(new RegExp(`^(?<target>.+?)\\s+(?:has|have|deals?|deal)\\s+(?<multiplier>double|twice|triple|quadruple)\\s+(?<stat>${statPattern})(?:\\s+(?:bonus|gain))?(?:\\s+(?:during|in)\\s+combat)?$`, "i")) ??
    normalizedText.match(new RegExp(`^(?<multiplier>double|twice|triple|quadruple)\\s+(?<target>your|this(?:\\s+item)?'?s|this|its|enemy'?s|an\\s+enemy'?s)\\s+(?<stat>max\\s+health|health|damage|shield|value|rage\\s+gain|charge|cooldown|burn|poison|heal|regen)(?:\\s+(?:bonus|gain))?(?:\\s+(?:during|in)\\s+combat)?$`, "i"));
  const match = ofMatch ?? subjectMatch;
  if (!match?.groups?.stat || !match.groups.target || !match.groups.multiplier) {
    return null;
  }

  const stat = statFromText(match.groups.stat);
  const factor = statMultiplierFactorFromText(match.groups.multiplier);
  if (!stat || !factor) {
    return null;
  }

  const targetText = match.groups.target.trim() || "this";
  const target = stat.domain === "player" || /health|rage/i.test(match.groups.stat)
    ? playerSelector(ownerFromText(targetText))
    : targetFromSubjectText(
        stat.id === "ammo"
          ? targetText.replace(/\bammo\b/gi, " ").replace(/\s+/g, " ").trim() || targetText
          : targetText,
        tags
      );
  return {
    type: "modify_stat",
    target,
    stat,
    op: "multiply",
    amount: fixed(factor),
    duration: /\bcombat\b/i.test(normalizedText) ? { kind: "for_fight" } : { kind: "while_source_active" }
  };
}

function targetFromDurationSubjectText(subjectText: string, tags: TagLike[]): EntitySelector {
  const selector = targetFromSubjectText(subjectText, tags);
  const predicates = targetPredicateExprFromList(subjectText, tags) ?? selector.predicates;
  return predicates ? { ...selector, predicates } : selector;
}

function targetFromStatusAssignmentText(actionText: string, status: StatusFlag, tags: TagLike[]): EntitySelector {
  const selector = targetFromSubjectText(actionText, tags);
  if (/\bstops?|stop|remove\b/i.test(actionText)) {
    return selector;
  }

  const removeAssignedStatus = (expr: BoolExpr<EntityPredicate> | undefined): BoolExpr<EntityPredicate> | undefined => {
    if (!expr) return undefined;
    if (expr.op === "atom") {
      const predicate = expr.atom;
      const isAssignedStatus =
        (predicate.kind === "has_status" && predicate.status === status) ||
        (predicate.kind === "has_mechanic" && predicate.mechanic === status) ||
        (predicate.kind === "has_item_type" && predicate.type === status);
      return isAssignedStatus ? undefined : expr;
    }
    if (expr.op === "not") return expr;
    const exprs = expr.exprs.map(removeAssignedStatus).filter((item): item is BoolExpr<EntityPredicate> => Boolean(item));
    if (exprs.length === 0) return undefined;
    return exprs.length === 1 ? exprs[0] : { ...expr, exprs };
  };

  const predicates = removeAssignedStatus(selector.predicates);
  return predicates ? { ...selector, predicates } : { ...selector, predicates: undefined };
}

function itemSelectorFromDescription(description: string, tags: TagLike[]): EntitySelector {
  const value = lower(description);
  const owner: Owner = /\benemy\b|\bopponent\b/.test(value) ? "enemy" : "self";
  const quantifier: EntitySelector["quantifier"] = /\brandom\b/.test(value)
    ? "random"
    : /\ball\b/.test(value)
      ? "all"
      : /\ban?\b|\bone\b|\b\d+\b/.test(value)
        ? "one"
        : undefined;
  const zone: EntitySelector["zone"] = /\bstash\b/.test(value) ? "stash" : /\bshop|merchant\b/.test(value) ? "shop" : "board";
  const position: PositionSelector | undefined = /\bleftmost\b/.test(value)
    ? "leftmost"
    : /\brightmost\b/.test(value)
      ? "rightmost"
      : /\bto the left\b|\bleft\b/.test(value)
        ? "left"
        : /\bto the right\b|\bright\b/.test(value)
          ? "right"
          : /\badjacent\b/.test(value)
            ? "adjacent"
            : undefined;
  return itemSelector({ owner, zone, quantifier, position, predicates: predicatesFromFilter(description, tags) });
}

function normalizeConditionalPrefix(text: string): string {
  const trimmed = text.trim();
  if (/^(?:already has|are a|have a|won the fight)\b/i.test(trimmed)) return `if you ${trimmed}`;
  if (/^[A-Z][a-z]+ or [A-Z][a-z]+,\s+/i.test(trimmed)) return `when you use a ${trimmed}`;
  return trimmed;
}

function parseItemLifecycleAction(actionText: string, tags: TagLike[]): SemanticAction | null {
  const bareTransformMatch = actionText.match(/\btransform\s+(?<target>this|it|your .+?|the .+?|an? .+?)$/i);
  if (bareTransformMatch?.groups?.target) {
    return {
      type: "transform_item",
      target: targetFromSubjectText(bareTransformMatch.groups.target, tags),
      description: "unspecified transformation"
    };
  }

  const getMatch = actionText.match(/\b(?:get|gain|learn|recover)\s+(?<description>.+)$/i);
  if (getMatch?.groups?.description && /^a chunk of gold$/i.test(getMatch.groups.description.trim())) {
    return {
      type: "modify_stat",
      target: playerSelector("self"),
      stat: { domain: "player", id: "gold" },
      op: "add",
      amount: { kind: "identifier", value: getMatch.groups.description.trim() }
    };
  }
  if (getMatch?.groups?.description && /\b(?:rage|burn|poison|shield|heal|regen|damage|crit|haste|slow|freeze|charge)\s+item\b/i.test(getMatch.groups.description)) {
    return {
      type: "gain_item",
      item: itemSelectorFromDescription(getMatch.groups.description, tags),
      amount: amountFromText(getMatch.groups.description, "count"),
      description: getMatch.groups.description.trim()
    };
  }
  if (getMatch?.groups?.description && !/\b(?:gold|prestige|xp|experience|rage|health|shield|heal|regen)\b/i.test(getMatch.groups.description)) {
    if (/chunk of gold/i.test(getMatch.groups.description)) {
      return {
        type: "modify_stat",
        target: playerSelector("self"),
        stat: { domain: "player", id: "gold" },
        op: "add",
        amount: { kind: "identifier", value: getMatch.groups.description.trim() }
      };
    }
    return {
      type: "gain_item",
      item: itemSelectorFromDescription(getMatch.groups.description, tags),
      amount: amountFromText(getMatch.groups.description, "count"),
      description: getMatch.groups.description.trim()
    };
  }

  const transformMatch = actionText.match(/\btransform(?:\s+(?<target>this|it|your .+?|the .+?|another .+?|an? .+?))?\s+(?:into|to)\s+(?<description>.+)$/i);
  if (transformMatch?.groups?.description) {
    return {
      type: "transform_item",
      target: targetFromSubjectText(transformMatch.groups.target ?? "this", tags),
      into: itemSelectorFromDescription(transformMatch.groups.description, tags),
      amount: amountFromText(transformMatch.groups.description, "count"),
      description: transformMatch.groups.description.trim()
    };
  }

  const enchantMatch = actionText.match(/\benchant\s+(?<target>.+?)(?:\s+with\s+(?<enchantment>[a-z -]+?))?(?:\s+if able)?$/i);
  if (enchantMatch?.groups?.target) {
    return {
      type: "enchant_item",
      target: targetFromSubjectText(enchantMatch.groups.target, tags),
      ...(enchantMatch.groups.enchantment ? { enchantment: enchantMatch.groups.enchantment.trim() } : {})
    };
  }

  const upgradeMatch = actionText.match(/\bupgrade\s+(?<target>.+)$/i);
  if (upgradeMatch?.groups?.target) {
    return { type: "upgrade_item", target: targetFromSubjectText(upgradeMatch.groups.target, tags) };
  }

  return null;
}

function predicateFromToken(token: string, tags: TagLike[]): EntityPredicate | undefined {
  const normalized = lower(token).replace(/^non-/, "").trim();
  if (normalized === "small" || normalized === "medium" || normalized === "large") {
    return { kind: "has_size", size: normalized };
  }
  for (const [pattern, status] of STATUS_ALIASES) {
    if (pattern.test(normalized)) {
      return statusPredicate(status);
    }
  }
  const mechanic = mechanicFromText(normalized);
  if (mechanic && mechanic !== "cooldown") {
    return mechanicPredicate(mechanic);
  }
  const type = knownTypeFromText(normalized, tags);
  return type ? itemTypePredicate(type) : undefined;
}

function predicateExprFromList(text: string, tags: TagLike[]): BoolExpr<EntityPredicate> | undefined {
  const segment = text
    .replace(/\b(items?|cards?|skills?|effects?)\b/gi, " ")
    .replace(/\b(your|enemy|all|other|another|a|an|the|this|that|with|of|to|for)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!segment) {
    return undefined;
  }

  const nonParts = [...segment.matchAll(/\bnon-([a-z-]+)\b/gi)]
    .map((match) => predicateFromToken(match[1], tags))
    .filter((predicate): predicate is EntityPredicate => Boolean(predicate));
  if (nonParts.length > 1) {
    return not({ op: "or", exprs: nonParts.map(atom) });
  }

  const separator = /\s+or\s+/i.test(segment) ? "or" : /\s+and\s+/i.test(segment) ? "and" : undefined;
  const parts = separator ? segment.split(new RegExp(`\\s+${separator}\\s+`, "i")) : [segment];
  const exprs = parts
    .map((part) => {
      const trimmed = part.trim();
      const predicate = predicateFromToken(trimmed, tags);
      if (!predicate) {
        return undefined;
      }
      const base = atom(predicate);
      return /^non-/i.test(trimmed) ? not(base) : base;
    })
    .filter((expr): expr is BoolExpr<EntityPredicate> => Boolean(expr));

  if (exprs.length === 0) {
    return undefined;
  }
  return exprs.length === 1 ? exprs[0] : { op: separator ?? "and", exprs };
}

function targetPredicateExprFromList(text: string, tags: TagLike[]): BoolExpr<EntityPredicate> | undefined {
  const expr = predicateExprFromList(text, tags);
  if (!expr || !/\s+and\s+/i.test(text) || /\s+or\s+/i.test(text)) {
    return expr;
  }

  if (expr.op === "and" && expr.exprs.every((part) => part.op === "atom")) {
    return { op: "or", exprs: expr.exprs };
  }

  return expr;
}

function itemSelector(
  options: {
    owner?: Owner;
    zone?: EntitySelector["zone"];
    quantifier?: EntitySelector["quantifier"];
    predicates?: BoolExpr<EntityPredicate>;
    position?: PositionSelector;
    bindAs?: string;
    excludeSelf?: boolean;
  } = {}
): EntitySelector {
  return {
    entity: "item",
    owner: options.owner ?? "self",
    zone: options.zone ?? "board",
    ...(options.quantifier ? { quantifier: options.quantifier } : {}),
    ...(options.position ? { position: options.position } : {}),
    ...(options.predicates ? { predicates: options.predicates } : {}),
    ...(options.bindAs ? { bindAs: options.bindAs } : {}),
    ...(options.excludeSelf ? { excludeSelf: true } : {})
  };
}

function playerSelector(owner: Owner = "self"): EntitySelector {
  return { entity: "player", owner };
}

function merchantSelector(owner: Owner = "any"): EntitySelector {
  return { entity: "merchant", owner, zone: "shop" };
}

function splitSemanticTexts(texts: string[]): string[] {
  return texts.flatMap((text) =>
    text
      .split(/\s*\.\s+(?=When|If|While|The first|Your|This|All|One of|You)\b/g)
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

function normalizeClauseText(text: string): string {
  return text.replace(/\s+/g, " ").replace(/[.。]+$/g, "").trim();
}

function withClauseText(clause: SemanticClause, text: string): SemanticClause {
  return {
    ...clause,
    sourceText: text,
    normalizedText: normalizeClauseText(text)
  };
}

function parseSemanticStatusGate(text: string): { status: StatusFlag; actionText: string } | null {
  const match = text.match(/^(?<status>heated|chilled|frozen|slowed|hasted|enraged):\s*(?<action>.+)$/i);
  if (!match?.groups?.status || !match.groups.action) return null;
  return {
    status: lower(match.groups.status) as StatusFlag,
    actionText: match.groups.action.trim()
  };
}

function withStatusGate(clause: SemanticClause, status: StatusFlag): SemanticClause {
  const condition = semanticAtom({ domain: "entity", predicate: statusPredicate(status) });
  return {
    ...clause,
    condition: clause.condition ? { op: "and", exprs: [condition, clause.condition] } : condition,
    duration: clause.duration ?? { kind: "while_condition", condition, reversible: true }
  };
}

function parseSlotTerrain(text: string, index: number): SemanticClause | null {
  const match = text.match(/\bone of your slots becomes a (?<terrain>stove|cooler)\b.*\bitem here is (?<status>heated|chilled)\b/i);
  if (!match?.groups?.terrain || !match.groups.status) {
    return null;
  }

  const terrain = lower(match.groups.terrain);
  const status = lower(match.groups.status) as StatusFlag;
  const linkedClause: SemanticClause = {
    id: `c_${index}_occupant_${status}`,
    kind: "aura",
    condition: semanticAtom({ domain: "entity", predicate: { kind: "slot_occupied_by_item" } }),
    actions: [
      {
        node: "atomic",
        action: {
          type: "modify_status",
          target: itemSelector({ owner: "self", zone: "slot", position: "occupant_of_source_slot" }),
          status,
          op: "add",
          duration: {
            kind: "while_condition",
            condition: semanticAtom({ domain: "entity", predicate: { kind: "item_in_source_slot" } }),
            reversible: true
          }
        }
      }
    ],
    confidence: "high"
  };

  return {
    id: `c_${index}_slot_${terrain}`,
    kind: "declarative",
    actions: [
      {
        node: "atomic",
        action: {
          type: "modify_slot",
          target: { entity: "slot", owner: "self", zone: "board", quantifier: "one" },
          op: "set_terrain",
          terrain,
          linkedEffects: [linkedClause]
        }
      }
    ],
    confidence: "high"
  };
}

function parseEffectModifier(text: string, index: number): SemanticClause | null {
  if (!/\ball charge effects are reduced by half\b/i.test(text)) {
    return null;
  }

  return {
    id: `c_${index}_charge_effect_modifier`,
    kind: "modifier",
    activeIn: ["combat"],
    actions: [
      {
        node: "atomic",
        action: {
          type: "modify_effect",
          target: {
            entity: "effect_template",
            owner: "any",
            predicates: atom({ kind: "has_mechanic", mechanic: "charge" })
          },
          transform: { kind: "scale", field: "chargeSeconds", factor: 0.5, rounding: "unknown" }
        }
      }
    ],
    confidence: "high",
    warnings: [warning("ROUNDING_UNKNOWN", "Tooltip says Charge effects are reduced by half but does not state rounding behavior.", "info", text)]
  };
}

function parseStatusDurationActions(text: string, tags: TagLike[]): SemanticAction[] | null {
  const normalizedText = text.replace(/[.。]+$/g, "").trim();
  const explicitDeltaMatch = normalizedText.match(/^you are (?<status>enraged|hasted|slowed|frozen|chilled|heated) for (?<duration>[-+]?\d+(?:\.\d+)?)\s+second(?:\(s\))?s?\s+(?<direction>longer|shorter)$/i);
  if (explicitDeltaMatch?.groups?.status && explicitDeltaMatch.groups.duration && explicitDeltaMatch.groups.direction) {
    const status = statusDurationStatusFromText(explicitDeltaMatch.groups.status) ?? (lower(explicitDeltaMatch.groups.status) as StatusFlag);
    const op = explicitDeltaMatch.groups.direction.toLowerCase() === "longer" ? "add" : "subtract";
    return [
      {
        type: "modify_status_duration",
        target: playerSelector("self"),
        status,
        op,
        amount: fixed(Number(explicitDeltaMatch.groups.duration), "seconds")
      }
    ];
  }

  if (/^your enrage lasts half as long$/i.test(normalizedText)) {
    return [
      {
        type: "modify_status_duration",
        target: playerSelector("self"),
        status: "enraged",
        op: "multiply",
        amount: fixed(0.5)
      }
    ];
  }

  const affectedMatch = normalizedText.match(/^(?:(?<target>.+?)\s+)?(?:is|are)\s+affected by (?<statuses>freeze(?:\s+and\s+slow)?|slow(?:\s+and\s+freeze)?)(?:\s+for)?\s+half as long(?:\s+instead)?$/i);
  if (!affectedMatch?.groups?.statuses) {
    return null;
  }

  const targetText = affectedMatch.groups.target?.trim() || "this";
  if (/\b(?:has|have|gain|gains|gets?|deal|deals|apply|applies)\b/i.test(targetText)) {
    return null;
  }

  const target = targetFromDurationSubjectText(targetText, tags);
  const statuses = affectedMatch.groups.statuses
    .split(/\s+and\s+/i)
    .map((statusText) => statusDurationStatusFromText(statusText) ?? (lower(statusText) as StatusFlag));
  return statuses.map((status) => ({
    type: "modify_status_duration",
    target,
    status,
    op: "multiply",
    amount: fixed(0.5)
  }));
}

function parseStatusDurationModifier(text: string, index: number, tags: TagLike[]): SemanticClause | null {
  const actions = parseStatusDurationActions(text, tags);
  if (!actions) {
    return null;
  }

  return {
    id: `c_${index}_status_duration_modifier`,
    kind: /^you are\b/i.test(text.trim()) ? "modifier" : "aura",
    activeIn: ["combat"],
    actions: actions.length === 1
      ? [{ node: "atomic", action: actions[0] }]
      : [{ node: "parallel", actions: actions.map((action) => ({ node: "atomic", action })) }],
    confidence: /\binstead\b/i.test(text) ? "medium" : "high",
    ...(/\binstead\b/i.test(text)
      ? { warnings: [warning("UNSUPPORTED_PROJECTION", "Tooltip uses 'instead'; semantic IR captures the status duration modifier but not replacement ordering.", "info", text)] }
      : {})
  };
}

function parsePlayerFaction(text: string, index: number): SemanticClause | null {
  const match = text.match(/^you have joined the (?<faction>[a-z][a-z -]*)$/i);
  if (!match?.groups?.faction) {
    return null;
  }

  const faction = match.groups.faction.trim().replace(/\s+/g, " ");
  return {
    id: `c_${index}_joined_${slugify(faction)}`,
    kind: "declarative",
    actions: [
      {
        node: "atomic",
        action: {
          type: "add_player_state",
          target: playerSelector("self"),
          state: `FactionMembership:${faction}`
        }
      }
    ],
    confidence: "high"
  };
}

function triggerFromFirstEvent(eventText: string, tags: TagLike[]): EventPattern {
  const value = lower(eventText);
  const owner: Owner = /\benemy\b|\bopponent\b/.test(value) ? "enemy" : "self";
  const actor = playerSelector(owner);

  if (/\buse\b|\buses\b/.test(value)) {
    const usedMatch = eventText.match(/\buses?\s+(?<selector>.+)$/i);
    const rawSelectorText = usedMatch?.groups?.selector ?? eventText;
    const selectorText = rawSelectorText.replace(/\bof\s+the\s+same\s+or\s+lower\s+tier\s+as\s+this\b/gi, " ").trim();
    const basePredicate = predicateExprFromList(selectorText, tags);
    const tierPredicate = hasSameOrLowerTierComparison(rawSelectorText)
      ? atom<EntityPredicate>({ kind: "tier_compare", cmp: "lte", reference: itemSelector({ quantifier: "self" }) })
      : undefined;
    const predicates = basePredicate && tierPredicate
      ? { op: "and" as const, exprs: [basePredicate, tierPredicate] }
      : basePredicate ?? tierPredicate;
    return {
      event: "item_used",
      actor,
      subject: itemSelector({ owner, predicates }),
      sourceEventText: eventText
    };
  }
  if (/\bcrit\b/.test(value)) {
    return { event: "crit", actor, sourceEventText: eventText };
  }
  if (/\bdestroyed\b|\bdestroys?\b/.test(value)) {
    return {
      event: "item_destroyed",
      actor,
      subject: targetFromSubjectText(eventText, tags),
      sourceEventText: eventText
    };
  }
  if (/\bburn\b|\bpoison\b|\bhaste\b|\bslow\b|\bfreeze\b|\bshield\b|\bheal\b|\bregen\b/.test(value)) {
    const mechanic = mechanicFromText(eventText);
    return {
      event: "effect_applied",
      actor,
      object: mechanic ? { entity: "event", predicates: atom(mechanicPredicate(mechanic)) } : undefined,
      sourceEventText: eventText
    };
  }
  if (/\bfall below half health\b/.test(value)) {
    return {
      event: "health_threshold_crossed",
      actor,
      sourceEventText: eventText,
      threshold: {
        attribute: { domain: "player", id: "health" },
        value: {
          kind: "scale",
          factor: 0.5,
          value: {
            kind: "stat",
            source: playerSelector(owner),
            stat: { domain: "player", id: "maxHealth" }
          }
        },
        crossing: "from_at_or_above_to_below"
      }
    };
  }

  return { event: "effect_applied", actor, sourceEventText: eventText };
}

function targetFromActionText(actionText: string, tags: TagLike[], defaultOwner: Owner = "self"): EntitySelector {
  const value = lower(actionText);
  const excludeSelf = /\b(?:other|another)\b/.test(value);
  if (/\bthis(?: item)?\b/.test(value) && !excludeSelf) return itemSelector({ quantifier: "self" });
  if (/\bthat item\b|\bit\b/.test(value)) return itemSelector({ quantifier: "self", bindAs: "trigger_source" });
  const owner: Owner = /\bboth players?\b|\beach player\b/.test(value)
    ? "any"
    : /\ball\s+other\s+items?\b|\ball\s+items?\b/.test(value)
      ? "any"
    : /\benemy\b|\bopponent\b|\btheir items?\b/.test(value)
      ? "enemy"
      : /\byour\b|\bthis\b|\bself\b/.test(value)
        ? "self"
        : defaultOwner;
  const quantifier: EntitySelector["quantifier"] =
    /\ball\b|\byour\b.*\bitems\b|\bother\s+items?\b/.test(value) ? "all" : /\brandom\b/.test(value) ? "random" : /\ban?\b/.test(value) ? "one" : undefined;
  const position: PositionSelector | undefined = /\badjacent\b/.test(value)
    ? "adjacent"
    : /\bleftmost\b/.test(value)
      ? "leftmost"
      : /\brightmost\b/.test(value)
        ? "rightmost"
        : undefined;

  const boardTargetMatch = actionText.match(/\b(?:charge|haste|slow|freeze|reload|repair|destroy|use)\s+(?<target>.+?\bon\s+each\s+player'?s\s+board)(?:\s+for\s+|[-+]?\d|$)/i);
  if (boardTargetMatch?.groups?.target) {
    return itemSelector({ owner, zone: "board", quantifier, position, predicates: predicateExprFromList(boardTargetMatch.groups.target, tags), excludeSelf });
  }

  const selectorMatch =
    actionText.match(/\b(?:charge|haste|slow|freeze|reload|repair|destroy|use)\s+(?:your|a|an|all|other|another|random)?\s*(?<selector>.+?)\s+(?:for\s+|[-+]?\d|$)/i) ??
    actionText.match(/\b(?:your|a|an|all|other|another|random)\s+(?<selector>.+?)\s+(?:for\s+|[-+]?\d|$)/i) ??
    actionText.match(/\b(?<selector>non-[a-z -]+|[a-z -]+)\s+items?\b/i);
  const predicates = selectorMatch?.groups?.selector ? targetPredicateExprFromList(selectorMatch.groups.selector, tags) : undefined;

  return itemSelector({ owner, quantifier, position, predicates, excludeSelf });
}

function playerEffectTarget(mechanic: MechanicKeyword, actionText: string): EntitySelector {
  if (mechanic === "shield" || mechanic === "heal" || mechanic === "regen") {
    return playerSelector("self");
  }
  if (/\byourself\b|\byou\b/i.test(actionText)) {
    return playerSelector("self");
  }
  if (/\bboth players?\b|\beach player\b/i.test(actionText)) {
    return playerSelector("any");
  }
  if (/\benemy\b|\bopponent\b/i.test(actionText)) {
    return playerSelector("enemy");
  }
  return playerSelector(mechanic === "damage" || mechanic === "burn" || mechanic === "poison" ? "enemy" : "self");
}

function parseStatusRemovalActions(actionText: string, tags: TagLike[]): SemanticAction[] {
  const match = actionText.match(/^(?:cleanse\s+half\s+your|remove)\s+(?<statuses>burn|poison|freeze|slow|burn and poison|freeze and slow)(?:\s+from\s+(?<target>.+?))?$/i);
  if (!match?.groups?.statuses) {
    return [];
  }

  const statuses = match.groups.statuses.split(/\s+and\s+/i).map((statusText) => statusFromStateText(statusText) ?? (lower(statusText) as StatusFlag));
  const target = match.groups.target ? targetFromSubjectText(match.groups.target, tags) : playerSelector("self");
  return statuses.map((status) => ({ type: "modify_status", target, status, op: "remove" }));
}

function parseActionNodes(actionText: string, tags: TagLike[]): ActionNode[] {
  const compound = splitSemanticActionText(actionText);
  if (compound.length > 1) {
    return [{ node: "parallel", actions: compound.flatMap((part) => parseActionNodes(part, tags)).flatMap(flattenActionNodes) }];
  }
  const statusDuration = parseStatusDurationActions(actionText, tags);
  if (statusDuration) {
    return statusDuration.length === 1
      ? [{ node: "atomic", action: statusDuration[0] }]
      : [{ node: "parallel", actions: statusDuration.map((action) => ({ node: "atomic", action })) }];
  }
  const statusRemoval = parseStatusRemovalActions(actionText, tags);
  if (statusRemoval.length > 1) {
    return [{ node: "parallel", actions: statusRemoval.map((action) => ({ node: "atomic", action })) }];
  }
  if (statusRemoval.length === 1) {
    return [{ node: "atomic", action: statusRemoval[0] }];
  }
  return [{ node: "atomic", action: parseApplyAction(actionText, tags) }];
}

function splitSemanticActionText(actionText: string): string[] {
  const multiplierParts = splitStatMultiplierCompoundAction(actionText);
  if (multiplierParts) {
    return multiplierParts;
  }

  const separators = [...actionText.matchAll(/\s+and\s+/gi)];
  if (separators.length === 0) {
    return [actionText];
  }

  const parts: string[] = [];
  let start = 0;
  for (const separator of separators) {
    const index = separator.index ?? -1;
    if (index < 0) continue;
    const before = actionText.slice(start, index).trim();
    const afterStart = index + separator[0].length;
    const after = actionText.slice(afterStart).trim();
    if (/(?:cleanse\s+half\s+your|remove)\s+(?:burn|poison|freeze|slow)$/i.test(before) && /^(?:burn|poison|freeze|slow)\b/i.test(after)) {
      continue;
    }
    if (/\baffected by\s+(?:freeze|slow)$/i.test(before) && /^(?:freeze|slow)\b/i.test(after)) {
      continue;
    }
    if (!before || !/^(?:cleanse|remove|heal|shield|regen|deal|damage|charge|haste|slow|freeze|reload|destroy|use|gain|this\s+gains|you\s+gain|your\s+.+\s+(?:gain|have|has)|(?:is|are)\s+affected by|(?:it|this|they|your|adjacent|all)\b.*\b(?:is|are)\s+affected by)\b/i.test(after)) {
      continue;
    }
    parts.push(before);
    start = afterStart;
  }

  parts.push(actionText.slice(start).trim());
  return parts.filter(Boolean);
}

function splitStatMultiplierCompoundAction(actionText: string): string[] | null {
  if (!/\s+and\s+|,/.test(actionText) || !/\b(?:double|twice|triple|quadruple)\b/i.test(actionText)) {
    return null;
  }

  const statWords = "crit\\s+damage|crit\\s+chance|damage|shield|max\\s+health|health|value|rage\\s+gain|charge|cooldown|burn|poison|heal|regen|ammo(?:\\s+max\\s+ammo)?|max\\s+ammo";
  const match = actionText.match(new RegExp(`^(?<prefix>.+?\\b(?:has|have|deals?|deal)\\s+)(?<multiplier>double|twice|triple|quadruple)\\s+(?<first>${statWords})(?<firstSuffix>\\s+(?:gain|bonus))?\\s+(?:and|,)\\s+(?<rest>.+)$`, "i"));
  if (!match?.groups?.prefix || !match.groups.multiplier || !match.groups.first || !match.groups.rest) {
    return null;
  }

  const rest = match.groups.rest.trim();
  if (/^\+/.test(rest)) {
    return [
      `${match.groups.prefix}${match.groups.multiplier} ${match.groups.first}${match.groups.firstSuffix ?? ""}`,
      `${match.groups.prefix}${rest}`
    ];
  }

  const restMatch = rest.match(new RegExp(`^(?<stat>${statWords})(?<suffix>\\s+(?:gain|bonus))?$`, "i"));
  if (!restMatch?.groups?.stat) {
    return null;
  }

  const sharedSuffix = match.groups.firstSuffix ?? restMatch.groups.suffix ?? "";
  return [
    `${match.groups.prefix}${match.groups.multiplier} ${match.groups.first}${sharedSuffix}`,
    `${match.groups.prefix}${match.groups.multiplier} ${restMatch.groups.stat}${restMatch.groups.suffix ?? sharedSuffix}`
  ];
}

function parseApplyAction(actionText: string, tags: TagLike[]): SemanticAction {
  const value = lower(actionText);
  const leadingMechanic = value.match(/^\s*(charge|haste|slow|freeze|burn|poison|shield|heal|regen|damage|reload)\b/)?.[1] as MechanicKeyword | undefined;
  const mechanic = leadingMechanic ?? mechanicFromText(actionText);
  const shinyTriggerMatch = actionText.match(/^this triggers the first (?<count>\d+|one|two|three) times? (?<event>.+)$/i);
  if (shinyTriggerMatch?.groups?.count && shinyTriggerMatch.groups.event) {
    const wordCounts: Record<string, number> = { one: 1, two: 2, three: 3 };
    const count = wordCounts[shinyTriggerMatch.groups.count.toLowerCase()] ?? Number(shinyTriggerMatch.groups.count);
    return {
      type: "modify_effect",
      target: { entity: "effect_template", owner: "self" },
      transform: { kind: "set", field: "triggerCount", value: fixed(count, "count") }
    };
  }
  const multicastInsteadMatch = actionText.match(/^all (?<target>your .+?) have multicast instead$/i);
  if (multicastInsteadMatch?.groups?.target) {
    return {
      type: "modify_stat",
      target: targetFromSubjectText(multicastInsteadMatch.groups.target, tags),
      stat: { domain: "card", id: "multicast" },
      op: "set",
      amount: fixed(1),
      duration: { kind: "while_source_active" }
    };
  }
  if (/\bthe sandstorm begins\b/i.test(actionText)) {
    return { type: "start_sandstorm", target: { entity: "event" } };
  }
  if (/^double this$/i.test(actionText)) {
    return { type: "modify_previous_action_value", op: "multiply", amount: fixed(2), description: actionText.trim() };
  }
  const increaseThisMatch = actionText.match(/^(?:vehicle or drone,\s+)?increase this by (?<amount>[-+]?\d+(?:\.\d+)?)$/i);
  if (increaseThisMatch?.groups?.amount) {
    return {
      type: "modify_previous_action_value",
      op: "add",
      amount: fixed(Number(increaseThisMatch.groups.amount)),
      description: actionText.trim()
    };
  }
  const statMultiplier = parseStatMultiplierAction(actionText, tags);
  if (statMultiplier) {
    return statMultiplier;
  }
  if (/\btargeted instead\b/i.test(actionText)) {
    return {
      type: "redirect",
      target: targetFromSubjectText(actionText, tags),
      replacement: itemSelector({ quantifier: "self" }),
      description: actionText.trim()
    };
  }
  if (/\btake no damage\b|\btakes no damage\b|\bnot take damage\b/i.test(actionText)) {
    return { type: "prevent_damage", target: playerSelector(ownerFromText(actionText)), duration: /\bfor\b/i.test(actionText) ? { kind: "for_seconds", seconds: amountFromText(actionText, "seconds") ?? fixed(0, "seconds") } : { kind: "instant" } };
  }
  const statusRemoval = parseStatusRemovalActions(actionText, tags);
  if (statusRemoval.length === 1) {
    return statusRemoval[0];
  }
  const compoundGoldHealthMatch =
    actionText.match(/^gain gold,\s+permanently gain max health equal to (?<expr>.+)$/i) ??
    actionText.match(/^permanently gain max health equal to (?<expr>.+)$/i);
  if (compoundGoldHealthMatch?.groups?.expr) {
    const amount = valueReferenceFromText(compoundGoldHealthMatch.groups.expr, tags);
    if (amount) {
      return {
        type: "modify_stat",
        target: playerSelector("self"),
        stat: { domain: "player", id: "maxHealth" },
        op: "add",
        amount,
        duration: { kind: "permanent" }
      };
    }
  }
  const additionalEffectMatch = actionText.match(/^(?:when you enrage,\s+)?(?:this\s+)?(?<mechanic>freezes|slows|hastes|charges|burns|poisons) an additional item$/i);
  if (additionalEffectMatch?.groups?.mechanic) {
    const mechanic = additionalEffectMatch.groups.mechanic.replace(/s$/i, "").toLowerCase() as MechanicKeyword;
    return {
      type: "modify_effect",
      target: {
        entity: "effect_template",
        owner: "self",
        predicates: atom({ kind: "has_mechanic", mechanic })
      },
      transform: { kind: "add", field: "targetCount", value: fixed(1, "count") }
    };
  }
  if (/^(?:when you enrage,\s+)?this item can trigger an additional time this fight$/i.test(actionText)) {
    return {
      type: "modify_effect",
      target: { entity: "effect_instance", owner: "self" },
      transform: { kind: "add", field: "triggerCount", value: fixed(1, "count") }
    };
  }
  if (/^reset it instead$/i.test(actionText) || /^already has \d+ of this bonus, reset it instead$/i.test(actionText)) {
    return { type: "reset_variable", variable: { variableId: "this_bonus" }, description: actionText.trim() };
  }
  if (/^this bonus, reset it instead$/i.test(actionText)) {
    return { type: "reset_variable", variable: { variableId: "this_bonus" }, description: actionText.trim() };
  }
  const directStatAction = !/^\s*(gain\s+\d|shield|heal|burn|poison|regen|deal)\b/i.test(actionText) ? parseStatAuraAction(actionText, tags) : null;
  if (directStatAction) {
    return directStatAction;
  }
  const dynamicMaxHealthMatch = actionText.match(/^gain max health equal to (?<expr>.+)$/i);
  if (dynamicMaxHealthMatch?.groups?.expr) {
    const amount = valueReferenceFromText(dynamicMaxHealthMatch.groups.expr, tags);
    if (amount) {
      return {
        type: "modify_stat",
        target: playerSelector("self"),
        stat: { domain: "player", id: "maxHealth" },
        op: "add",
        amount
      };
    }
  }
  const multicastMatch = actionText.match(/^multicast:\s*(?<amount>[-+]?\d+(?:\.\d+)?)/i);
  if (multicastMatch?.groups?.amount) {
    return {
      type: "modify_stat",
      target: itemSelector({ quantifier: "self" }),
      stat: { domain: "card", id: "multicast" },
      op: "set",
      amount: fixed(Number(multicastMatch.groups.amount)),
      duration: { kind: "while_source_active" }
    };
  }
  if (/^lifesteal$/i.test(actionText.trim())) {
    return {
      type: "modify_status",
      target: itemSelector({ quantifier: "self" }),
      status: "lifesteal_enabled",
      op: "add",
      duration: { kind: "while_source_active" }
    };
  }
  const status = statusFromStateText(actionText);
  if (status && /\b(?:starts?|start|stops?|stop|is|are|gain|gains|have|has)\b/i.test(actionText)) {
    return {
      type: "modify_status",
      target: targetFromStatusAssignmentText(actionText, status, tags),
      status,
      op: /\bstops?|stop|remove\b/i.test(actionText) ? "remove" : "add",
      duration: { kind: "while_source_active" }
    };
  }
  const heatMatch = actionText.match(/^heat\s+(?<target>.+?)\s+for\s+(?<duration>[-+]?\d+(?:\.\d+)?)\s+seconds?$/i);
  if (heatMatch?.groups?.target && heatMatch.groups.duration) {
    return {
      type: "modify_status",
      target: targetFromSubjectText(heatMatch.groups.target, tags),
      status: "heated",
      op: "add",
      duration: { kind: "for_seconds", seconds: fixed(Number(heatMatch.groups.duration), "seconds") }
    };
  }
  if (/^destroy\b|\bdestroy\b/i.test(actionText)) {
    return { type: "destroy_item", target: targetFromActionText(actionText, tags) };
  }
  if (/^reload\b/i.test(actionText)) {
    return { type: "apply_effect", mechanic: "reload", target: targetFromActionText(actionText, tags), amount: amountFromText(actionText) };
  }
  if (/^repair\b/i.test(actionText)) {
    return { type: "modify_status", target: targetFromActionText(actionText, tags), status: "repaired", op: "add" };
  }
  const cooldownActionMatch = actionText.match(/^(?<direction>reduce|decrease|increase)\s+(?<target>.+?)'?s?\s+cooldowns?\s+by\s+(?<amount>[-+]?\d+(?:\.\d+)?)/i);
  if (cooldownActionMatch?.groups?.direction && cooldownActionMatch.groups.target && cooldownActionMatch.groups.amount) {
    return {
      type: "modify_stat",
      target: targetFromSubjectText(cooldownActionMatch.groups.target, tags),
      stat: { domain: "card", id: "cooldownSeconds" },
      op: /increase/i.test(cooldownActionMatch.groups.direction) ? "add" : "subtract",
      amount: fixed(Number(cooldownActionMatch.groups.amount)),
      duration: { kind: "while_source_active" }
    };
  }
  const lifecycleAction = parseItemLifecycleAction(actionText, tags);
  if (lifecycleAction) {
    return lifecycleAction;
  }
  const economyMatch = actionText.match(/\b(?:gain|recover|get)\s+(?<amount>[-+]?\d+(?:\.\d+)?(?:\s+to\s+[-+]?\d+(?:\.\d+)?)?)\s+(?<stat>gold|prestige|xp|experience|rage)\b/i);
  if (economyMatch?.groups?.amount && economyMatch.groups.stat) {
    const stat = statFromText(economyMatch.groups.stat);
    if (stat) {
      return {
        type: "modify_stat",
        target: playerSelector("self"),
        stat,
        op: "add",
        amount: amountFromText(economyMatch.groups.amount) ?? fixed(Number(economyMatch.groups.amount))
      };
    }
  }
  const maxHealthMatch = actionText.match(/\b(?:you have|gain|gains?)\s+\+?(?<amount>[-+]?\d+(?:\.\d+)?)%?\s+(?<stat>max health|health)\b/i);
  if (maxHealthMatch?.groups?.amount && maxHealthMatch.groups.stat) {
    const stat = statFromText(maxHealthMatch.groups.stat);
    if (stat) {
      return {
        type: "modify_stat",
        target: playerSelector("self"),
        stat,
        op: "add",
        amount: fixed(Number(maxHealthMatch.groups.amount), /%/.test(actionText) ? "percent" : undefined)
      };
    }
  }
  if (mechanic === "charge" || mechanic === "haste" || mechanic === "slow" || mechanic === "freeze") {
    return {
      type: "apply_effect",
      mechanic,
      target: targetFromActionText(actionText, tags, mechanic === "slow" || mechanic === "freeze" ? "enemy" : "self"),
      amount: amountFromText(actionText, "seconds")
    };
  }
  if (mechanic && ["burn", "poison", "shield", "heal", "regen", "damage"].includes(mechanic)) {
    return {
      type: "apply_effect",
      mechanic,
      target: playerEffectTarget(mechanic, actionText),
      amount: valueReferenceFromText(actionText, tags) ?? amountFromText(actionText)
    };
  }
  const statAction = parseStatAuraAction(actionText, tags);
  if (statAction) {
    return statAction;
  }
  if (/^use\b|\buse this\b/i.test(value)) {
    return { type: "use_item", target: targetFromActionText(actionText, tags) };
  }
  return { type: "unknown", rawText: actionText };
}

function parseFirstLimiter(text: string, index: number, tags: TagLike[]): SemanticClause | null {
  const match = text.match(new RegExp(`^the first (?:(?<count>${NUMBER_PATTERN}) times?|time) (?<event>.+?)(?: (?<reset>each fight|in a fight))?, (?<action>.+)$`, "i"));
  if (!match?.groups?.event || !match.groups.action) {
    return null;
  }

  const count = match.groups.count == null ? 1 : Number(match.groups.count);
  const reset = match.groups.reset ? "fight" : "never";
  const warnings: SemanticWarning[] = [];
  if (/\bnon-[a-z]+\s+or\s+non-[a-z]+/i.test(match.groups.event)) {
    warnings.push(
      warning(
        "BOOLEAN_AMBIGUITY",
        "The phrase with multiple non-X alternatives may mean raw NOT X OR NOT Y, or the normalized NOT (X OR Y).",
        "warning",
        text
      )
    );
  }
  if (/\b(?:burn|poison|weapon|heal|regen|vehicle|drone|tool|relic|food|core)\s+and\s+(?:burn|poison|weapon|heal|regen|vehicle|drone|tool|relic|food|core)\b/i.test(match.groups.action)) {
    warnings.push(
      warning(
        "TARGET_AMBIGUITY",
        "The target phrase with 'and' may mean a union of matching items or items that satisfy all listed mechanics/types.",
        "warning",
        text
      )
    );
  }

  return {
    id: `c_${index}_first_limiter`,
    kind: "triggered",
    activeIn: ["combat"],
    trigger: triggerFromFirstEvent(match.groups.event, tags),
    limiter:
      count === 1
        ? { kind: "once", reset, consume: "on_trigger_match" }
        : { kind: "first_n", count: fixed(count, "count"), reset, consume: "on_trigger_match" },
    actions: parseActionNodes(match.groups.action, tags),
    confidence: warnings.length > 0 ? "medium" : "high",
    ...(warnings.length > 0 ? { warnings } : {})
  };
}

function parseCustomScope(text: string, index: number, tags: TagLike[]): SemanticClause | null {
  const match = text.match(/^if you have exactly one (?<type>[a-z -]+), when you crit with it (?<action>.+)$/i);
  if (!match?.groups?.type || !match.groups.action) {
    return null;
  }

  const type = knownTypeFromText(match.groups.type, tags) ?? slugify(match.groups.type);
  return {
    id: `c_${index}_conditional_crit`,
    kind: "triggered",
    activeIn: ["combat"],
    condition: semanticAtom({
      domain: "entity",
      predicate: {
        kind: "count_compare",
        selector: itemSelector({ predicates: atom(itemTypePredicate(type)) }),
        cmp: "eq",
        value: fixed(1, "count")
      }
    }),
    trigger: {
      event: "crit",
      actor: playerSelector("self"),
      subject: itemSelector({ predicates: atom(itemTypePredicate(type)), bindAs: "exact_item" }),
      sourceEventText: `when you Crit with it`
    },
    actions: parseActionNodes(match.groups.action, tags),
    confidence: "high"
  };
}

function parseWhileAura(text: string, index: number, tags: TagLike[]): SemanticClause | null {
  const match =
    text.match(/^while you are (?<state>enraged|hasted|slowed|frozen), (?<action>.+)$/i) ??
    text.match(/^while (?<owner>your enemy|the enemy|an enemy) is (?<state>burned|poisoned|shielded|enraged|hasted|slowed|frozen), (?<action>.+)$/i) ??
    text.match(/^while in play, (?<action>.+)$/i);
  if (!match?.groups?.action) {
    return null;
  }

  const state = (match.groups.state ? lower(match.groups.state).replace(/burned$/, "burn").replace(/poisoned$/, "poison").replace(/shielded$/, "shielded") : "in_play") as StatusFlag;
  const owner: Owner = match.groups.owner ? ownerFromText(match.groups.owner) : "self";
  const condition = match.groups.state ? playerStatePredicate(state, owner) : semanticAtom({ domain: "player_state", owner: "self", state: "InPlay" });
  const statAction = parseStatAuraAction(match.groups.action, tags);
  return {
    id: `c_${index}_while_${slugify(String(state))}`,
    kind: "aura",
    activeIn: ["combat"],
    condition,
    duration: { kind: "while_condition", condition, reversible: true },
    actions: statAction ? [{ node: "atomic", action: statAction }] : parseActionNodes(match.groups.action, tags),
    confidence: "medium"
  };
}

function parseWhenUseClause(text: string, index: number, tags: TagLike[]): SemanticClause | null {
  const normalized = normalizeConditionalPrefix(text);
  const match = normalized.match(/^when (?<actor>you|your enemy|an enemy|the enemy|your opponent) uses? (?<subject>.+?), (?<action>.+)$/i);
  if (!match?.groups?.actor || !match.groups.subject || !match.groups.action) {
    return null;
  }

  const owner: Owner = /\benemy\b|\bopponent\b/i.test(match.groups.actor) ? "enemy" : "self";
  return {
    id: `c_${index}_when_item_used`,
    kind: "triggered",
    activeIn: ["combat"],
    trigger: {
      event: "item_used",
      actor: playerSelector(owner),
      subject: itemSelector({ owner, predicates: predicateExprFromList(match.groups.subject, tags) }),
      sourceEventText: `when ${match.groups.actor} uses ${match.groups.subject}`
    },
    actions: parseActionNodes(match.groups.action, tags),
    confidence: "medium"
  };
}

function parseWhenSellClause(text: string, index: number, tags: TagLike[]): SemanticClause | null {
  const match = text.match(/^when (?<actor>you|your enemy|an enemy|the enemy|your opponent) sells? (?<subject>.+?), (?<action>.+)$/i);
  if (!match?.groups?.actor || !match.groups.subject || !match.groups.action) {
    return null;
  }

  const owner: Owner = /\benemy\b|\bopponent\b/i.test(match.groups.actor) ? "enemy" : "self";
  return {
    id: `c_${index}_when_item_sold`,
    kind: "triggered",
    trigger: {
      event: "item_sold",
      actor: playerSelector(owner),
      subject: itemSelector({ owner, predicates: predicateExprFromList(match.groups.subject, tags) }),
      sourceEventText: `when ${match.groups.actor} sells ${match.groups.subject}`
    },
    actions: parseActionNodes(match.groups.action, tags),
    confidence: "medium"
  };
}

function eventPatternFromLead(lead: string, tags: TagLike[]): EventPattern {
  const value = lower(lead);
  if (/\bstart of each fight\b|\bstart of combat\b/.test(value)) {
    return { event: "fight_started", actor: playerSelector("self"), sourceEventText: lead };
  }
  if (/\bstart of each day\b|\bstart of each hour\b/.test(value)) {
    return { event: "day_started", actor: playerSelector("self"), sourceEventText: lead };
  }
  if (/\bend of each fight\b/.test(value)) {
    return { event: "fight_ended", actor: playerSelector("self"), sourceEventText: lead };
  }
  if (/\bwhen you win\b|\bwhen .* wins?\b|\bwin a fight\b|\bwon the fight\b/.test(value)) {
    return { event: "combat_won", actor: playerSelector("self"), subject: targetFromSubjectText(lead, tags), sourceEventText: lead };
  }
  if (/\bwhen you lose\b|\bwhen .* loses?\b|\blose a fight\b|\blost the fight\b/.test(value)) {
    return { event: "combat_lost", actor: playerSelector("self"), subject: targetFromSubjectText(lead, tags), sourceEventText: lead };
  }
  if (/\bwhen you buy\b|\bon buy\b/.test(value)) {
    return { event: "item_bought", actor: playerSelector("self"), subject: itemSelector({ quantifier: "self" }), sourceEventText: lead };
  }
  if (/\bwhen you sell\b|\bon sell\b/.test(value)) {
    return { event: "item_sold", actor: playerSelector("self"), subject: targetFromSubjectText(lead, tags), sourceEventText: lead };
  }
  if (/\bwhen .* sells?\b|\bsells? .+ at a merchant\b/.test(value)) {
    return { event: "item_sold", actor: playerSelector(ownerFromText(lead)), subject: targetFromSubjectText(lead, tags), sourceEventText: lead };
  }
  if (/\bwhen this(?: item)? is transformed\b|\bwhen .* is transformed\b/.test(value)) {
    return { event: "item_transformed", actor: playerSelector(ownerFromText(lead)), subject: targetFromSubjectText(lead, tags), sourceEventText: lead };
  }
  if (/\bwhen this(?: item)? is destroyed\b|\bwhen .* is destroyed\b|\bwhen .* destroys?\b/.test(value)) {
    return { event: "item_destroyed", actor: playerSelector(ownerFromText(lead)), subject: targetFromSubjectText(lead, tags), sourceEventText: lead };
  }
  if (/\bwhen this runs out of ammo\b|\bwhen .* runs out of ammo\b/.test(value)) {
    return { event: "ammo_empty", actor: playerSelector(ownerFromText(lead)), subject: targetFromSubjectText(lead, tags), sourceEventText: lead };
  }
  if (/\bwhen you level up\b|\blevel up\b/.test(value)) {
    return { event: "day_started", actor: playerSelector("self"), sourceEventText: lead };
  }
  if (/\bwhen you crit\b|\bwhen .* crit\b/.test(value)) {
    return { event: "crit", actor: playerSelector("self"), sourceEventText: lead };
  }
  if (/\bwhen you enrage\b|\bwhen you become enraged\b/.test(value)) {
    return { event: "enraged", actor: playerSelector("self"), sourceEventText: lead };
  }
  const statusEndedMatch = lead.match(/\bwhen (?<actor>you|your enemy|an enemy|the enemy|your opponent) stops? being (?<status>enraged|hasted|slowed|frozen|chilled|heated)\b/i);
  if (statusEndedMatch?.groups?.actor && statusEndedMatch.groups.status) {
    return {
      event: "status_ended",
      actor: playerSelector(ownerFromText(statusEndedMatch.groups.actor)),
      object: { entity: "event", predicates: atom(statusPredicate(statusFromStateText(statusEndedMatch.groups.status) ?? (lower(statusEndedMatch.groups.status) as StatusFlag))) },
      sourceEventText: lead
    };
  }
  if (/\bwhen the sandstorm starts\b/.test(value)) {
    return { event: "effect_applied", actor: playerSelector("self"), sourceEventText: lead };
  }
  if (/^on day \d+\b/.test(value)) {
    return { event: "day_started", actor: playerSelector("self"), sourceEventText: lead };
  }
  return triggerFromFirstEvent(lead.replace(/^when\s+/i, ""), tags);
}

function parseTriggeredClause(text: string, index: number, tags: TagLike[]): SemanticClause | null {
  const match =
    text.match(/^(?<lead>when [^,]+|at the start of each (?:day|hour|fight)|at the end of each fight|on day \d+),\s*(?<action>.+)$/i) ??
    text.match(/^(?<lead>at the start of each (?:day|hour|fight)|at the end of each fight|on day \d+)\s+(?<action>.+)$/i);
  if (!match?.groups?.lead || !match.groups.action) return null;
  if (!/^(?:get|gain|permanently\s+gain|recover|learn|set|double|transform|enchant|upgrade|reduce|increase|reload|use|destroy|permanently\s+destroy|allows|cleanse|remove|deal|damage|burn|poison|shield|heal|regen|slow|freeze|haste|charge|repair|take|this\b|your\b|an?\b|all\b)/i.test(match.groups.action)) {
    return null;
  }
  return {
    id: `c_${index}_triggered`,
    kind: "triggered",
    trigger: eventPatternFromLead(match.groups.lead, tags),
    actions: parseActionNodes(match.groups.action, tags),
    confidence: "medium"
  };
}

function parseConditionalClause(text: string, index: number, tags: TagLike[]): SemanticClause | null {
  const normalized = normalizeConditionalPrefix(text);
  const match = normalized.match(/^if (?<condition>.+?)(?:,\s+|\s+(?=this\b|reduce\b|gain\b|reset\b))(?<action>.+)$/i);
  if (!match?.groups?.condition || !match.groups.action) return null;

  const conditionText = match.groups.condition.trim();
  const actionText = match.groups.action.replace(/^it\b/i, "this");
  const playerStateMatch = /\byou are a (?<state>.+)$/i.exec(conditionText);
  const predicate = playerStateMatch?.groups?.state
    ? playerStatePredicate(playerStateFromConditionText(playerStateMatch.groups.state))
    : semanticAtom({
        domain: "entity",
        predicate: {
          kind: "count_compare",
          selector: targetFromSubjectText(conditionText, tags),
          cmp: /\bno\b|\bonly\b/.test(conditionText.toLowerCase()) ? "eq" : "gte",
          value: fixed(/\bno\b/i.test(conditionText) ? 0 : 1, "count")
        }
      });

  return {
    id: `c_${index}_conditional`,
    kind: "aura",
    condition: predicate,
    actions: parseActionNodes(actionText, tags),
    confidence: "medium"
  };
}

function playerStateFromConditionText(text: string): string {
  const state = text.trim();
  return /^cult member$/i.test(state) ? "FactionMembership:Cult" : `PlayerTag:${state}`;
}

function parseStatAuraAction(text: string, tags: TagLike[]): SemanticAction | null {
  if (/^sells?\s+for\s+gold\b/i.test(text)) {
    return {
      type: "modify_stat",
      target: playerSelector("self"),
      stat: { domain: "player", id: "gold" },
      op: "add",
      amount: { kind: "identifier", value: "sell_price" }
    };
  }

  const normalizedText = text.replace(/[.。]+$/g, "").trim();
  const statMultiplier = parseStatMultiplierAction(normalizedText, tags);
  if (statMultiplier) {
    return statMultiplier;
  }
  const merchantPricesMatch = normalizedText.match(/^merchants sell items for (?<sellDelta>[-+]?\d+(?:\.\d+)?) less gold and buy items for (?<buyDelta>[-+]?\d+(?:\.\d+)?) more gold$/i);
  if (merchantPricesMatch?.groups?.sellDelta && merchantPricesMatch.groups.buyDelta) {
    return {
      type: "modify_stat",
      target: merchantSelector("any"),
      stat: { domain: "card", id: "buyPrice" },
      op: "subtract",
      amount: fixed(Number(merchantPricesMatch.groups.sellDelta), "gold"),
      duration: { kind: "while_source_active" }
    };
  }

  const merchantDiscountMatch = normalizedText.match(/^discount its items by (?<amount>[-+]?\d+(?:\.\d+)?)%$/i);
  if (merchantDiscountMatch?.groups?.amount) {
    return {
      type: "modify_stat",
      target: itemSelector({ owner: "self", zone: "shop", quantifier: "all" }),
      stat: { domain: "card", id: "buyPrice" },
      op: "subtract",
      amount: fixed(Number(merchantDiscountMatch.groups.amount), "percent"),
      duration: { kind: "while_source_active" }
    };
  }

  const rerollMatch = normalizedText.match(/^your rerolls cost (?<amount>[-+]?\d+(?:\.\d+)?) less gold(?: for each (?<filter>.+?) you have)?$/i);
  if (rerollMatch?.groups?.amount) {
    const amount: ValueExpr = rerollMatch.groups.filter
      ? {
          kind: "scale",
          factor: Number(rerollMatch.groups.amount),
          value: { kind: "count", selector: targetFromSubjectText(rerollMatch.groups.filter, tags) }
        }
      : fixed(Number(rerollMatch.groups.amount), "gold");
    return {
      type: "modify_stat",
      target: playerSelector("self"),
      stat: { domain: "player", id: "rerollCost" },
      op: "subtract",
      amount,
      duration: { kind: "while_source_active" }
    };
  }

  const expeditionMatch = normalizedText.match(/^on day (?<day>\d+),?\s+allows you to embark on the (?<name>.+? expedition)$/i);
  if (expeditionMatch?.groups?.day && expeditionMatch.groups.name) {
    return {
      type: "add_player_state",
      target: playerSelector("self"),
      state: `ExpeditionUnlock:${expeditionMatch.groups.name.trim()}:Day${expeditionMatch.groups.day}`
    };
  }

  const bareExpeditionMatch = normalizedText.match(/^allows you to embark on the (?<name>.+? expedition)$/i);
  if (bareExpeditionMatch?.groups?.name) {
    return {
      type: "add_player_state",
      target: playerSelector("self"),
      state: `ExpeditionUnlock:${bareExpeditionMatch.groups.name.trim()}`
    };
  }

  const transformedOutsideCombatMatch = normalizedText.match(/^transformed outside of combat,\s+(?<action>.+)$/i);
  if (transformedOutsideCombatMatch?.groups?.action) {
    return parseApplyAction(transformedOutsideCombatMatch.groups.action, tags);
  }

  if (/^you need twice as much rage to enrage$/i.test(normalizedText)) {
    return {
      type: "modify_stat",
      target: playerSelector("self"),
      stat: { domain: "player", id: "rageRequirement" },
      op: "multiply",
      amount: fixed(2),
      duration: { kind: "while_source_active" }
    };
  }

  const rageGainMatch = normalizedText.match(/^you have double rage gain$/i);
  if (rageGainMatch) {
    return {
      type: "modify_stat",
      target: playerSelector("self"),
      stat: { domain: "player", id: "rageGain" },
      op: "multiply",
      amount: fixed(2),
      duration: { kind: "while_source_active" }
    };
  }

  const typeCopyMatch =
    normalizedText.match(/^this has the types of items you have(?: in your stash)?$/i) ??
    normalizedText.match(/^this item has the types of items you have(?: in your stash)?$/i);
  if (typeCopyMatch) {
    return {
      type: "modify_tags",
      target: itemSelector({ quantifier: "self" }),
      op: "copy_from",
      source: itemSelector({ quantifier: "all", zone: /\bstash\b/i.test(normalizedText) ? "stash" : "board" }),
      description: normalizedText
    };
  }

  if (/^gains that item'?s types?$/i.test(normalizedText)) {
    return {
      type: "modify_tags",
      target: itemSelector({ quantifier: "self" }),
      op: "copy_from",
      source: itemSelector({ quantifier: "self", bindAs: "trigger_item" }),
      description: normalizedText
    };
  }

  const randomTypeMatch = normalizedText.match(/^(?:(?<target>your .+?|this|it)\s+)?gains (?<amount>[-+]?\d+(?:\.\d+)?) random type\(s\)$/i);
  if (randomTypeMatch?.groups?.amount) {
    return {
      type: "modify_tags",
      target: randomTypeMatch.groups.target ? targetFromSubjectText(randomTypeMatch.groups.target, tags) : itemSelector({ quantifier: "self" }),
      op: "add_random",
      amount: fixed(Number(randomTypeMatch.groups.amount), "count"),
      description: normalizedText
    };
  }

  const copyTypeTargetMatch = normalizedText.match(/^(?<target>this|it|your .+?)\s+gains that item'?s types?$/i);
  if (copyTypeTargetMatch?.groups?.target) {
    return {
      type: "modify_tags",
      target: targetFromSubjectText(copyTypeTargetMatch.groups.target, tags),
      op: "copy_from",
      source: itemSelector({ quantifier: "self", bindAs: "trigger_item" }),
      description: normalizedText
    };
  }

  const spendAmmoMatch = normalizedText.match(/^spend all (?:its|this item's) ammo$/i);
  if (spendAmmoMatch) {
    return {
      type: "modify_stat",
      target: itemSelector({ quantifier: "self" }),
      stat: { domain: "card", id: "ammo" },
      op: "set",
      amount: fixed(0)
    };
  }

  const simpleLoseMatch = normalizedText.match(/^(?<target>this|it|all your items|your items)\s+(?:permanently\s+)?loses?\s+(?<amount>[-+]?\d+(?:\.\d+)?)%?\s+(?<stat>crit(?:%|\s+chance)?|ammo(?:\s+max\s+ammo)?|value|damage|shield|burn|poison|regen)$/i);
  if (simpleLoseMatch?.groups?.target && simpleLoseMatch.groups.amount && simpleLoseMatch.groups.stat) {
    const stat = statFromText(simpleLoseMatch.groups.stat);
    if (stat) {
      return {
        type: "modify_stat",
        target: targetFromSubjectText(simpleLoseMatch.groups.target, tags),
        stat,
        op: "subtract",
        amount: fixed(Number(simpleLoseMatch.groups.amount), /%/.test(simpleLoseMatch[0]) ? "percent" : undefined),
        duration: /\bpermanently\b/i.test(normalizedText) ? { kind: "permanent" } : { kind: "while_source_active" }
      };
    }
  }

  const enemyMaxHealthMatch = normalizedText.match(/^reduce an enemy'?s max health by (?<amount>[-+]?\d+(?:\.\d+)?)%?$/i);
  if (enemyMaxHealthMatch?.groups?.amount) {
    return {
      type: "modify_stat",
      target: playerSelector("enemy"),
      stat: { domain: "player", id: "maxHealth" },
      op: "subtract",
      amount: fixed(Number(enemyMaxHealthMatch.groups.amount), /%/.test(normalizedText) ? "percent" : undefined)
    };
  }

  const increaseValueMatch = normalizedText.match(/^increase (?<target>its|this item'?s|this|it|the item'?s|that item'?s|that property'?s) value by (?<expr>.+)$/i);
  if (increaseValueMatch?.groups?.target && increaseValueMatch.groups.expr) {
    const amount = valueReferenceFromText(increaseValueMatch.groups.expr, tags);
    if (amount) {
      return {
        type: "modify_stat",
        target: targetFromSubjectText(increaseValueMatch.groups.target, tags),
        stat: { domain: "card", id: "value" },
        op: "add",
        amount,
        duration: { kind: "while_source_active" }
      };
    }
  }

  const thisLoseMatch = normalizedText.match(/^(?<target>this|it)\s+loses?\s+(?<amount>[-+]?\d+(?:\.\d+)?)%?\s+(?<stat>crit(?:%|\s+crit\s+chance|\s+chance|%\s+crit\s+chance)?|ammo(?:\s+max\s+ammo)?|value|damage|shield|burn|poison|regen)$/i);
  if (thisLoseMatch?.groups?.target && thisLoseMatch.groups.amount && thisLoseMatch.groups.stat) {
    const stat = statFromText(thisLoseMatch.groups.stat);
    if (stat) {
      return {
        type: "modify_stat",
        target: targetFromSubjectText(thisLoseMatch.groups.target, tags),
        stat,
        op: "subtract",
        amount: fixed(Number(thisLoseMatch.groups.amount), /%/.test(thisLoseMatch[0]) ? "percent" : undefined),
        duration: { kind: "while_source_active" }
      };
    }
  }

  const reduceOwnCooldownHalfMatch = normalizedText.match(/^reduce this item'?s cooldown by half$/i);
  if (reduceOwnCooldownHalfMatch) {
    return {
      type: "modify_stat",
      target: itemSelector({ quantifier: "self" }),
      stat: { domain: "card", id: "cooldownSeconds" },
      op: "multiply",
      amount: fixed(0.5),
      duration: { kind: "while_source_active" }
    };
  }

  const trailingXpMatch = normalizedText.match(/^this,\s+gain (?<amount>[-+]?\d+(?:\.\d+)?) additional xp$/i);
  if (trailingXpMatch?.groups?.amount) {
    return {
      type: "modify_stat",
      target: playerSelector("self"),
      stat: { domain: "player", id: "experience" },
      op: "add",
      amount: fixed(Number(trailingXpMatch.groups.amount))
    };
  }

  const bareGainMatch = normalizedText.match(/^gains?\s+\+?(?<amount>[-+]?\d+(?:\.\d+)?)\s+(?<stat>value|damage|shield|burn|poison|regen|crit(?:%|\s+chance)?|multicast|ammo(?:\s+max\s+ammo)?)$/i);
  if (bareGainMatch?.groups?.amount && bareGainMatch.groups.stat) {
    const stat = statFromText(bareGainMatch.groups.stat);
    if (stat) {
      return {
        type: "modify_stat",
        target: itemSelector({ quantifier: "self" }),
        stat,
        op: "add",
        amount: fixed(Number(bareGainMatch.groups.amount)),
        duration: { kind: "while_source_active" }
      };
    }
  }

  const tagAssignmentMatch = text.match(/^(?<target>your .+?|adjacent .+?|the .+? to the (?:left|right)|this|[a-z -]+ items?)\s+(?:is|are)\s+(?:a|an)?\s*(?<tag>[a-z][a-z -]+?)(?:\s+in combat)?$/i);
  if (tagAssignmentMatch?.groups?.target && tagAssignmentMatch.groups.tag) {
    const tagText = tagAssignmentMatch.groups.tag.replace(/^\s*a\s+/i, "");
    const type = knownTypeFromText(tagText, tags) ?? slugify(tagText);
    return {
      type: "modify_status",
      target: targetFromSubjectText(tagAssignmentMatch.groups.target, tags),
      status: `tag:${type}`,
      op: "add",
      duration: { kind: "while_source_active" }
    };
  }

  const hasTypeMatch = normalizedText.match(/^(?<target>your .+?|this|it|[a-z -]+ items?)\s+has the (?<tag>[a-z][a-z -]+?) type$/i);
  if (hasTypeMatch?.groups?.target && hasTypeMatch.groups.tag) {
    const type = knownTypeFromText(hasTypeMatch.groups.tag, tags) ?? slugify(hasTypeMatch.groups.tag);
    return {
      type: "modify_status",
      target: targetFromSubjectText(hasTypeMatch.groups.target, tags),
      status: `tag:${type}`,
      op: "add",
      duration: { kind: "while_source_active" }
    };
  }

  const valueSetMatch = normalizedText.match(/^(?:set\s+)?(?<target>this item'?s|this|its|it|the item to the left|the item to the right|your items?|your [a-z -]+s?)\s+value\s+(?:to|is|equal to|becomes)\s+(?<expr>.+)$/i);
  if (valueSetMatch?.groups?.target && valueSetMatch.groups.expr) {
    const amount = valueReferenceFromText(valueSetMatch.groups.expr, tags);
    if (amount) {
      return {
        type: "modify_stat",
        target: targetFromSubjectText(valueSetMatch.groups.target, tags),
        stat: { domain: "card", id: "value" },
        op: "set",
        amount,
        duration: { kind: "while_source_active" }
      };
    }
  }

  const zeroValueMatch = normalizedText.match(/^(?<target>[a-z -]+?)\s+have\s+0\s+value$/i);
  if (zeroValueMatch?.groups?.target) {
    return {
      type: "modify_stat",
      target: targetFromSubjectText(zeroValueMatch.groups.target, tags),
      stat: { domain: "card", id: "value" },
      op: "set",
      amount: fixed(0),
      duration: { kind: "while_source_active" }
    };
  }

  const statEqualMatch =
    normalizedText.match(/^(?<target>your items|your [a-z -]+ items|your [a-z -]+s|your [a-z -]+|you|you [a-z -]+|this|it|they|adjacent items|adjacent [a-z -]+s|the item to the left|the item to the right|your leftmost item|your rightmost item|your core|a [a-z -]+|an [a-z -]+)\s+(?:permanently\s+)?(?:have|has|gain|gains|gets?)\s+\+?\s*(?<stat>crit(?:%|\s+chance)?|damage|shield|burn|poison|heal|regen|multicast|value|max health|health|ammo|max ammo(?:\s+max\s+ammo)?)\s+equal to\s+(?<expr>.+)$/i) ??
    normalizedText.match(/^(?<target>your items|your [a-z -]+ items|your [a-z -]+s|your [a-z -]+|you|you [a-z -]+|this|it|they|adjacent items|adjacent [a-z -]+s|the item to the left|the item to the right|your leftmost item|your rightmost item|your core|a [a-z -]+|an [a-z -]+)\s+(?:permanently\s+)?(?:have|has|gain|gains|gets?)\s+\+?(?<amount>(?:[-+]?\d+(?:\.\d+)?|\{[a-z0-9_.-]+\}))%?\s+(?<stat>crit(?:%|\s+chance)?|damage|shield|burn|poison|heal|regen|multicast|value|max health|health|ammo|max ammo(?:\s+max\s+ammo)?)\s+for each\s+(?<expr>.+)$/i);
  if (statEqualMatch?.groups?.target && statEqualMatch.groups.stat) {
    const stat = statFromText(statEqualMatch.groups.stat);
    const amount = statEqualMatch.groups.expr
      ? valueReferenceFromText(
          statEqualMatch.groups.amount ? `${statEqualMatch.groups.amount} for each ${statEqualMatch.groups.expr}` : statEqualMatch.groups.expr,
          tags
        )
      : undefined;
    if (stat && amount) {
      return {
        type: "modify_stat",
        target: /^(?:you)$/i.test(statEqualMatch.groups.target) ? playerSelector("self") : targetFromSubjectText(statEqualMatch.groups.target, tags),
        stat,
        op: "add",
        amount,
        duration: /\bpermanently\b/i.test(normalizedText) ? { kind: "permanent" } : { kind: "while_source_active" }
      };
    }
  }

  const match =
    text.match(/\b(?<target>your items|your [a-z -]+ items|your [a-z -]+s|your [a-z -]+|this|it|they|adjacent items|adjacent [a-z -]+s|the item to the left|the item to the right|the [a-z -]+ to the left|the [a-z -]+ to the right|a [a-z -]+|an [a-z -]+)\b.*\b(?:have|has|gain|gains|gets?)\s+\+?(?<amount>[-+]?\d+(?:\.\d+)?|\{[a-z0-9_.-]+\})%?\s+(?<stat>damage|shield|burn|poison|heal|regen|crit(?:%|\s+crit\s+chance|\s+chance)?|multicast|max ammo|ammo(?:\s+max\s+ammo)?|value|sell\s+value|rage)\b/i) ??
    text.match(/^(?<target>your items|your [a-z -]+ items|your [a-z -]+s|your [a-z -]+|adjacent items|adjacent [a-z -]+s|the item to the left|the item to the right|the [a-z -]+ to the left|the [a-z -]+ to the right|this|it|they|a [a-z -]+|an [a-z -]+)?\s*(?:permanently\s+)?(?:have|has|gain|gains|gets?)?\s*\+?(?<amount>[-+]?\d+(?:\.\d+)?|\{[a-z0-9_.-]+\})%?\s+(?<stat>damage|shield|burn|poison|heal|regen|crit(?:%|\s+crit\s+chance|\s+chance)?|multicast|max ammo|ammo(?:\s+max\s+ammo)?|value|sell\s+value|rage)\b/i);
  if (match?.groups?.target && match.groups.amount && match.groups.stat) {
    const stat = statFromText(match.groups.stat);
    if (!stat) return null;
    return {
      type: "modify_stat",
      target: targetFromSubjectText(match.groups.target, tags),
      stat,
      op: "add",
      amount: amountFromText(match.groups.amount, /%/.test(match[0]) ? "percent" : undefined) ?? fixed(Number(match.groups.amount), /%/.test(match[0]) ? "percent" : undefined),
      duration: /\bpermanently\b/i.test(text) ? { kind: "permanent" } : { kind: "while_source_active" }
    };
  }
  if (!match?.groups?.target && match?.groups?.amount && match.groups.stat) {
    const stat = statFromText(match.groups.stat);
    if (!stat) return null;
    return {
      type: "modify_stat",
      target: itemSelector({ quantifier: "self" }),
      stat,
      op: "add",
      amount: amountFromText(match.groups.amount, /%/.test(match[0]) ? "percent" : undefined) ?? fixed(Number(match.groups.amount), /%/.test(match[0]) ? "percent" : undefined),
      duration: /\bpermanently\b/i.test(text) ? { kind: "permanent" } : { kind: "while_source_active" }
    };
  }

  const playerStatMatch = text.match(/^you (?:have|gain|gains?|have increased)\s+\+?(?<amount>[-+]?\d+(?:\.\d+)?|\{[a-z0-9_.-]+\})%?\s+(?<stat>max health|health|income|gold|prestige|xp|experience)\b/i);
  if (playerStatMatch?.groups?.amount && playerStatMatch.groups.stat) {
    const stat = statFromText(playerStatMatch.groups.stat);
    if (!stat) return null;
    return {
      type: "modify_stat",
      target: playerSelector("self"),
      stat,
      op: "add",
      amount: amountFromText(playerStatMatch.groups.amount, /%/.test(text) ? "percent" : undefined) ?? fixed(Number(playerStatMatch.groups.amount), /%/.test(text) ? "percent" : undefined),
      duration: { kind: "while_source_active" }
    };
  }

  const playerStatEqualMatch = text.match(/^you (?:have|gain|gains?|have increased)\s+(?<stat>max health|health|income|gold|prestige|xp|experience|rage)\s+equal to\s+(?<expr>.+)$/i);
  if (playerStatEqualMatch?.groups?.stat && playerStatEqualMatch.groups.expr) {
    const stat = statFromText(playerStatEqualMatch.groups.stat);
    const amount = valueReferenceFromText(playerStatEqualMatch.groups.expr, tags);
    if (stat && amount) {
      return {
        type: "modify_stat",
        target: playerSelector("self"),
        stat,
        op: "add",
        amount,
        duration: { kind: "while_source_active" }
      };
    }
  }

  const cooldownOfMatch = text.match(/^the cooldowns? of (?<target>.+?) (?:is|are) (?<direction>reduced|decreased|increased|halved)\s*(?:by\s+)?(?<amount>[-+]?\d+(?:\.\d+)?)?/i);
  if (cooldownOfMatch?.groups?.target && cooldownOfMatch.groups.direction) {
    const amount = /\bfor each\b|\bfor every\b|\bper\b/i.test(text)
      ? valueReferenceFromText(text, tags, "seconds")
      : /halved/i.test(cooldownOfMatch.groups.direction)
        ? fixed(0.5)
        : fixed(cooldownOfMatch.groups.amount ? Number(cooldownOfMatch.groups.amount) : 0.5, /%/.test(text) ? "percent" : "seconds");
    return {
      type: "modify_stat",
      target: targetFromSubjectText(cooldownOfMatch.groups.target, tags),
      stat: { domain: "card", id: "cooldownSeconds" },
      op: /increase|increased/i.test(cooldownOfMatch.groups.direction) ? "add" : /halved/i.test(cooldownOfMatch.groups.direction) ? "multiply" : "subtract",
      amount: amount ?? fixed(0.5),
      duration: { kind: "while_source_active" }
    };
  }

  const reduceCooldownOfMatch = text.match(/^(?<direction>reduce|decrease|increase)\s+the cooldowns?\s+of\s+(?<target>.+?)\s+by\s+(?<amount>[-+]?\d+(?:\.\d+)?)/i);
  if (reduceCooldownOfMatch?.groups?.target && reduceCooldownOfMatch.groups.direction && reduceCooldownOfMatch.groups.amount) {
    return {
      type: "modify_stat",
      target: targetFromSubjectText(reduceCooldownOfMatch.groups.target, tags),
      stat: { domain: "card", id: "cooldownSeconds" },
      op: /increase/i.test(reduceCooldownOfMatch.groups.direction) ? "add" : "subtract",
      amount: fixed(Number(reduceCooldownOfMatch.groups.amount), /%/.test(text) ? "percent" : "seconds"),
      duration: { kind: "while_source_active" }
    };
  }

  const forEachReduceCooldownMatch = text.match(/^for each (?<filter>.+?),\s+reduce this item'?s cooldown by (?<amount>[-+]?\d+(?:\.\d+)?) second/i);
  if (forEachReduceCooldownMatch?.groups?.filter && forEachReduceCooldownMatch.groups.amount) {
    return {
      type: "modify_stat",
      target: itemSelector({ quantifier: "self" }),
      stat: { domain: "card", id: "cooldownSeconds" },
      op: "subtract",
      amount: {
        kind: "scale",
        factor: Number(forEachReduceCooldownMatch.groups.amount),
        value: { kind: "count", selector: targetFromSubjectText(forEachReduceCooldownMatch.groups.filter, tags) }
      },
      duration: { kind: "while_source_active" }
    };
  }

  const bareCooldownReducedMatch = text.match(/^reduced by (?<amount>[-+]?\d+(?:\.\d+)?) seconds?$/i);
  if (bareCooldownReducedMatch?.groups?.amount) {
    return {
      type: "modify_stat",
      target: itemSelector({ quantifier: "self" }),
      stat: { domain: "card", id: "cooldownSeconds" },
      op: "subtract",
      amount: fixed(Number(bareCooldownReducedMatch.groups.amount), "seconds"),
      duration: { kind: "while_source_active" }
    };
  }

  const usedIncreaseCooldownMatch = text.match(/^used,\s+increase its cooldown by (?<amount>[-+]?\d+(?:\.\d+)?) second(?:\(s\))?s?$/i);
  if (usedIncreaseCooldownMatch?.groups?.amount) {
    return {
      type: "modify_stat",
      target: itemSelector({ quantifier: "self", bindAs: "used_item" }),
      stat: { domain: "card", id: "cooldownSeconds" },
      op: "add",
      amount: fixed(Number(usedIncreaseCooldownMatch.groups.amount), "seconds")
    };
  }

  const cooldownMatch =
    text.match(/^(?<target>.+?)'?s?\s+cooldowns?\s+(?:is\s+|are\s+)?(?<direction>reduced|decreased|increased|halved)\s*(?:by\s+)?(?<amount>[-+]?\d+(?:\.\d+)?)?/i) ??
    text.match(/^(?<direction>reduce|decrease|increase)\s+(?<target>.+?)'?s?\s+cooldowns?\s+by\s+(?<amount>[-+]?\d+(?:\.\d+)?)/i) ??
    text.match(/^(?<target>.+?)\s+(?:have their cooldowns|has its cooldown|cooldowns?|item'?s cooldown|cooldown)\s+(?:are\s+)?(?<direction>reduced|decreased|increased|halved)\s*(?:by\s+)?(?<amount>[-+]?\d+(?:\.\d+)?)?/i);
  if (cooldownMatch?.groups?.target && cooldownMatch.groups.direction) {
    const amount = /\bfor each\b|\bfor every\b|\bper\b/i.test(text)
      ? valueReferenceFromText(text, tags, "seconds")
      : /halved/i.test(cooldownMatch.groups.direction)
        ? fixed(0.5)
        : fixed(cooldownMatch.groups.amount ? Number(cooldownMatch.groups.amount) : 0.5, /%/.test(text) ? "percent" : "seconds");
    return {
      type: "modify_stat",
      target: targetFromSubjectText(cooldownMatch.groups.target, tags),
      stat: { domain: "card", id: "cooldownSeconds" },
      op: /increase|increased/i.test(cooldownMatch.groups.direction) ? "add" : /halved/i.test(cooldownMatch.groups.direction) ? "multiply" : "subtract",
      amount: amount ?? fixed(0.5),
      duration: { kind: "while_source_active" }
    };
  }

  return null;
}

function parseBonusVariableClauses(texts: string[], tags: TagLike[]): { variables: SemanticVariable[]; clauses: SemanticClause[] } {
  const combined = texts.join(" ");
  if (!/\bthis gains\b[^.]*\bbonus\b/i.test(combined)) {
    return { variables: [], clauses: [] };
  }

  const statHint = statFromMechanic(mechanicFromText(combined));
  const defaultValue = amountFromText(combined.match(/\byour items have\b[^.]+/i)?.[0] ?? "", undefined);
  const variable: SemanticVariable = {
    id: "v_bonus",
    owner: "source_card",
    name: "bonus",
    valueType: "number",
    ...(defaultValue ? { defaultValue } : {}),
    ...(statHint ? { statHint, evidence: [{ source: "parser_inference", text: "bonus stat inferred from companion aura" }] } : {}),
    lifetime: "run"
  };

  const auraText = combined.match(/\byour items have\b[^.]+/i)?.[0] ?? "";
  const bonusText = combined.match(/\bwhen you sell\b[^.]*\bthis gains\b[^.]*\bbonus\b/i)?.[0] ?? combined;
  const amount = amountFromText(bonusText) ?? fixed(1);
  const sizeMatch = bonusText.match(/\b(small|medium|large)\b/i);
  const size = sizeMatch?.[1] ? (lower(sizeMatch[1]) as "small" | "medium" | "large") : undefined;
  const clauses: SemanticClause[] = [];

  if (statHint) {
    clauses.push(withClauseText({
      id: "c_bonus_aura",
      kind: "aura",
      actions: [
        {
          node: "atomic",
          action: {
            type: "modify_stat",
            target: itemSelector({ quantifier: "all" }),
            stat: statHint,
            op: "add",
            amount: { kind: "variable", ref: { variableId: "v_bonus" } },
            duration: { kind: "while_source_active" }
          }
        }
      ],
      confidence: "medium",
      warnings: [warning("ATTRIBUTE_INFERRED_FROM_TAG", "The bonus attribute is inferred from the companion aura text.", "info", auraText)]
    }, auraText));
  }

  clauses.push(withClauseText({
    id: "c_bonus_sell",
    kind: "triggered",
    trigger: {
      event: "item_sold",
      actor: playerSelector("self"),
      subject: itemSelector({ predicates: size ? atom({ kind: "has_size", size }) : undefined }),
      sourceEventText: "when you sell"
    },
    actions: [{ node: "atomic", action: { type: "modify_variable", variable: { variableId: "v_bonus" }, op: "add", amount } }],
    confidence: statHint ? "medium" : "low"
  }, bonusText));

  return { variables: [variable], clauses };
}

function parseWouldBeDefeated(text: string, index: number, tags: TagLike[]): SemanticClause | null {
  if (!/\bwould be defeated\b/i.test(text)) {
    return null;
  }

  const actions: ActionNode[] = [
    { node: "atomic", action: { type: "prevent_damage", target: playerSelector("self"), duration: { kind: "instant" } } }
  ];
  const healAmount = /\bheal\b/i.test(text) ? amountFromText(text) : undefined;
  if (healAmount) {
    actions.push({ node: "atomic", action: { type: "apply_effect", mechanic: "heal", target: playerSelector("self"), amount: healAmount } });
  }

  return {
    id: `c_${index}_would_be_defeated`,
    kind: "replacement",
    activeIn: ["combat"],
    trigger: { event: "would_be_defeated", actor: playerSelector("self"), sourceEventText: "would be defeated" },
    ...(/\bfirst time\b.*\beach fight\b/i.test(text)
      ? { limiter: { kind: "once", reset: "fight", consume: "on_trigger_match" } as const }
      : {}),
    actions: actions.length === 1 ? actions : [{ node: "sequence", actions }],
    confidence: "medium"
  };
}

function parseSimpleClause(text: string, index: number, tags: TagLike[]): SemanticClause {
  const multiplierCompound = splitStatMultiplierCompoundAction(text);
  if (multiplierCompound && multiplierCompound.length > 1) {
    return {
      id: `c_${index}_stat_aura`,
      kind: "aura",
      actions: [{ node: "parallel", actions: multiplierCompound.flatMap((part) => parseActionNodes(part, tags)).flatMap(flattenActionNodes) }],
      confidence: "medium"
    };
  }

  if (/^\s*(gain|shield|heal|burn|poison|regen|deal)\b/i.test(text)) {
    const compound = splitSemanticActionText(text);
    if (compound.length > 1) {
      return {
        id: `c_${index}_compound_action`,
        kind: "activated",
        actions: [{ node: "parallel", actions: compound.flatMap((part) => parseActionNodes(part, tags)).flatMap(flattenActionNodes) }],
        confidence: "medium"
      };
    }

    const directAction = parseApplyAction(text, tags);
    if (directAction.type !== "unknown") {
      return {
        id: `c_${index}_unknown`,
        kind: "activated",
        actions: [{ node: "atomic", action: directAction }],
        confidence: "medium"
      };
    }
  }

  const statAction = parseStatAuraAction(text, tags);
  if (statAction) {
    return {
      id: `c_${index}_stat_aura`,
      kind: "aura",
      actions: [{ node: "atomic", action: statAction }],
      confidence: "medium"
    };
  }

  const action = parseApplyAction(text, tags);
  return {
    id: `c_${index}_unknown`,
    kind: action.type === "unknown" ? "declarative" : "activated",
    actions: [{ node: "atomic", action }],
    confidence: action.type === "unknown" ? "low" : "medium",
    ...(action.type === "unknown"
      ? { warnings: [warning("UNSUPPORTED_SEMANTIC_PARSE", "No semantic parser rule matched this tooltip text.", "info", text)] }
      : {})
  };
}

function collectExtractedTags(clauses: SemanticClause[], variables: SemanticVariable[]): ExtractedTags {
  const itemTypes = new Set<ItemType>();
  const mechanics = new Set<MechanicKeyword>();
  const statuses = new Set<StatusFlag>();
  const playerStates = new Set<string>();
  const sizes = new Set<string>();
  const zones = new Set<string>();

  const visitPredicate = (predicate: EntityPredicate | EffectPredicate | SemanticPredicate): void => {
    if ("domain" in predicate) {
      if (predicate.domain === "player_state") {
        playerStates.add(String(predicate.state));
      } else if (predicate.domain === "entity" || predicate.domain === "effect") {
        visitPredicate(predicate.predicate);
      }
      return;
    }
    if (predicate.kind === "has_item_type") itemTypes.add(predicate.type);
    if (predicate.kind === "has_mechanic") mechanics.add(predicate.mechanic);
    if (predicate.kind === "has_status") statuses.add(predicate.status);
    if (predicate.kind === "has_size") sizes.add(predicate.size);
    if (predicate.kind === "count_compare") visitEntitySelector(predicate.selector);
  };

  const visitBool = <T extends EntityPredicate | EffectPredicate | SemanticPredicate>(expr: BoolExpr<T> | undefined): void => {
    if (!expr) return;
    if (expr.op === "atom") {
      visitPredicate(expr.atom);
    } else if (expr.op === "not") {
      visitBool(expr.expr);
    } else {
      expr.exprs.forEach(visitBool);
    }
  };

  const visitEntitySelector = (selector: EntitySelector | undefined): void => {
    if (!selector) return;
    if (selector.zone) zones.add(selector.zone);
    visitBool<EntityPredicate>(selector.predicates);
  };

  const visitEffectSelector = (selector: EffectSelector | undefined): void => {
    if (!selector) return;
    visitBool<EffectPredicate>(selector.predicates);
  };

  const visitValue = (value: ValueExpr | undefined): void => {
    if (!value) return;
    if (value.kind === "stat") visitEntitySelector(value.source);
    if (value.kind === "stat_aggregate") visitEntitySelector(value.source);
    if (value.kind === "count") visitEntitySelector(value.selector);
    if (value.kind === "scale") visitValue(value.value);
    if (value.kind === "formula") value.args.forEach(visitValue);
  };

  const visitAction = (action: SemanticAction): void => {
    if (action.type === "apply_effect") {
      mechanics.add(action.mechanic);
      visitEntitySelector(action.target);
      visitValue(action.amount);
    } else if (action.type === "modify_stat") {
      const mechanic = mechanicFromStatRef(action.stat);
      if (mechanic) mechanics.add(mechanic);
      visitEntitySelector(action.target);
      visitValue(action.amount);
    } else if (action.type === "modify_status") {
      statuses.add(action.status);
      visitEntitySelector(action.target);
    } else if (action.type === "modify_status_duration") {
      statuses.add(action.status);
      visitEntitySelector(action.target);
      visitValue(action.amount);
    } else if (action.type === "modify_tags") {
      visitEntitySelector(action.target);
      visitEntitySelector(action.source);
      visitValue(action.amount);
    } else if (action.type === "modify_previous_action_value") {
      visitValue(action.amount);
    } else if (action.type === "reset_variable") {
      visitEntitySelector(action.target);
    } else if (action.type === "start_sandstorm") {
      visitEntitySelector(action.target);
    } else if (action.type === "redirect") {
      visitEntitySelector(action.target);
      visitEntitySelector(action.replacement);
    } else if (action.type === "gain_item") {
      visitEntitySelector(action.item);
      visitValue(action.amount);
    } else if (action.type === "transform_item") {
      visitEntitySelector(action.target);
      visitEntitySelector(action.into);
      visitValue(action.amount);
    } else if (action.type === "enchant_item" || action.type === "upgrade_item") {
      visitEntitySelector(action.target);
    } else if (action.type === "modify_slot") {
      visitEntitySelector(action.target);
      action.linkedEffects?.forEach(visitClause);
    } else if (action.type === "modify_effect") {
      visitEffectSelector(action.target);
    } else if (action.type === "add_player_state") {
      playerStates.add(action.state);
      visitEntitySelector(action.target);
    }
  };

  const visitNode = (node: ActionNode): void => {
    if (node.node === "atomic") {
      visitAction(node.action);
    } else if (node.node === "conditional") {
      visitBool(node.if);
      node.then.forEach(visitNode);
      node.else?.forEach(visitNode);
    } else {
      node.actions.forEach(visitNode);
    }
  };

  const visitClause = (clause: SemanticClause): void => {
    visitBool(clause.condition);
    visitEntitySelector(clause.trigger?.subject);
    visitEntitySelector(clause.trigger?.object);
    clause.actions.forEach(visitNode);
  };

  clauses.forEach(visitClause);
  variables.forEach((variable) => {
    if (variable.statHint) {
      const mechanic = mechanicFromText(variable.statHint.id);
      if (mechanic) mechanics.add(mechanic);
    }
  });

  return {
    itemTypes: [...itemTypes].sort(),
    mechanics: [...mechanics].sort(),
    statuses: [...statuses].sort(),
    playerStates: [...playerStates].sort(),
    sizes: [...sizes].sort(),
    rarities: [],
    zones: [...zones].sort()
  };
}

function effectEventFromSemantic(event: EventName | undefined): EffectEvent {
  switch (event) {
    case "fight_started":
      return "combat_start";
    case "fight_ended":
      return "fight_end";
    case "item_used":
      return "item_used";
    case "card_fired":
      return "cooldown_ready";
    case "item_sold":
      return "sell";
    case "item_bought":
      return "buy";
    case "item_transformed":
      return "transformed";
    case "item_destroyed":
      return "destroyed";
    case "ammo_empty":
      return "ammo_empty";
    case "combat_won":
      return "win";
    case "combat_lost":
      return "lose";
    case "crit":
      return "crit";
    case "enraged":
      return "enrage";
    case "status_ended":
      return "status_ended";
    case "merchant_visited":
      return "merchant";
    case "day_started":
      return "level_up";
    case "health_threshold_crossed":
      return "player_attribute_threshold";
    case "would_be_defeated":
      return "would_be_defeated";
    case "effect_applied":
      return "effect_applied";
    default:
      return "unknown";
  }
}

function effectEventFromSemanticEffectPredicate(predicate: BoolExpr<EffectPredicate> | undefined): EffectEvent {
  if (!predicate) return "unknown";
  if (predicate.op === "atom" && predicate.atom.kind === "has_mechanic") {
    switch (predicate.atom.mechanic) {
      case "burn":
        return "apply_burn";
      case "poison":
        return "apply_poison";
      case "shield":
        return "gain_shield";
      case "heal":
        return "heal";
      case "damage":
        return "deal_damage";
      default:
        return "unknown";
    }
  }
  if (predicate.op === "and" || predicate.op === "or") {
    for (const expr of predicate.exprs) {
      const event = effectEventFromSemanticEffectPredicate(expr);
      if (event !== "unknown") return event;
    }
  }
  if (predicate.op === "not") return effectEventFromSemanticEffectPredicate(predicate.expr);
  return "unknown";
}

function statusFromPredicate(expr: BoolExpr<EntityPredicate> | undefined): string | undefined {
  if (!expr) return undefined;
  if (expr.op === "atom" && expr.atom.kind === "has_status") return expr.atom.status;
  if (expr.op === "and" || expr.op === "or") {
    for (const part of expr.exprs) {
      const status = statusFromPredicate(part);
      if (status) return status;
    }
  }
  if (expr.op === "not") return statusFromPredicate(expr.expr);
  return undefined;
}

function structuredTriggerTypeFromSourceEvent(sourceEvent: EffectEvent): StructuredTriggerType {
  switch (sourceEvent) {
    case "combat_start":
      return "TTriggerOnFightStarted";
    case "fight_end":
      return "TTriggerOnFightEnded";
    case "item_used":
      return "TTriggerOnItemUsed";
    case "buy":
      return "TTriggerOnCardPurchased";
    case "sell":
      return "TTriggerOnCardSold";
    case "level_up":
      return "TTriggerOnCardUpgraded";
    case "transformed":
      return "TTriggerOnCardTransformed";
    case "win":
      return "TTriggerOnCombatWon";
    case "lose":
      return "TTriggerOnCombatLost";
    case "ammo_empty":
      return "TTriggerOnCardAmmoEmpty";
    case "destroyed":
      return "TTriggerOnCardDestroyed";
    case "merchant":
      return "TTriggerOnMerchantVisited";
    case "crit":
      return "TTriggerOnCardCritted";
    case "enrage":
      return "TTriggerOnEnrage";
    case "status_ended":
      return "TTriggerOnStatusEnded";
    case "would_be_defeated":
      return "TTriggerOnPlayerWouldBeDefeated";
    case "player_attribute_threshold":
      return "TTriggerOnPlayerAttributeThresholdCrossed";
    case "apply_burn":
      return "TTriggerOnCardPerformedBurn";
    case "apply_poison":
      return "TTriggerOnCardPerformedPoison";
    case "gain_shield":
      return "TTriggerOnCardPerformedShield";
    case "heal":
      return "TTriggerOnCardPerformedHeal";
    case "deal_damage":
      return "TTriggerOnCardPerformedDamage";
    case "effect_applied":
      return "TTriggerOnEffectApplied";
    default:
      return "TTriggerUnknown";
  }
}

function structuredActionTypeForStat(stat: StatRef | undefined): StructuredActionType {
  return stat?.domain === "player" ? "TActionPlayerModifyAttribute" : "TActionCardModifyAttribute";
}

function structuredAttributeFromStatRef(stat: StatRef | undefined): StructuredAttributeType | undefined {
  switch (stat?.id) {
    case "damageAmount":
      return "DamageAmount";
    case "burnAmount":
      return "Burn";
    case "poisonAmount":
      return "Poison";
    case "shieldAmount":
      return "Shield";
    case "healAmount":
      return "HealAmount";
    case "regenAmount":
      return "RegenApplyAmount";
    case "cooldownSeconds":
    case "cooldownReduction":
      return "CooldownMax";
    case "critChance":
      return "CritChance";
    case "critDamage":
      return "CritDamage";
    case "multicast":
      return "Multicast";
    case "ammo":
      return "AmmoMax";
    case "value":
      return "Value";
    case "sellPrice":
      return "SellPrice";
    case "buyPrice":
      return "BuyPrice";
    case "gold":
      return "Gold";
    case "income":
      return "Income";
    case "prestige":
      return "Prestige";
    case "experience":
      return "Experience";
    case "maxHealth":
      return "HealthMax";
    case "health":
      return "Health";
    case "rageGain":
      return "Rage";
    case "rageRequirement":
      return "RageRequirement";
    case "rerollCost":
      return "RerollCost";
    case "durationSeconds":
      return "EffectDuration";
    case "chargeSeconds":
      return "ChargeAmount";
    default:
      return undefined;
  }
}

function structuredTargetFromSelector(selector: EntitySelector | undefined): StructuredTarget | undefined {
  if (!selector) return undefined;
  const conditions = structuredConditionsFromEntityPredicate(selector.predicates);
  const withConditions = <T extends StructuredTarget>(target: T): T => (
    conditions?.length && target.$type.startsWith("TTargetCard")
      ? { ...target, Conditions: conditions } as T
      : target
  );

  if (selector.entity === "player" || selector.entity === "merchant" || selector.entity === "shop") {
    return { $type: "TTargetPlayerRelative", TargetMode: selector.owner === "enemy" ? "Opponent" : selector.owner === "any" ? "Both" : "Self" };
  }

  if (selector.entity === "slot") {
    return {
      $type: selector.quantifier === "one" || selector.quantifier === "random" ? "TTargetBoardSlotRandom" : "TTargetBoardSlotSection",
      TargetSection: selector.owner === "enemy" ? "OpponentBoard" : selector.owner === "any" ? "AllBoards" : "SelfBoard"
    };
  }

  if (selector.position === "adjacent") return withConditions({ $type: "TTargetCardPositional", TargetMode: "Neighbor" });
  if (selector.position === "left") return withConditions({ $type: "TTargetCardPositional", TargetMode: "LeftCard" });
  if (selector.position === "right") return withConditions({ $type: "TTargetCardPositional", TargetMode: "RightCard" });
  if (selector.position === "leftmost") return withConditions({ $type: "TTargetCardXMost", TargetMode: "LeftMostCard" });
  if (selector.position === "rightmost") return withConditions({ $type: "TTargetCardXMost", TargetMode: "RightMostCard" });
  if (selector.bindAs === "trigger_source") return withConditions({ $type: "TTargetCardTriggerSource" });
  if (selector.quantifier === "self") return withConditions({ $type: "TTargetCardSelf" });

  return withConditions({
    $type: selector.quantifier === "one" || selector.quantifier === "random" ? "TTargetCardRandom" : "TTargetCardSection",
    TargetSection: selector.owner === "enemy" ? "OpponentBoard" : selector.owner === "any" ? "AllBoards" : "SelfHand",
    ...(selector.excludeSelf ? { ExcludeSelf: true } : {})
  });
}

function structuredTagExprFromPredicate(expr: BoolExpr<EntityPredicate>): StructuredTagExpr | undefined {
  if (expr.op === "atom") {
    if (expr.atom.kind === "has_item_type") return { $type: "HasTag", Tag: expr.atom.type };
    if (expr.atom.kind === "has_mechanic") return { $type: "HasTag", Tag: expr.atom.mechanic };
    if (expr.atom.kind === "has_status") return { $type: "HasTag", Tag: expr.atom.status };
    return undefined;
  }

  if (expr.op === "not") {
    const inner = structuredTagExprFromPredicate(expr.expr);
    if (!inner) return undefined;
    if (inner.$type === "AnyOf" || inner.$type === "AllOf") return { $type: "NoneOf", Tags: inner.Tags };
    if (inner.$type === "HasTag") return { $type: "NoneOf", Tags: [inner.Tag] };
    return { $type: "Not", Expr: inner };
  }

  const inner = expr.exprs.map(structuredTagExprFromPredicate).filter((item): item is StructuredTagExpr => Boolean(item));
  if (inner.length === 0) return undefined;
  const tags = inner.flatMap((item) => item.$type === "HasTag" ? [item.Tag] : "Tags" in item ? item.Tags : []);
  if (tags.length === inner.length) {
    return { $type: expr.op === "or" ? "AnyOf" : "AllOf", Tags: [...new Set(tags)] };
  }
  return { $type: expr.op === "or" ? "Or" : "And", Exprs: inner };
}

function structuredConditionFromPredicate(expr: BoolExpr<EntityPredicate> | undefined): StructuredCondition | undefined {
  if (!expr) return undefined;
  if (expr.op === "atom" && expr.atom.kind === "has_status") {
    return { $type: "TCardConditionalStatus", Status: expr.atom.status };
  }
  if (expr.op === "atom" && expr.atom.kind === "has_size") {
    return { $type: "TCardConditionalSize", Sizes: [expr.atom.size === "small" ? 1 : expr.atom.size === "medium" ? 2 : 3] };
  }
  if (expr.op === "atom" && expr.atom.kind === "tier_compare") {
    return {
      $type: "TCardConditionalTierComparison",
      ComparisonOperator: expr.atom.cmp === "lte" ? "LessThanOrEqual" : expr.atom.cmp === "lt" ? "LessThan" : expr.atom.cmp === "gte" ? "GreaterThanOrEqual" : expr.atom.cmp === "gt" ? "GreaterThan" : "Equal",
      Reference: structuredTargetFromSelector(expr.atom.reference) ?? { $type: "TTargetCardSelf" }
    };
  }

  const tagExpr = structuredTagExprFromPredicate(expr);
  return tagExpr ? { $type: "TCardConditionalTagExpr", Expr: tagExpr } : undefined;
}

function structuredConditionsFromEntityPredicate(expr: BoolExpr<EntityPredicate> | undefined): StructuredCondition[] | undefined {
  if (!expr) return undefined;
  if (expr.op === "and") {
    const conditions = expr.exprs.flatMap((child) => structuredConditionsFromEntityPredicate(child) ?? []);
    return conditions.length > 0 ? conditions : undefined;
  }
  const condition = structuredConditionFromPredicate(expr);
  return condition ? [condition] : undefined;
}

function playerTargetFromOwner(owner: Owner | undefined): StructuredTarget {
  return { $type: "TTargetPlayerRelative", TargetMode: owner === "enemy" ? "Opponent" : owner === "any" ? "Both" : "Self" };
}

function structuredPlayerStateFromSemanticState(state: StatusFlag | string): { stateType: "FactionMembership" | "PlayerTag" | "PlayerFlag" | "PlayerStatus"; stateValue: string } {
  const value = String(state);
  if (value.includes(":")) {
    const [type, stateValue] = value.split(/:(.+)/, 2);
    if (type === "FactionMembership" || type === "PlayerFlag" || type === "PlayerStatus" || type === "PlayerTag") {
      return { stateType: type, stateValue };
    }
    return { stateType: "PlayerTag", stateValue };
  }

  if (/^in_?play$/i.test(value)) {
    return { stateType: "PlayerFlag", stateValue: "InPlay" };
  }

  if (statusFromText(value) || /^(burn|poison|shielded)$/i.test(value)) {
    return { stateType: "PlayerStatus", stateValue: lower(value) };
  }

  return { stateType: "PlayerTag", stateValue: value };
}

function structuredConditionsFromSemanticPredicate(expr: BoolExpr<SemanticPredicate> | undefined): StructuredCondition[] | undefined {
  if (!expr) return undefined;
  if (expr.op === "atom") {
    const predicate = expr.atom;
    if (predicate.domain === "entity") {
      return structuredConditionsFromEntityPredicate({ op: "atom", atom: predicate.predicate });
    }
    if (predicate.domain === "player_state") {
      const { stateType, stateValue } = structuredPlayerStateFromSemanticState(predicate.state);
      return [{
        $type: "TPlayerConditionalState",
        Target: playerTargetFromOwner(predicate.owner),
        StateType: stateType,
        StateValue: { $type: "TIdentifierValue", Value: stateValue }
      }];
    }
    return [{ $type: "TConditionUnknown", Text: `Unsupported semantic condition domain: ${predicate.domain}` }];
  }

  if (expr.op === "not") {
    const inner = structuredConditionsFromSemanticPredicate(expr.expr);
    if (!inner || inner.length !== 1) return [{ $type: "TConditionUnknown", Text: "Negated compound semantic condition requires boolean condition IR." }];
    return [negateStructuredCondition(inner[0])];
  }

  const conditions = expr.exprs.flatMap((child) => structuredConditionsFromSemanticPredicate(child) ?? []);
  if (conditions.length === 0) return undefined;
  if (expr.op === "and") return conditions;
  return [{ $type: "TConditionUnknown", Text: "Semantic OR condition requires boolean condition IR." }];
}

function negateStructuredCondition(condition: StructuredCondition): StructuredCondition {
  if (condition.$type === "TCardConditionalTag" || condition.$type === "TCardConditionalSize" || condition.$type === "TPlayerConditionalState" || condition.$type === "TCardConditionalStatus") {
    return { ...condition, IsNot: !condition.IsNot };
  }
  if (condition.$type === "TCardConditionalTagExpr") {
    return { $type: "TCardConditionalTagExpr", Expr: { $type: "Not", Expr: condition.Expr } };
  }
  return { $type: "TConditionUnknown", Text: `Negated ${condition.$type} condition requires boolean condition IR.` };
}

function structuredValueFromValueExpr(value: ValueExpr | undefined): StructuredValue | undefined {
  if (!value) return undefined;
  if (value.kind === "fixed") return { $type: "TFixedValue", Value: value.value };
  if (value.kind === "range") return { $type: "TRangeValue", MinValue: value.min, MaxValue: value.max };
  if (value.kind === "variable") return { $type: "TVariableValue", VariableId: value.ref.variableId };
  if (value.kind === "identifier") return { $type: "TIdentifierValue", Value: value.value };
  if (value.kind === "scale") {
    const inner = structuredValueFromValueExpr(value.value);
    return {
      $type: "TExpressionValue",
      Operator: "Multiply",
      Values: [{ $type: "TFixedValue", Value: value.factor }, ...(inner ? [inner] : [])]
    };
  }
  if (value.kind === "formula") {
    const values = value.args.map(structuredValueFromValueExpr).filter((entry): entry is StructuredValue => Boolean(entry));
    const operator = value.op === "add" ? "Add" : value.op === "sub" ? "Subtract" : value.op === "mul" ? "Multiply" : value.op === "div" ? "Divide" : value.op === "min" ? "Min" : "Max";
    return { $type: "TExpressionValue", Operator: operator, Values: values };
  }
  if (value.kind === "stat") {
    const target = structuredTargetFromSelector(value.source) ?? { $type: "TTargetUnknown" as const };
    const attribute = structuredAttributeFromStatRef(value.stat) ?? "Unknown";
    if (value.stat.domain === "player" || value.source.entity === "player") {
      return {
        $type: "TReferenceValuePlayerAttribute",
        Target: target,
        AttributeType: attribute
      };
    }
    return {
      $type: "TReferenceValueCardAttribute",
      Target: target,
      AttributeType: attribute
    };
  }
  if (value.kind === "stat_aggregate") {
    const target = structuredTargetFromSelector(value.source) ?? { $type: "TTargetUnknown" as const };
    return {
      $type: "TReferenceValueCardAttributeAggregate",
      Target: target,
      AttributeType: structuredAttributeFromStatRef(value.stat) ?? "Unknown"
    };
  }
  if (value.kind === "stat_change") {
    return {
      $type: "TReferenceValuePlayerAttributeChange",
      AttributeType: structuredAttributeFromStatRef(value.stat) ?? "Unknown"
    };
  }
  if (value.kind === "count") {
    return {
      $type: "TReferenceValueCardCount",
      Target: structuredTargetFromSelector(value.selector) ?? { $type: "TTargetUnknown" as const }
    };
  }
  return undefined;
}

function structuredEffectPredicate(selector: EffectSelector): StructuredEffectPredicate | undefined {
  const predicate = selector.predicates;
  if (!predicate) return undefined;
  if (predicate.op === "atom") {
    if (predicate.atom.kind === "has_mechanic") return { $type: "TEffectPredicateFamily", Family: predicate.atom.mechanic };
    if (predicate.atom.kind === "field_exists") {
      return {
        $type: "TEffectPredicateAttribute",
        AttributeType: predicate.atom.field === "durationSeconds" ? "EffectDuration" : "EffectMagnitude"
      };
    }
  }
  if (predicate.op === "not") {
    const inner = structuredEffectPredicate({ ...selector, predicates: predicate.expr });
    return inner ? { $type: "TEffectPredicateNot", Predicate: inner } : undefined;
  }
  if (predicate.op !== "and" && predicate.op !== "or") {
    return undefined;
  }
  const inner = predicate.exprs
    .map((entry: BoolExpr<EffectPredicate>) => structuredEffectPredicate({ ...selector, predicates: entry }))
    .filter((item: StructuredEffectPredicate | undefined): item is StructuredEffectPredicate => Boolean(item));
  return inner.length > 0 ? { $type: predicate.op === "or" ? "TEffectPredicateOr" : "TEffectPredicateAnd", Predicates: inner } : undefined;
}

function actionTypeFromMechanic(mechanic: MechanicKeyword): EffectActionType {
  switch (mechanic) {
    case "damage":
      return "damage";
    case "burn":
      return "burn";
    case "poison":
      return "poison";
    case "shield":
      return "shield";
    case "heal":
      return "heal";
    case "regen":
      return "regen";
    case "haste":
      return "haste";
    case "slow":
      return "slow";
    case "freeze":
      return "freeze";
    case "charge":
      return "charge";
    case "multicast":
      return "multicast";
    case "lifesteal":
      return "lifesteal";
    case "reload":
      return "reload";
    case "destroy":
      return "destroy";
    case "cooldown":
      return "reduce_cooldown";
    case "flying":
      return "flying";
    default:
      return "unknown";
  }
}

function tagFromPredicate(expr: BoolExpr<EntityPredicate> | undefined): string | undefined {
  if (!expr) return undefined;
  if (expr.op === "atom") {
    if (expr.atom.kind === "has_item_type") return expr.atom.type;
    if (expr.atom.kind === "has_mechanic") return expr.atom.mechanic;
    if (expr.atom.kind === "has_status") return expr.atom.status;
    return undefined;
  }
  return undefined;
}

function scopeFromSelector(selector: EntitySelector | undefined): "self" | "enemy" | "adjacent" | "left" | "right" | "leftmost" | "rightmost" | "allied_items" | "enemy_items" | "random" | "unknown" {
  if (!selector) return "unknown";
  if (selector.entity === "player") return selector.owner === "enemy" ? "enemy" : "self";
  if (selector.quantifier === "self") return "self";
  if (selector.position === "adjacent") return "adjacent";
  if (selector.position === "left") return "left";
  if (selector.position === "right") return "right";
  if (selector.position === "leftmost") return "leftmost";
  if (selector.position === "rightmost") return "rightmost";
  if (selector.quantifier === "random") return "random";
  if (selector.entity === "item") return selector.owner === "enemy" ? "enemy_items" : "allied_items";
  return "unknown";
}

function fixedValueFromValueExpr(value: ValueExpr | undefined): number | undefined {
  if (!value) return undefined;
  if (value.kind === "fixed") return value.value;
  return undefined;
}

function unknownStructuredEffect(clause: SemanticClause, index: number, warningText: string): StructuredEffect {
  return {
    id: `semantic-${index}`,
    kind: clause.kind === "aura" || clause.kind === "modifier" || clause.kind === "declarative" ? "aura" : "ability",
    activeIn: "hand_only",
    action: { $type: "TActionUnknown", SourceAction: "unknown" },
    semanticSourceIds: [clause.id],
    projectionStatus: "unsupported",
    projectionWarnings: [warningText],
    rawText: warningText
  };
}

function structuredTriggerFromClause(clause: SemanticClause): StructuredEffect["trigger"] | undefined {
  if (clause.kind === "aura" || clause.kind === "modifier" || clause.kind === "declarative") {
    return undefined;
  }

  const semanticSourceEvent = effectEventFromSemantic(clause.trigger?.event);
  const effectAppliedSourceEvent =
    clause.trigger?.event === "effect_applied" ? effectEventFromSemanticEffectPredicate(clause.trigger.object?.predicates as BoolExpr<EffectPredicate> | undefined) : "unknown";
  const sourceEvent = semanticSourceEvent === "unknown" && effectAppliedSourceEvent !== "unknown" ? effectAppliedSourceEvent : semanticSourceEvent;
  const subject = structuredTargetFromSelector(clause.trigger?.subject);
  let triggerType: StructuredTriggerType = structuredTriggerTypeFromSourceEvent(sourceEvent);
  if (clause.kind === "activated") {
    triggerType = "TTriggerOnCardFired";
  }
  const threshold = structuredValueFromValueExpr(clause.trigger?.threshold?.value);
  const triggerStatus = clause.trigger?.event === "status_ended" ? statusFromPredicate(clause.trigger.object?.predicates) : undefined;
  const triggerEffectPredicate =
    clause.trigger?.event === "effect_applied"
      ? structuredEffectPredicate({
          entity: "effect_instance",
          predicates: clause.trigger.object?.predicates as BoolExpr<EffectPredicate> | undefined
        })
      : undefined;
  const limiterReset = clause.limiter?.kind === "once" || clause.limiter?.kind === "first_n"
    ? clause.limiter.reset === "fight"
      ? "Fight"
      : clause.limiter.reset === "day"
        ? "Day"
        : clause.limiter.reset === "run"
          ? "Run"
          : clause.limiter.reset === "encounter"
            ? "Encounter"
            : "Never"
    : undefined;
  const base: StructuredTrigger = {
    $type: triggerType,
    SourceEvent: clause.kind === "activated" && sourceEvent === "unknown" ? "cooldown_ready" : sourceEvent,
    ...(subject ? { Subject: subject } : {}),
    ...(triggerStatus ? { Status: triggerStatus } : {}),
    ...(triggerEffectPredicate ? { EffectPredicate: triggerEffectPredicate } : {}),
    ...(clause.limiter?.kind === "once" && limiterReset
      ? { Limit: { Mode: "First", Count: 1, Reset: limiterReset, Scope: "SourceEffectInstance" } as const }
      : clause.limiter?.kind === "first_n" && clause.limiter.count.kind === "fixed"
        ? { Limit: { Mode: "MaxTimes", Count: clause.limiter.count.value, Reset: limiterReset ?? "Never", Scope: "SourceEffectInstance" } as const }
      : {}),
    ...(clause.trigger?.event === "health_threshold_crossed"
      ? {
          AttributeType: structuredAttributeFromStatRef(clause.trigger.threshold?.attribute) ?? "Health",
          ...(threshold ? { Threshold: threshold } : {}),
          Crossing: "FromAtOrAboveToBelow" as const
        }
      : {})
  };

  const tag = tagFromPredicate(clause.trigger?.subject?.predicates);
  return {
    ...base,
    ...(tag ? { Tag: tag } : {})
  };
}

function structuredEffectBase(
  clause: SemanticClause,
  index: number
): Pick<StructuredEffect, "id" | "kind" | "activeIn" | "semanticSourceIds" | "rawText"> & Partial<Pick<StructuredEffect, "trigger" | "prerequisites">> {
  const trigger = structuredTriggerFromClause(clause);
  const prerequisites = structuredConditionsFromSemanticPredicate(clause.condition);
  return {
    id: `semantic-${index}`,
    kind: clause.kind === "aura" || clause.kind === "modifier" || clause.kind === "declarative" ? "aura" : "ability",
    activeIn: "hand_only",
    ...(trigger ? { trigger } : {}),
    ...(prerequisites?.length ? { prerequisites } : {}),
    semanticSourceIds: [clause.id],
    rawText: clause.trigger?.sourceEventText ?? ""
  };
}

function projectActionNode(clause: SemanticClause, node: ActionNode, index: number): StructuredEffect {
  if (node.node !== "atomic") {
    return unknownStructuredEffect(clause, index, "Compound semantic action graph reached single-effect projection unexpectedly.");
  }

  const action = node.action;
  const base = structuredEffectBase(clause, index);
  const projectionStatusWithWarnings = (status: NonNullable<StructuredEffect["projectionStatus"]>): NonNullable<StructuredEffect["projectionStatus"]> =>
    status === "unsupported" ? "unsupported" : clause.warnings?.length ? "lossy" : status;
  const projectionWarnings = clause.warnings?.map((item) => item.message);

  if (action.type === "modify_slot") {
    return {
      ...base,
      action: {
        $type: "TActionBoardSlotSetTerrain",
        SourceAction: "modify_slot",
        Target: structuredTargetFromSelector(action.target),
        Terrain: action.terrain,
        OccupantStatusHint: action.linkedEffects?.flatMap((linked) =>
          linked.actions.flatMap((child) => child.node === "atomic" && child.action.type === "modify_status" ? [child.action.status] : [])
        )[0]
      },
      projectionStatus: projectionStatusWithWarnings("exact"),
      projectionWarnings
    };
  }

  if (action.type === "modify_effect") {
    const predicate = structuredEffectPredicate(action.target);
    const rounding = action.transform.kind === "scale" ? action.transform.rounding : undefined;
    return {
      ...base,
      action: {
        $type: "TActionEffectModify",
        SourceAction: "modify_effect",
        AttributeType: action.transform.field === "durationSeconds" ? "EffectDuration" : action.transform.field === "triggerCount" ? "EffectTrigger" : "EffectMagnitude",
        Operation: action.transform.kind === "scale" ? "Multiply" : action.transform.kind === "add" ? "Add" : "Set",
        ...(action.transform.kind === "scale"
          ? { Value: { $type: "TFixedValue", Value: action.transform.factor } as StructuredValue }
          : { Value: structuredValueFromValueExpr(action.transform.value) }),
        Target: { $type: "TTargetEffect", Entity: action.target.entity === "effect_template" ? "EffectTemplate" : "EffectInstance", Owner: action.target.owner === "any" ? "Any" : action.target.owner === "enemy" ? "Opponent" : "Self", ...(predicate ? { Predicate: predicate } : {}) },
        ...(predicate ? { EffectPredicate: predicate } : {}),
        ...(rounding ? { Rounding: rounding === "unknown" ? "Unspecified" : rounding === "floor" ? "Floor" : rounding === "ceil" ? "Ceil" : "Nearest" } : {})
      },
      projectionStatus: projectionStatusWithWarnings("exact"),
      projectionWarnings
    };
  }

  if (action.type === "modify_status_duration") {
    return {
      ...base,
      action: {
        $type: "TActionStatusDurationModify",
        SourceAction: "modify_status_duration",
        AttributeType: "EffectDuration",
        Operation: action.op === "add" ? "Add" : action.op === "subtract" ? "Subtract" : action.op === "set" ? "Set" : "Multiply",
        Value: structuredValueFromValueExpr(action.amount),
        Target: {
          $type: "TTargetStatusApplication",
          Status: action.status,
          Target: structuredTargetFromSelector(action.target) ?? { $type: "TTargetPlayerRelative", TargetMode: "Self" }
        }
      },
      projectionStatus: projectionStatusWithWarnings("exact"),
      projectionWarnings
    };
  }

  if (action.type === "modify_tags") {
    return {
      ...base,
      action: {
        $type: "TActionCardAddTagsList",
        SourceAction: "buff_tag",
        Operation: "Add",
        Target: structuredTargetFromSelector(action.target),
        Value:
          action.op === "copy_from"
            ? { $type: "TIdentifierValue", Value: `copy_types:${action.description ?? "source"}` }
            : structuredValueFromValueExpr(action.amount),
        Tags: action.op === "add_random" ? ["random_type"] : ["copied_types"]
      },
      projectionStatus: "partial",
      projectionWarnings: [action.op === "copy_from" ? "IR captures type-copy semantics as dynamic tag copy sidecar; legacy tag list cannot enumerate copied tags." : "IR captures random type count but legacy tag list cannot enumerate random result."]
    };
  }

  if (action.type === "modify_status") {
    const tag = action.status.startsWith("tag:") ? action.status.slice("tag:".length) : undefined;
    return {
      ...base,
      action: {
        $type: tag ? "TActionCardAddTagsList" : "TActionStatusModify",
        SourceAction: tag ? "buff_tag" : "modify_status",
        Operation: action.op === "remove" ? "Subtract" : "Add",
        Target: structuredTargetFromSelector(action.target),
        ...(tag ? { Tags: [tag] } : { Status: action.status })
      },
      projectionStatus: projectionStatusWithWarnings("exact"),
      projectionWarnings
    };
  }

  if (action.type === "add_player_state") {
    const [stateType, stateValue] = action.state.includes(":") ? action.state.split(/:(.+)/, 2) : ["PlayerTag", action.state];
    return {
      ...base,
      action: {
        $type: "TActionPlayerModifyState",
        SourceAction: "modify_player_state",
        Target: structuredTargetFromSelector(action.target),
        StateType: stateType === "FactionMembership" ? "FactionMembership" : "PlayerTag",
        StateValue: { $type: "TIdentifierValue", Value: stateValue }
      },
      projectionStatus: projectionStatusWithWarnings("exact"),
      projectionWarnings
    };
  }

  if (action.type === "modify_variable") {
    return {
      ...base,
      groupId: action.variable.variableId,
      action: {
        $type: "TActionVariableModify",
        SourceAction: "modify_variable",
        VariableId: action.variable.variableId,
        Operation: action.op === "subtract" ? "Subtract" : action.op === "multiply" ? "Multiply" : action.op === "set" ? "Set" : "Add",
        Value: structuredValueFromValueExpr(action.amount)
      },
      projectionStatus: projectionStatusWithWarnings("exact"),
      projectionWarnings
    };
  }

  if (action.type === "modify_previous_action_value") {
    return {
      ...base,
      action: {
        $type: "TActionEffectModify",
        SourceAction: "modify_effect",
        AttributeType: "EffectValue",
        Operation: action.op === "subtract" ? "Subtract" : action.op === "set" ? "Set" : action.op === "add" ? "Add" : "Multiply",
        Value: structuredValueFromValueExpr(action.amount),
        Target: { $type: "TTargetEffect", Entity: "EffectInstance", Owner: "Self" }
      },
      projectionStatus: "partial",
      projectionWarnings: [action.description ?? "Modifies previous action value inferred from shorthand text."]
    };
  }

  if (action.type === "reset_variable") {
    return {
      ...base,
      groupId: action.variable?.variableId,
      action: {
        $type: "TActionVariableModify",
        SourceAction: "modify_variable",
        VariableId: action.variable?.variableId ?? "unknown_variable",
        Operation: "Set",
        Value: { $type: "TFixedValue", Value: 0 }
      },
      projectionStatus: "partial",
      projectionWarnings: [action.description ?? "Variable reset target is inferred from surrounding effect text."]
    };
  }

  if (action.type === "modify_stat") {
    return {
      ...base,
      action: {
        $type: structuredActionTypeForStat(action.stat),
        SourceAction: "gain_stat",
        AttributeType: structuredAttributeFromStatRef(action.stat) ?? "Unknown",
        Operation: action.op === "subtract" ? "Subtract" : action.op === "multiply" ? "Multiply" : action.op === "set" ? "Set" : "Add",
        Value: structuredValueFromValueExpr(action.amount),
        Target: structuredTargetFromSelector(action.target)
      },
      projectionStatus: projectionStatusWithWarnings("exact"),
      projectionWarnings
    };
  }

  if (action.type === "destroy_item") {
    return {
      ...base,
      action: {
        $type: "TActionCardDestroy",
        SourceAction: "destroy",
        Target: structuredTargetFromSelector(action.target)
      },
      projectionStatus: projectionStatusWithWarnings("exact"),
      projectionWarnings
    };
  }

  if (action.type === "gain_item") {
    return {
      ...base,
      action: {
        $type: "TActionGameSpawnCards",
        SourceAction: "gain_item",
        Target: structuredTargetFromSelector(action.item),
        Value: structuredValueFromValueExpr(action.amount)
      },
      projectionStatus: action.description ? "partial" : "exact",
      projectionWarnings: action.description ? [`Generated item description preserved from text: ${action.description}`] : undefined
    };
  }

  if (action.type === "transform_item") {
    return {
      ...base,
      action: {
        $type: "TActionCardTransform",
        SourceAction: "transform",
        Target: structuredTargetFromSelector(action.target),
        Value: action.description ? { $type: "TIdentifierValue", Value: action.description } : structuredValueFromValueExpr(action.amount)
      },
      projectionStatus: "partial",
      projectionWarnings: action.description ? [`Transform destination preserved from text: ${action.description}`] : undefined
    };
  }

  if (action.type === "enchant_item") {
    return {
      ...base,
      action: {
        $type: "TActionCardEnchant",
        SourceAction: "enchant",
        Target: structuredTargetFromSelector(action.target),
        ...(action.enchantment ? { Value: { $type: "TIdentifierValue", Value: action.enchantment } as StructuredValue } : {})
      },
      projectionStatus: action.enchantment ? "exact" : "partial"
    };
  }

  if (action.type === "upgrade_item") {
    return {
      ...base,
      action: {
        $type: "TActionCardUpgrade",
        SourceAction: "upgrade",
        Target: structuredTargetFromSelector(action.target)
      },
      projectionStatus: projectionStatusWithWarnings("exact"),
      projectionWarnings
    };
  }

  if (action.type === "use_item") {
    return {
      ...base,
      action: {
        $type: "TActionCardForceUse",
        SourceAction: "use",
        Target: structuredTargetFromSelector(action.target)
      },
      projectionStatus: projectionStatusWithWarnings("exact"),
      projectionWarnings
    };
  }

  if (action.type === "prevent_damage") {
    return {
      ...base,
      action: {
        $type: "TActionPlayerPreventDamage",
        SourceAction: "prevent_damage",
        Target: structuredTargetFromSelector(action.target),
        Value: action.duration?.kind === "for_seconds" ? structuredValueFromValueExpr(action.duration.seconds) : undefined
      },
      projectionStatus: action.duration?.kind === "instant" || action.duration?.kind === "for_seconds" ? "exact" : "partial",
      projectionWarnings:
        action.duration && action.duration.kind !== "instant" && action.duration.kind !== "for_seconds"
          ? [`Damage prevention duration '${action.duration.kind}' is not exactly represented in legacy projection.`]
          : undefined
    };
  }

  if (action.type === "start_sandstorm") {
    return {
      ...base,
      action: {
        $type: "TActionCardBeginSandstorm",
        SourceAction: "start_sandstorm",
        Target: structuredTargetFromSelector(action.target)
      },
      projectionStatus: projectionStatusWithWarnings("exact"),
      projectionWarnings
    };
  }

  if (action.type === "redirect") {
    return {
      ...base,
      action: {
        $type: "TActionCardRedirect",
        SourceAction: "redirect",
        Target: structuredTargetFromSelector(action.replacement),
        Value: action.description ? { $type: "TIdentifierValue", Value: action.description } : undefined
      },
      projectionStatus: "partial",
      projectionWarnings: ["Redirect target predicate is preserved as partial legacy projection."]
    };
  }

  if (action.type !== "apply_effect") {
    return unknownStructuredEffect(clause, index, `Semantic action '${action.type}' is not supported by the legacy structured projection.`);
  }

  const sourceAction = actionTypeFromMechanic(action.mechanic);
  if (sourceAction === "unknown") {
    return unknownStructuredEffect(clause, index, `Mechanic '${action.mechanic}' has no legacy structured action mapping.`);
  }
  const projectedValue = structuredValueFromValueExpr(action.amount);
  const target = structuredTargetFromSelector(action.target);
  const playerTarget =
    action.target.entity === "player" && action.target.owner === "any"
      ? { $type: "TTargetPlayerRelative", TargetMode: "Both" } as StructuredTarget
      : target;

  return {
    ...base,
    action: {
      $type:
        action.mechanic === "charge"
          ? "TActionCardCharge"
          : action.mechanic === "reload"
            ? "TActionCardReload"
            : action.mechanic === "haste"
              ? "TActionCardHaste"
              : action.mechanic === "slow"
                ? "TActionCardSlow"
                : action.mechanic === "freeze"
                  ? "TActionCardFreeze"
                  : action.mechanic === "damage"
                    ? "TActionPlayerDamage"
                    : action.mechanic === "burn"
                      ? "TActionPlayerBurnApply"
                      : action.mechanic === "poison"
                        ? "TActionPlayerPoisonApply"
                        : action.mechanic === "shield"
                          ? "TActionPlayerShieldApply"
                          : action.mechanic === "heal"
                            ? "TActionPlayerHeal"
                            : action.mechanic === "regen"
                              ? "TActionPlayerRegenApply"
                              : "TActionUnknown",
      SourceAction: sourceAction,
      ...(structuredAttributeFromStatRef(statFromMechanic(action.mechanic)) ? { AttributeType: structuredAttributeFromStatRef(statFromMechanic(action.mechanic)) } : {}),
      ...(projectedValue ? { Value: projectedValue } : {}),
      ...(playerTarget ? { Target: playerTarget } : {})
    },
    projectionStatus: projectionStatusWithWarnings("partial"),
    projectionWarnings
  };
}

function flattenActionNodes(node: ActionNode): ActionNode[] {
  if (node.node === "atomic") return [node];
  if (node.node === "sequence" || node.node === "parallel") return node.actions.flatMap(flattenActionNodes);
  return [node];
}

export function projectSemanticDocumentToStructuredEffects(document: SemanticEffectDocument): SemanticProjectionResult {
  const structuredEffects: StructuredEffect[] = [];
  const warnings: string[] = [];
  let unsupported = 0;
  let lossy = 0;

  if (document.clauses.length === 0) {
    return {
      structuredEffects,
      status: "exact",
      warnings
    };
  }

  for (const clause of document.clauses) {
    if (clause.actions.length !== 1) {
      structuredEffects.push(unknownStructuredEffect(clause, structuredEffects.length, "Multiple action roots are not supported by the legacy structured projection."));
      unsupported += 1;
      continue;
    }

    const flattened = flattenActionNodes(clause.actions[0]);
    const flattenedCompound = flattened.length > 1 || flattened[0] !== clause.actions[0];
    for (const node of flattened) {
      const projected = projectActionNode(clause, node, structuredEffects.length);
      if (flattenedCompound && projected.projectionStatus !== "unsupported") {
        projected.projectionStatus = projected.projectionStatus === "exact" ? "partial" : projected.projectionStatus;
        projected.projectionWarnings = [
          ...(projected.projectionWarnings ?? []),
          "Compound semantic action graph was flattened into multiple legacy structured effects."
        ];
      }
      structuredEffects.push(projected);
      if (projected.projectionStatus === "unsupported") unsupported += 1;
      if (projected.projectionStatus === "lossy") lossy += 1;
      warnings.push(...(projected.projectionWarnings ?? []));
    }
  }

  return {
    structuredEffects,
    status: projectionStatusFromEffects(structuredEffects, document),
    warnings
  };
}

export function parseSemanticEffectDocumentFromTexts(
  texts: string[],
  tags: TagLike[] = [],
  options: SemanticParseOptions = {}
): SemanticEffectDocument {
  const rawText = texts.join(" ");
  const parts = splitSemanticTexts(texts);
  const bonus = parseBonusVariableClauses(texts, tags);
  const bonusText = new Set(bonus.clauses.map((clause) => clause.id));
  const clauses: SemanticClause[] = [...bonus.clauses];

  for (const [index, text] of parts.entries()) {
    if (bonusText.size > 0 && (/\bbonus\b/i.test(text) || /\byour items have\b/i.test(text))) {
      continue;
    }
    const statusGate = parseSemanticStatusGate(text);
    const parseText = statusGate?.actionText ?? text;
    const parsed =
      parseSlotTerrain(parseText, index) ??
      parseEffectModifier(parseText, index) ??
      parseStatusDurationModifier(parseText, index, tags) ??
      parsePlayerFaction(parseText, index) ??
      parseWouldBeDefeated(parseText, index, tags) ??
      parseCustomScope(parseText, index, tags) ??
      parseFirstLimiter(parseText, index, tags) ??
      parseWhileAura(parseText, index, tags) ??
      parseWhenUseClause(parseText, index, tags) ??
      parseWhenSellClause(parseText, index, tags) ??
      parseTriggeredClause(parseText, index, tags) ??
      parseConditionalClause(parseText, index, tags) ??
      parseSimpleClause(parseText, index, tags);
    clauses.push(withClauseText(statusGate ? withStatusGate(parsed, statusGate.status) : parsed, text));
  }

  const warnings = clauses.flatMap((clause) => clause.warnings ?? []);
  const unsupportedCount = clauses.filter((clause) =>
    clause.actions.some((node) => node.node === "atomic" && node.action.type === "unknown")
  ).length;
  const projectionStatus = unsupportedCount === 0 ? (warnings.length > 0 ? "lossy" : "partial") : "unsupported";

  return {
    schemaVersion: SEMANTIC_IR_SCHEMA_VERSION,
    ...(options.sourceCardId ? { sourceCardId: options.sourceCardId } : {}),
    ...(options.sourceCardName ? { sourceCardName: options.sourceCardName } : {}),
    rawText,
    ...(bonus.variables.length > 0 ? { variables: bonus.variables } : {}),
    clauses,
    extractedTags: collectExtractedTags(clauses, bonus.variables),
    evidence: texts.map(evidence),
    confidence: unsupportedCount > 0 ? "low" : warnings.length > 0 ? "medium" : "high",
    warnings,
    ...(options.structuredEffectIds
      ? {
          projection: {
            structuredEffectIds: options.structuredEffectIds,
            status: projectionStatus,
            ...(warnings.length > 0 ? { warnings: warnings.map((item) => item.message) } : {})
          }
        }
      : {})
  };
}
