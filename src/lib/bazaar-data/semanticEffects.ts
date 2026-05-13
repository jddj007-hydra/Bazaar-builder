import { slugify } from "./slug";
import type { EffectActionType, EffectEvent, StructuredEffect } from "./types";

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
  | "effect_template"
  | "effect_instance"
  | "event";

export type StatRef = {
  domain: "card" | "item" | "player" | "effect" | "slot" | "variable";
  id:
    | "damageAmount"
    | "burnAmount"
    | "poisonAmount"
    | "shieldAmount"
    | "healAmount"
    | "regenAmount"
    | "cooldownSeconds"
    | "cooldownReduction"
    | "critChance"
    | "multicast"
    | "value"
    | "maxHealth"
    | "health"
    | "rageGain"
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
  | { kind: "tiered"; values: number[]; unit?: Unit }
  | { kind: "stat"; source: EntitySelector; stat: StatRef }
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
};

export type EventName =
  | "fight_started"
  | "item_used"
  | "card_fired"
  | "item_sold"
  | "item_bought"
  | "crit"
  | "effect_applied"
  | "health_threshold_crossed"
  | "would_be_defeated"
  | "enraged"
  | "day_started"
  | "merchant_visited";

export type EventPattern = {
  event: EventName;
  actor?: EntitySelector;
  subject?: EntitySelector;
  object?: EntitySelector;
  sourceEventText?: string;
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
  | { kind: "once"; reset: "fight" | "day" | "run" | "encounter"; consume: "on_trigger_match" | "on_action_resolve" }
  | { kind: "first_n"; count: ValueExpr; reset: "fight" | "day" | "run"; consume: "on_trigger_match" | "on_action_resolve" };

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
  | { type: "modify_slot"; target: EntitySelector; op: "set_terrain" | "add_terrain" | "remove_terrain"; terrain: string; linkedEffects?: SemanticClause[] }
  | { type: "modify_effect"; target: EffectSelector; transform: EffectTransform }
  | { type: "add_player_state"; target: EntitySelector; state: string }
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
  schemaVersion: "semantic-ir/v1";
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

function numberValues(text: string): number[] {
  return [...text.matchAll(new RegExp(NUMBER_PATTERN, "g"))].map((match) => Number(match[0]));
}

function amountFromText(text: string, unit?: Unit): ValueExpr | undefined {
  const values = numberValues(text);
  if (values.length === 0) {
    return undefined;
  }
  if (values.length > 1 && /[»>]/.test(text)) {
    return { kind: "tiered", values, ...(unit ? { unit } : {}) };
  }
  return fixed(values.at(-1) ?? values[0], unit);
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

function itemSelector(
  options: {
    owner?: Owner;
    zone?: EntitySelector["zone"];
    quantifier?: EntitySelector["quantifier"];
    predicates?: BoolExpr<EntityPredicate>;
    position?: PositionSelector;
    bindAs?: string;
  } = {}
): EntitySelector {
  return {
    entity: "item",
    owner: options.owner ?? "self",
    zone: options.zone ?? "board",
    ...(options.quantifier ? { quantifier: options.quantifier } : {}),
    ...(options.position ? { position: options.position } : {}),
    ...(options.predicates ? { predicates: options.predicates } : {}),
    ...(options.bindAs ? { bindAs: options.bindAs } : {})
  };
}

function playerSelector(owner: Owner = "self"): EntitySelector {
  return { entity: "player", owner };
}

function splitSemanticTexts(texts: string[]): string[] {
  return texts.flatMap((text) =>
    text
      .split(/\s*\.\s+(?=When|If|While|The first|Your|This|All|One of|You)\b/g)
      .map((part) => part.trim())
      .filter(Boolean)
  );
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

function triggerFromFirstEvent(eventText: string, tags: TagLike[]): EventPattern {
  const value = lower(eventText);
  const owner: Owner = /\benemy\b|\bopponent\b/.test(value) ? "enemy" : "self";
  const actor = playerSelector(owner);

  if (/\buse\b|\buses\b/.test(value)) {
    const usedMatch = eventText.match(/\buses?\s+(?<selector>.+)$/i);
    const selectorText = usedMatch?.groups?.selector ?? eventText;
    return {
      event: "item_used",
      actor,
      subject: itemSelector({ owner, predicates: predicateExprFromList(selectorText, tags) }),
      sourceEventText: eventText
    };
  }
  if (/\bcrit\b/.test(value)) {
    return { event: "crit", actor, sourceEventText: eventText };
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
    return { event: "health_threshold_crossed", actor, sourceEventText: eventText };
  }

  return { event: "effect_applied", actor, sourceEventText: eventText };
}

function targetFromActionText(actionText: string, tags: TagLike[]): EntitySelector {
  const value = lower(actionText);
  const owner: Owner = /\benemy\b|\bopponent\b/.test(value) ? "enemy" : "self";
  const quantifier: EntitySelector["quantifier"] =
    /\ball\b|\byour\b.*\bitems\b/.test(value) ? "all" : /\brandom\b/.test(value) ? "random" : /\ban?\b/.test(value) ? "one" : undefined;
  const position: PositionSelector | undefined = /\badjacent\b/.test(value)
    ? "adjacent"
    : /\bleftmost\b/.test(value)
      ? "leftmost"
      : /\brightmost\b/.test(value)
        ? "rightmost"
        : undefined;

  const selectorMatch =
    actionText.match(/\b(?:charge|haste|slow|freeze|reload|use)\s+(?:your|a|an|all|other|another|random)?\s*(?<selector>.+?)\s+(?:for\s+|[-+]?\d|$)/i) ??
    actionText.match(/\b(?:your|a|an|all|other|another|random)\s+(?<selector>.+?)\s+(?:for\s+|[-+]?\d|$)/i) ??
    actionText.match(/\b(?<selector>non-[a-z -]+|[a-z -]+)\s+items?\b/i);
  const predicates = selectorMatch?.groups?.selector ? predicateExprFromList(selectorMatch.groups.selector, tags) : undefined;

  return itemSelector({ owner, quantifier, position, predicates });
}

function parseApplyAction(actionText: string, tags: TagLike[]): SemanticAction {
  const value = lower(actionText);
  const leadingMechanic = value.match(/^\s*(charge|haste|slow|freeze|burn|poison|shield|heal|regen|damage)\b/)?.[1] as MechanicKeyword | undefined;
  const mechanic = leadingMechanic ?? mechanicFromText(actionText);
  if (mechanic === "charge" || mechanic === "haste" || mechanic === "slow" || mechanic === "freeze") {
    return {
      type: "apply_effect",
      mechanic,
      target: targetFromActionText(actionText, tags),
      amount: amountFromText(actionText, "seconds")
    };
  }
  if (mechanic && ["burn", "poison", "shield", "heal", "regen", "damage"].includes(mechanic)) {
    return {
      type: "apply_effect",
      mechanic,
      target: mechanic === "shield" || mechanic === "heal" || mechanic === "regen" ? playerSelector("self") : playerSelector("enemy"),
      amount: amountFromText(actionText)
    };
  }
  if (/\buse this\b/i.test(value)) {
    return { type: "use_item", target: itemSelector({ quantifier: "self" }) };
  }
  return { type: "unknown", rawText: actionText };
}

function parseFirstLimiter(text: string, index: number, tags: TagLike[]): SemanticClause | null {
  const match = text.match(new RegExp(`^the first (?:(?<count>${NUMBER_PATTERN}) times?|time) (?<event>.+?) each fight, (?<action>.+)$`, "i"));
  if (!match?.groups?.event || !match.groups.action) {
    return null;
  }

  const count = match.groups.count == null ? 1 : Number(match.groups.count);
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
        ? { kind: "once", reset: "fight", consume: "on_trigger_match" }
        : { kind: "first_n", count: fixed(count, "count"), reset: "fight", consume: "on_trigger_match" },
    actions: [{ node: "atomic", action: parseApplyAction(match.groups.action, tags) }],
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
    actions: [{ node: "atomic", action: parseApplyAction(match.groups.action, tags) }],
    confidence: "high"
  };
}

function parseWhileAura(text: string, index: number, tags: TagLike[]): SemanticClause | null {
  const match = text.match(/^while you are (?<state>enraged|hasted|slowed|frozen), (?<action>.+)$/i);
  if (!match?.groups?.state || !match.groups.action) {
    return null;
  }

  const state = lower(match.groups.state) as StatusFlag;
  return {
    id: `c_${index}_while_${state}`,
    kind: "aura",
    activeIn: ["combat"],
    condition: playerStatePredicate(state),
    duration: { kind: "while_condition", condition: playerStatePredicate(state), reversible: true },
    actions: [{ node: "atomic", action: parseStatAuraAction(match.groups.action, tags) ?? parseApplyAction(match.groups.action, tags) }],
    confidence: "medium"
  };
}

function parseWhenUseClause(text: string, index: number, tags: TagLike[]): SemanticClause | null {
  const match = text.match(/^when (?<actor>you|your enemy|an enemy|the enemy|your opponent) uses? (?<subject>.+?), (?<action>.+)$/i);
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
    actions: [{ node: "atomic", action: parseApplyAction(match.groups.action, tags) }],
    confidence: "medium"
  };
}

function parseStatAuraAction(text: string, tags: TagLike[]): SemanticAction | null {
  const match = text.match(/\b(?<target>your items|this|adjacent items|the item to the left|the item to the right)\b.*\b(?:have|has|gain|gains)\s+(?<amount>[-+]?\d+(?:\.\d+)?)\s+(?<stat>damage|shield|burn|poison|heal|regen|crit(?:%|\s+chance)?)\b/i);
  if (!match?.groups?.target || !match.groups.amount || !match.groups.stat) {
    return null;
  }
  const mechanic = mechanicFromText(match.groups.stat);
  const stat = statFromMechanic(mechanic);
  if (!stat) {
    return null;
  }
  const targetValue = lower(match.groups.target);
  const target = targetValue === "this"
    ? itemSelector({ quantifier: "self" })
    : targetValue.includes("adjacent")
      ? itemSelector({ quantifier: "all", position: "adjacent" })
      : targetValue.includes("left")
        ? itemSelector({ quantifier: "one", position: "left" })
        : targetValue.includes("right")
          ? itemSelector({ quantifier: "one", position: "right" })
          : itemSelector({ quantifier: "all", predicates: predicateExprFromList(match.groups.target, tags) });

  return {
    type: "modify_stat",
    target,
    stat,
    op: "add",
    amount: fixed(Number(match.groups.amount)),
    duration: { kind: "while_source_active" }
  };
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
    clauses.push({
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
    });
  }

  clauses.push({
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
  });

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
    actions: actions.length === 1 ? actions : [{ node: "sequence", actions }],
    confidence: "medium"
  };
}

function parseSimpleClause(text: string, index: number, tags: TagLike[]): SemanticClause {
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
      visitEntitySelector(action.target);
      visitValue(action.amount);
    } else if (action.type === "modify_status") {
      statuses.add(action.status);
      visitEntitySelector(action.target);
    } else if (action.type === "modify_slot") {
      visitEntitySelector(action.target);
      action.linkedEffects?.forEach(visitClause);
    } else if (action.type === "modify_effect") {
      visitEffectSelector(action.target);
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
    case "item_used":
      return "item_used";
    case "card_fired":
      return "cooldown_ready";
    case "item_sold":
      return "sell";
    case "item_bought":
      return "buy";
    case "crit":
      return "crit";
    case "enraged":
      return "enrage";
    case "merchant_visited":
      return "merchant";
    case "day_started":
      return "level_up";
    case "would_be_defeated":
    case "effect_applied":
    case "health_threshold_crossed":
    default:
      return "unknown";
  }
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

function projectActionNode(clause: SemanticClause, node: ActionNode, index: number): StructuredEffect {
  if (node.node !== "atomic") {
    return unknownStructuredEffect(clause, index, "Compound semantic action graph is not supported by the legacy structured projection.");
  }

  const action = node.action;
  if (action.type !== "apply_effect") {
    return unknownStructuredEffect(clause, index, `Semantic action '${action.type}' is not supported by the legacy structured projection.`);
  }

  const sourceAction = actionTypeFromMechanic(action.mechanic);
  if (sourceAction === "unknown") {
    return unknownStructuredEffect(clause, index, `Mechanic '${action.mechanic}' has no legacy structured action mapping.`);
  }
  const projectedValue = fixedValueFromValueExpr(action.amount);

  return {
    id: `semantic-${index}`,
    kind: clause.kind === "aura" ? "aura" : "ability",
    activeIn: "hand_only",
    ...(clause.kind === "aura"
      ? {}
      : {
          trigger: {
            $type: clause.trigger?.event === "item_used" ? "TTriggerOnItemUsed" : clause.trigger?.event === "crit" ? "TTriggerOnCardCritted" : "TTriggerUnknown",
            SourceEvent: effectEventFromSemantic(clause.trigger?.event),
            ...(tagFromPredicate(clause.trigger?.subject?.predicates)
              ? { Tag: tagFromPredicate(clause.trigger?.subject?.predicates) }
              : {})
          }
        }),
    action: {
      $type:
        action.mechanic === "charge"
          ? "TActionCardCharge"
          : action.mechanic === "haste"
            ? "TActionCardHaste"
            : action.mechanic === "slow"
              ? "TActionCardSlow"
              : action.mechanic === "freeze"
                ? "TActionCardFreeze"
                : "TActionUnknown",
      SourceAction: sourceAction,
      ...(projectedValue != null ? { Value: { $type: "TFixedValue", Value: projectedValue } } : {})
    },
    semanticSourceIds: [clause.id],
    projectionStatus: clause.warnings?.length ? "lossy" : "partial",
    projectionWarnings: clause.warnings?.map((item) => item.message),
    rawText: clause.trigger?.sourceEventText ?? ""
  };
}

export function projectSemanticDocumentToStructuredEffects(document: SemanticEffectDocument): SemanticProjectionResult {
  const structuredEffects: StructuredEffect[] = [];
  const warnings: string[] = [];
  let unsupported = 0;
  let lossy = 0;

  for (const clause of document.clauses) {
    if (clause.actions.length !== 1) {
      structuredEffects.push(unknownStructuredEffect(clause, structuredEffects.length, "Multiple action roots are not supported by the legacy structured projection."));
      unsupported += 1;
      continue;
    }

    const projected = projectActionNode(clause, clause.actions[0], structuredEffects.length);
    structuredEffects.push(projected);
    if (projected.projectionStatus === "unsupported") unsupported += 1;
    if (projected.projectionStatus === "lossy") lossy += 1;
    warnings.push(...(projected.projectionWarnings ?? []));
  }

  return {
    structuredEffects,
    status: unsupported === structuredEffects.length ? "unsupported" : unsupported > 0 ? "partial" : lossy > 0 ? "lossy" : "partial",
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
    const parsed =
      parseSlotTerrain(text, index) ??
      parseEffectModifier(text, index) ??
      parseWouldBeDefeated(text, index, tags) ??
      parseCustomScope(text, index, tags) ??
      parseFirstLimiter(text, index, tags) ??
      parseWhileAura(text, index, tags) ??
      parseWhenUseClause(text, index, tags) ??
      parseSimpleClause(text, index, tags);
    clauses.push(parsed);
  }

  const warnings = clauses.flatMap((clause) => clause.warnings ?? []);
  const unsupportedCount = clauses.filter((clause) =>
    clause.actions.some((node) => node.node === "atomic" && node.action.type === "unknown")
  ).length;
  const projectionStatus = unsupportedCount === 0 ? (warnings.length > 0 ? "lossy" : "partial") : "unsupported";

  return {
    schemaVersion: "semantic-ir/v1",
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
