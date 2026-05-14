import {
  type ActionNode,
  type BoolExpr,
  type EntityPredicate,
  type EntitySelector,
  type MechanicKeyword,
  type SemanticAction,
  type SemanticClause,
  type SemanticEffectDocument,
  type SemanticPredicate,
  type StatusFlag,
  type ValueExpr
} from "./semanticEffects";
import { structuredEffectHasUnknown, structuredEffectViews, type StructuredEffectView } from "./structuredEffects";
import type { EffectActionType, ItemDef, MechanicKey, SkillDef, StructuredEffect } from "./types";

export type SemanticConsumableEntity = {
  name?: string;
  tags?: string[];
  structuredEffects: StructuredEffect[];
  semanticEffects?: SemanticEffectDocument;
};

export type SemanticSearchIndex = {
  mechanics: string[];
  itemTypes: string[];
  statuses: string[];
  playerStates: string[];
  zones: string[];
  actions: string[];
  triggers: string[];
  warnings: string[];
  text: string;
};

type SemanticMechanicScoreMap = Partial<Record<MechanicKey, number>>;
const semanticScoreCache = new WeakMap<SemanticEffectDocument, SemanticMechanicScoreMap>();
const semanticSearchCache = new WeakMap<SemanticEffectDocument, SemanticSearchIndex>();
const semanticSummaryCache = new WeakMap<SemanticEffectDocument, string[]>();

const mechanicToScoreKey: Partial<Record<MechanicKeyword, MechanicKey>> = {
  damage: "damage",
  burn: "burn",
  poison: "poison",
  shield: "shield",
  heal: "heal",
  regen: "heal",
  haste: "haste",
  slow: "slow",
  freeze: "freeze",
  charge: "charge",
  cooldown: "reduce_cooldown",
  crit: "crit",
  multicast: "multicast"
};

const semanticWeights: Record<MechanicKey, number> = {
  damage: 14,
  weapon_damage: 0,
  crit: 12,
  burn: 14,
  poison: 14,
  shield: 8,
  shield_scaling: 0,
  heal: 8,
  freeze: 12,
  slow: 9,
  haste: 12,
  charge: 14,
  reduce_cooldown: 10,
  multicast: 16,
  scaling: 8,
  economy: 0,
  control: 8,
  tempo: 8,
  sustain: 6
};

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set([...values].filter(Boolean))].sort();
}

function visitValue(value: ValueExpr | undefined, visitSelector: (selector: EntitySelector) => void): void {
  if (!value) return;
  if (value.kind === "stat") visitSelector(value.source);
  if (value.kind === "stat_threshold_count") {
    visitSelector(value.source);
    visitValue(value.threshold, visitSelector);
  }
  if (value.kind === "count") visitSelector(value.selector);
  if (value.kind === "scale") visitValue(value.value, visitSelector);
  if (value.kind === "formula") value.args.forEach((arg) => visitValue(arg, visitSelector));
}

function visitEntityPredicate(predicate: EntityPredicate, output: Set<string>): void {
  switch (predicate.kind) {
    case "has_item_type":
      output.add(predicate.type);
      break;
    case "has_mechanic":
      output.add(predicate.mechanic);
      break;
    case "has_status":
      output.add(predicate.status);
      break;
    case "has_size":
      output.add(predicate.size);
      break;
    case "has_rarity":
      output.add(predicate.rarity);
      break;
    case "count_compare":
      output.add(predicate.cmp);
      visitSelectorTokens(predicate.selector, output);
      break;
    case "position":
      output.add(predicate.position);
      break;
    case "stat_compare":
      output.add(predicate.stat.id);
      output.add(predicate.cmp);
      break;
    case "slot_occupied_by_item":
    case "item_in_source_slot":
      output.add(predicate.kind);
      break;
  }
}

function visitSemanticPredicate(predicate: SemanticPredicate, output: Set<string>): void {
  if (predicate.domain === "entity") {
    visitEntityPredicate(predicate.predicate, output);
  } else if (predicate.domain === "effect") {
    if (predicate.predicate.kind === "has_mechanic") output.add(predicate.predicate.mechanic);
    if (predicate.predicate.kind === "field_exists") output.add(predicate.predicate.field);
    if (predicate.predicate.kind === "source_owner") output.add(predicate.predicate.owner);
  } else if (predicate.domain === "player_state") {
    output.add(String(predicate.state));
  } else {
    output.add(predicate.event);
  }
}

function visitBool<T>(expr: BoolExpr<T> | undefined, visit: (atom: T) => void): void {
  if (!expr) return;
  if (expr.op === "atom") visit(expr.atom);
  else if (expr.op === "not") visitBool(expr.expr, visit);
  else expr.exprs.forEach((entry) => visitBool(entry, visit));
}

function visitSelectorTokens(selector: EntitySelector | undefined, output: Set<string>): void {
  if (!selector) return;
  output.add(selector.entity);
  if (selector.owner) output.add(selector.owner);
  if (selector.zone) output.add(selector.zone);
  if (selector.quantifier) output.add(selector.quantifier);
  if (selector.position) output.add(selector.position);
  visitBool(selector.predicates, (predicate) => visitEntityPredicate(predicate, output));
}

function visitAction(action: SemanticAction, output: Set<string>): void {
  output.add(action.type);
  switch (action.type) {
    case "apply_effect":
      output.add(action.mechanic);
      visitSelectorTokens(action.target, output);
      visitValue(action.amount, (selector) => visitSelectorTokens(selector, output));
      break;
    case "modify_stat":
      output.add(action.stat.id);
      visitSelectorTokens(action.target, output);
      visitValue(action.amount, (selector) => visitSelectorTokens(selector, output));
      break;
    case "modify_status":
      output.add(action.status);
      visitSelectorTokens(action.target, output);
      break;
    case "modify_status_duration":
      output.add(action.status);
      visitSelectorTokens(action.target, output);
      visitValue(action.amount, (selector) => visitSelectorTokens(selector, output));
      break;
    case "modify_variable":
      output.add(action.variable.variableId);
      visitValue(action.amount, (selector) => visitSelectorTokens(selector, output));
      break;
    case "modify_slot":
      output.add(action.terrain);
      visitSelectorTokens(action.target, output);
      action.linkedEffects?.forEach((clause) => visitClauseTokens(clause, output));
      break;
    case "modify_effect":
      output.add(action.target.entity);
      visitSelectorTokens(action.target.recipient, output);
      output.add(action.transform.kind);
      output.add(action.transform.field);
      break;
    case "add_player_state":
      output.add(action.state);
      visitSelectorTokens(action.target, output);
      break;
    case "prevent_damage":
    case "use_item":
    case "destroy_item":
      visitSelectorTokens(action.target, output);
      break;
    case "unknown":
      output.add(action.rawText);
      break;
  }
}

function visitNodeTokens(node: ActionNode, output: Set<string>): void {
  if (node.node === "atomic") {
    visitAction(node.action, output);
  } else if (node.node === "conditional") {
    visitBool(node.if, (predicate) => visitSemanticPredicate(predicate, output));
    node.then.forEach((entry) => visitNodeTokens(entry, output));
    node.else?.forEach((entry) => visitNodeTokens(entry, output));
  } else {
    node.actions.forEach((entry) => visitNodeTokens(entry, output));
  }
}

function visitClauseTokens(clause: SemanticClause, output: Set<string>): void {
  output.add(clause.kind);
  if (clause.trigger?.event) output.add(clause.trigger.event);
  if (clause.limiter?.kind && clause.limiter.kind !== "none") output.add(clause.limiter.kind);
  visitSelectorTokens(clause.trigger?.subject, output);
  visitSelectorTokens(clause.trigger?.object, output);
  visitBool(clause.condition, (predicate) => visitSemanticPredicate(predicate, output));
  clause.actions.forEach((node) => visitNodeTokens(node, output));
  clause.warnings?.forEach((warning) => {
    output.add(warning.code);
    output.add(warning.message);
  });
}

export function semanticSearchIndex(document: SemanticEffectDocument | undefined): SemanticSearchIndex {
  if (!document) {
    return {
      mechanics: [],
      itemTypes: [],
      statuses: [],
      playerStates: [],
      zones: [],
      actions: [],
      triggers: [],
      warnings: [],
      text: ""
    };
  }
  const cached = semanticSearchCache.get(document);
  if (cached) return cached;

  const tokens = new Set<string>([
    document.rawText,
    ...document.extractedTags.mechanics,
    ...document.extractedTags.itemTypes,
    ...document.extractedTags.statuses,
    ...document.extractedTags.playerStates,
    ...document.extractedTags.zones
  ]);
  document.clauses.forEach((clause) => visitClauseTokens(clause, tokens));

  const index = {
    mechanics: uniqueSorted(document.extractedTags.mechanics),
    itemTypes: uniqueSorted(document.extractedTags.itemTypes),
    statuses: uniqueSorted(document.extractedTags.statuses),
    playerStates: uniqueSorted(document.extractedTags.playerStates),
    zones: uniqueSorted(document.extractedTags.zones),
    actions: uniqueSorted(document.clauses.flatMap((clause) => clause.actions.map((node) => (node.node === "atomic" ? node.action.type : node.node)))),
    triggers: uniqueSorted(document.clauses.map((clause) => clause.trigger?.event ?? clause.kind)),
    warnings: uniqueSorted(document.warnings.map((warning) => warning.code)),
    text: uniqueSorted([...tokens].map((token) => token.toLowerCase())).join(" ")
  };
  semanticSearchCache.set(document, index);
  return index;
}

export function semanticSummary(document: SemanticEffectDocument | undefined): string[] {
  if (!document) return [];
  const cached = semanticSummaryCache.get(document);
  if (cached) return cached;
  const entries: string[] = [];
  for (const clause of document.clauses) {
    const actionLabels = clause.actions.map((node) => (node.node === "atomic" ? node.action.type : node.node)).join(" + ");
    const trigger = clause.trigger?.event ?? clause.kind;
    const limiter = clause.limiter && clause.limiter.kind !== "none" ? ` / ${clause.limiter.kind}` : "";
    const warning = clause.warnings?.length ? ` / ${clause.warnings.map((item) => item.code).join(",")}` : "";
    entries.push(`${trigger}${limiter} -> ${actionLabels}${warning}`);
  }
  semanticSummaryCache.set(document, entries);
  return entries;
}

export function semanticHasWarning(document: SemanticEffectDocument | undefined): boolean {
  return Boolean(document?.warnings.length || document?.clauses.some((clause) => clause.warnings?.length));
}

function scoreMechanic(scores: SemanticMechanicScoreMap, mechanic: MechanicKeyword, multiplier = 1): void {
  const key = mechanicToScoreKey[mechanic];
  if (!key) return;
  scores[key] = (scores[key] ?? 0) + semanticWeights[key] * multiplier;
  if (key === "burn" || key === "poison") scores.damage = (scores.damage ?? 0) + 6 * multiplier;
  if (key === "haste" || key === "charge" || key === "reduce_cooldown" || key === "multicast") scores.tempo = (scores.tempo ?? 0) + 8 * multiplier;
  if (key === "freeze" || key === "slow") scores.control = (scores.control ?? 0) + 8 * multiplier;
  if (key === "shield" || key === "heal") scores.sustain = (scores.sustain ?? 0) + 5 * multiplier;
}

function scoreSemanticAction(action: SemanticAction, scores: SemanticMechanicScoreMap): void {
  switch (action.type) {
    case "apply_effect":
      scoreMechanic(scores, action.mechanic);
      break;
    case "modify_stat": {
      const id = action.stat.id.toLowerCase();
      if (id.includes("damage")) scoreMechanic(scores, "damage", 0.8);
      if (id.includes("burn")) scoreMechanic(scores, "burn", 0.8);
      if (id.includes("poison")) scoreMechanic(scores, "poison", 0.8);
      if (id.includes("shield")) scoreMechanic(scores, "shield", 0.8);
      if (id.includes("crit")) scoreMechanic(scores, "crit", 0.8);
      if (id.includes("cooldown")) scoreMechanic(scores, "cooldown", 0.8);
      scores.scaling = (scores.scaling ?? 0) + 8;
      break;
    }
    case "modify_status":
      if (action.status === "heated") scoreMechanic(scores, "burn", 0.5);
      if (action.status === "chilled" || action.status === "frozen") scoreMechanic(scores, "freeze", 0.5);
      if (action.status === "hasted") scoreMechanic(scores, "haste", 0.5);
      if (action.status === "slowed") scoreMechanic(scores, "slow", 0.5);
      break;
    case "modify_status_duration":
      if (action.status === "enraged") scores.tempo = (scores.tempo ?? 0) + 4;
      if (action.status === "hasted") scoreMechanic(scores, "haste", 0.4);
      if (action.status === "slowed") scoreMechanic(scores, "slow", 0.4);
      if (action.status === "chilled" || action.status === "frozen") scoreMechanic(scores, "freeze", 0.4);
      if (action.status === "heated") scoreMechanic(scores, "burn", 0.4);
      break;
    case "modify_effect":
      scoreMechanic(scores, "charge", 0.6);
      scores.tempo = (scores.tempo ?? 0) + 6;
      break;
    case "modify_variable":
      scores.scaling = (scores.scaling ?? 0) + 10;
      break;
    case "modify_slot":
      scores.scaling = (scores.scaling ?? 0) + 6;
      action.linkedEffects?.forEach((clause) => scoreSemanticClause(clause, scores, 0.75));
      break;
    case "prevent_damage":
      scores.sustain = (scores.sustain ?? 0) + 10;
      break;
    case "use_item":
      scores.tempo = (scores.tempo ?? 0) + 8;
      break;
    case "destroy_item":
      scores.control = (scores.control ?? 0) + 8;
      break;
    case "add_player_state":
      scores.scaling = (scores.scaling ?? 0) + 3;
      break;
    case "unknown":
      break;
  }
}

function scoreSemanticNode(node: ActionNode, scores: SemanticMechanicScoreMap, multiplier: number): void {
  const before = { ...scores };
  if (node.node === "atomic") {
    scoreSemanticAction(node.action, scores);
  } else if (node.node === "conditional") {
    node.then.forEach((entry) => scoreSemanticNode(entry, scores, multiplier));
    node.else?.forEach((entry) => scoreSemanticNode(entry, scores, multiplier * 0.5));
  } else {
    node.actions.forEach((entry) => scoreSemanticNode(entry, scores, multiplier));
  }

  if (multiplier !== 1) {
    for (const [key, value] of Object.entries(scores) as Array<[MechanicKey, number]>) {
      const delta = value - (before[key] ?? 0);
      if (delta > 0) scores[key] = (before[key] ?? 0) + delta * multiplier;
    }
  }
}

function scoreSemanticClause(clause: SemanticClause, scores: SemanticMechanicScoreMap, multiplier = 1): void {
  const clauseMultiplier = multiplier * (clause.confidence === "low" ? 0.35 : clause.confidence === "medium" ? 0.7 : 1);
  if (clause.kind === "modifier" || clause.kind === "replacement") {
    scores.scaling = (scores.scaling ?? 0) + 4 * clauseMultiplier;
  }
  if (clause.limiter?.kind === "once" || clause.limiter?.kind === "first_n") {
    scores.tempo = (scores.tempo ?? 0) + 3 * clauseMultiplier;
  }
  clause.actions.forEach((node) => scoreSemanticNode(node, scores, clauseMultiplier));
}

export function scoreSemanticMechanics(document: SemanticEffectDocument | undefined): SemanticMechanicScoreMap {
  const scores: SemanticMechanicScoreMap = {};
  if (!document) return scores;
  const cached = semanticScoreCache.get(document);
  if (cached) return cached;
  document.clauses.forEach((clause) => scoreSemanticClause(clause, scores));
  semanticScoreCache.set(document, scores);
  return scores;
}

export function semanticActionTypes(entity: SemanticConsumableEntity): Set<EffectActionType | string> {
  const actions = new Set<EffectActionType | string>();
  for (const effect of structuredEffectViews(entity.structuredEffects)) {
    actions.add(effect.action.type);
  }
  entity.semanticEffects?.clauses.forEach((clause) =>
    clause.actions.forEach((node) => {
      if (node.node === "atomic") actions.add(node.action.type === "apply_effect" ? node.action.mechanic : node.action.type);
      else actions.add(node.node);
    })
  );
  return actions;
}

export function semanticUnknownCount(entity: SemanticConsumableEntity): number {
  const structuredUnknowns = entity.structuredEffects.filter(structuredEffectHasUnknown).length;
  const semanticUnknowns = entity.semanticEffects?.clauses.filter((clause) =>
    clause.actions.some((node) => node.node === "atomic" && node.action.type === "unknown")
  ).length ?? 0;
  return Math.max(structuredUnknowns, semanticUnknowns);
}

export function semanticHasAction(entity: SemanticConsumableEntity, actionTypes: Array<EffectActionType | string>): boolean {
  const actions = semanticActionTypes(entity);
  return actionTypes.some((action) => actions.has(action));
}

export function semanticEffectViews(entity: SemanticConsumableEntity): StructuredEffectView[] {
  return structuredEffectViews(entity.structuredEffects);
}

export type SemanticScorableItem = Pick<ItemDef, "semanticEffects" | "structuredEffects">;
export type SemanticScorableSkill = Pick<SkillDef, "semanticEffects" | "structuredEffects">;
