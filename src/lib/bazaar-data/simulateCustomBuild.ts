import {
  getAdjacentNeighbors,
  getLeftNeighbor,
  getRightNeighbor,
  isLeftOf,
  isRightOf
} from "./layout";
import { itemMatchesStructuredEffectTarget } from "./positionEffects";
import { structuredEffectView, type StructuredEffectView } from "./structuredEffects";
import type {
  BoardLayout,
  EffectActionType,
  EffectCondition,
  EffectEvent,
  ItemDef,
  ItemIndexEntry,
  PlacedItem,
  SkillDef,
  SkillIndexEntry,
  StructuredEffect
} from "./types";

export type SimulatableItem = Pick<
  ItemDef | ItemIndexEntry,
  "id" | "name" | "tags" | "size" | "cooldownMs" | "structuredEffects"
>;

export type SimulatableSkill = Pick<SkillDef | SkillIndexEntry, "id" | "name" | "tags" | "structuredEffects">;

export type SimulatedEntityKind = "item" | "skill";

export type SimulationTotal = {
  key: string;
  label: string;
  value: number;
};

export type SimulationEffectResult = {
  effectId: string;
  rawText: string;
  triggerEvent: string;
  actionType: EffectActionType;
  triggerCount: number;
  targetMultiplier: number;
  valuePerTrigger: number | null;
  totalValue: number | null;
  totalKey: string | null;
  totalLabel: string | null;
  unsupportedReason: string | null;
};

export type SimulationCardResult = {
  entityId: string;
  entityName: string;
  entityKind: SimulatedEntityKind;
  activeUses: number;
  totalTriggers: number;
  totals: SimulationTotal[];
  effects: SimulationEffectResult[];
};

export type BuildSimulationResult = {
  durationSeconds: number;
  totalItemUses: number;
  totals: SimulationTotal[];
  cards: SimulationCardResult[];
  warnings: string[];
  unsupported: Array<{
    entityName: string;
    rawText: string;
    reason: string;
  }>;
};

type SimEntity =
  | {
      kind: "item";
      entry: SimulatableItem;
    }
  | {
      kind: "skill";
      entry: SimulatableSkill;
    };

type SimulationContext = {
  durationSeconds: number;
  items: SimulatableItem[];
  skills: SimulatableSkill[];
  layout: BoardLayout | null;
  itemById: Map<string, SimulatableItem>;
  placementByItemId: Map<string, PlacedItem>;
  itemUseCounts: Map<string, number>;
  baseActionEvents: Map<string, number>;
};

type TriggerCountResult = {
  count: number;
  reason?: string;
  usesActionEvents?: boolean;
};

type TargetCountResult = {
  count: number;
  reason?: string;
};

const directlyScheduledEvents = new Set([
  "cooldown_ready",
  "combat_start",
  "item_used",
  "tag_item_used",
  "adjacent_item_used",
  "skill_active"
]);

const tempoActionTypes = new Set<EffectActionType>(["charge", "haste", "slow", "freeze", "reduce_cooldown"]);

const numericActionLabels: Partial<Record<EffectActionType, string>> = {
  burn: "燃烧",
  charge: "充能",
  damage: "伤害",
  freeze: "冻结",
  gain_gold: "金币",
  gain_health: "生命上限",
  haste: "加速",
  heal: "治疗",
  increase_value: "价值",
  multicast: "多重施放",
  poison: "中毒",
  reduce_cooldown: "冷却减少",
  regen: "生命再生",
  reload: "装填",
  shield: "护盾",
  slow: "减速"
};

const cardTargetActionTypes = new Set<EffectActionType>([
  "buff_tag",
  "charge",
  "cleanse",
  "destroy",
  "enchant",
  "flying",
  "freeze",
  "gain_stat",
  "haste",
  "increase_value",
  "modify_effect",
  "modify_slot",
  "modify_stat",
  "modify_status",
  "modify_status_duration",
  "multicast",
  "reduce_cooldown",
  "reload",
  "repair",
  "slow",
  "transform",
  "upgrade",
  "use"
]);

function compact<T>(values: T[]): T[] {
  return [...new Set(values)].filter(Boolean).slice(0, 16);
}

function roundValue(value: number): number {
  return Math.round(value * 100) / 100;
}

function addToMap(map: Map<string, number>, key: string, value: number): void {
  if (!Number.isFinite(value) || value === 0) return;
  map.set(key, roundValue((map.get(key) ?? 0) + value));
}

function itemUseCount(item: SimulatableItem, durationSeconds: number): number {
  if (!item.cooldownMs || item.cooldownMs <= 0 || durationSeconds <= 0) return 0;
  return Math.floor((durationSeconds * 1000) / item.cooldownMs);
}

function placementForItem(context: SimulationContext, itemId: string): PlacedItem | null {
  return context.placementByItemId.get(itemId) ?? null;
}

function itemForPlacement(context: SimulationContext, placement: PlacedItem | null | undefined): SimulatableItem | null {
  return placement ? context.itemById.get(placement.itemId) ?? null : null;
}

function allItemsMatchingTarget(
  context: SimulationContext,
  target: StructuredEffectView["target"] | StructuredEffectView["triggerTarget"] | undefined,
  sourceItem?: SimulatableItem
): SimulatableItem[] {
  return context.items.filter((item) => {
    if (target?.excludeSelf && sourceItem?.id === item.id) return false;
    return itemMatchesStructuredEffectTarget(item as ItemDef, target);
  });
}

function edgePlacement(context: SimulationContext, side: "leftmost" | "rightmost"): PlacedItem | null {
  const sorted = [...(context.layout?.placements ?? [])].sort((a, b) => a.startSlot - b.startSlot);
  return side === "leftmost" ? sorted[0] ?? null : sorted[sorted.length - 1] ?? null;
}

function rankedPlacement(context: SimulationContext, rank: "lowest_value" | "highest_value" | "fastest_cooldown" | "slowest_cooldown"): PlacedItem | null {
  const placements = [...(context.layout?.placements ?? [])];
  if (placements.length === 0) return null;

  return placements.sort((a, b) => {
    const left = context.itemById.get(a.itemId);
    const right = context.itemById.get(b.itemId);
    if (rank === "fastest_cooldown" || rank === "slowest_cooldown") {
      const leftCooldown = left?.cooldownMs ?? (rank === "fastest_cooldown" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
      const rightCooldown = right?.cooldownMs ?? (rank === "fastest_cooldown" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
      return rank === "fastest_cooldown" ? leftCooldown - rightCooldown : rightCooldown - leftCooldown;
    }

    const leftValue = "value" in (left ?? {}) ? Number((left as ItemIndexEntry).value ?? 0) : 0;
    const rightValue = "value" in (right ?? {}) ? Number((right as ItemIndexEntry).value ?? 0) : 0;
    return rank === "lowest_value" ? leftValue - rightValue : rightValue - leftValue;
  })[0] ?? null;
}

function positionalMatches(
  context: SimulationContext,
  sourceItem: SimulatableItem,
  target: StructuredEffectView["target"] | StructuredEffectView["triggerTarget"],
  candidate: SimulatableItem
): boolean {
  const sourcePlacement = placementForItem(context, sourceItem.id);
  const candidatePlacement = placementForItem(context, candidate.id);
  if (!sourcePlacement || !candidatePlacement) return false;

  if (target?.scope === "adjacent" || target?.scope === "trigger_source_adjacent") {
    return getAdjacentNeighbors(sourcePlacement, context.layout?.placements ?? []).some((placement) => placement.itemId === candidate.id);
  }
  if (target?.scope === "left") return getLeftNeighbor(sourcePlacement, context.layout?.placements ?? [])?.itemId === candidate.id;
  if (target?.scope === "right") return getRightNeighbor(sourcePlacement, context.layout?.placements ?? [])?.itemId === candidate.id;
  if (target?.scope === "leftmost" || target?.scope === "rightmost") return edgePlacement(context, target.scope)?.itemId === candidate.id;
  if (target?.scope === "lowest_value" || target?.scope === "highest_value" || target?.scope === "fastest_cooldown" || target?.scope === "slowest_cooldown") {
    return rankedPlacement(context, target.scope)?.itemId === candidate.id;
  }
  if (target?.scope === "self" || target?.scope === "trigger_source") return sourceItem.id === candidate.id;
  if (target?.scope === "allied_items" || target?.scope === "all_items" || target?.scope === "random") return true;
  return false;
}

function itemMatchesTrigger(
  context: SimulationContext,
  source: SimEntity,
  effect: StructuredEffectView,
  candidate: SimulatableItem
): boolean {
  if (effect.trigger.tag && !candidate.tags.includes(effect.trigger.tag)) return false;
  if (!itemMatchesStructuredEffectTarget(candidate as ItemDef, effect.triggerTarget)) return false;

  if (source.kind === "item" && effect.triggerTarget?.scope) {
    if (!positionalMatches(context, source.entry, effect.triggerTarget, candidate)) return false;
  } else if (effect.triggerTarget?.scope && !["allied_items", "all_items", "random"].includes(effect.triggerTarget.scope)) {
    return false;
  }

  return true;
}

function matchingItemUseCount(context: SimulationContext, source: SimEntity, effect: StructuredEffectView): number {
  return context.items.reduce((sum, item) => {
    if (!itemMatchesTrigger(context, source, effect, item)) return sum;
    return sum + (context.itemUseCounts.get(item.id) ?? 0);
  }, 0);
}

function adjacentItemUseCount(context: SimulationContext, source: SimEntity, effect: StructuredEffectView): TriggerCountResult {
  if (source.kind !== "item") return { count: 0, reason: "技能没有棋盘相邻位置，暂不模拟相邻触发。" };
  const sourcePlacement = placementForItem(context, source.entry.id);
  if (!sourcePlacement || !context.layout) return { count: 0, reason: "缺少合法棋盘布局，无法计算相邻触发。" };

  const neighbors = getAdjacentNeighbors(sourcePlacement, context.layout.placements);
  const count = neighbors.reduce((sum, placement) => {
    const item = itemForPlacement(context, placement);
    if (!item) return sum;
    if (effect.trigger.tag && !item.tags.includes(effect.trigger.tag)) return sum;
    if (!itemMatchesStructuredEffectTarget(item as ItemDef, effect.triggerTarget)) return sum;
    return sum + (context.itemUseCounts.get(item.id) ?? 0);
  }, 0);

  return { count };
}

function actionEventKey(event: string): string | null {
  switch (event) {
    case "apply_burn":
      return "burn";
    case "apply_poison":
      return "poison";
    case "deal_damage":
    case "enemy_damaged":
      return "damage";
    case "enemy_healed":
    case "heal":
      return "heal";
    case "enemy_shielded":
    case "gain_shield":
      return "shield";
    default:
      return null;
  }
}

function effectiveTriggerEvent(effect: StructuredEffectView): EffectEvent {
  if (effect.trigger.event !== "always") return effect.trigger.event;
  const text = effect.rawText.toLowerCase();
  if (/\bwhen\b.*\badjacent\b.*\b(?:is|are|you)?\s*used\b|\bwhen\b.*\byou\s+use\b.*\badjacent\b/.test(text)) {
    return "adjacent_item_used";
  }
  if (/\bwhen\b.*\bcombat\s+starts?\b|\bwhen\s+the\s+fight\s+starts?\b|\bat\s+the\s+start\s+of\s+(?:combat|the\s+fight)\b/.test(text)) {
    return "combat_start";
  }
  if (/\bwhen\b.*\byou\s+use\b.*\bitems?\b/.test(text)) {
    return "item_used";
  }
  return effect.trigger.event;
}

function supportedConditionCount(context: SimulationContext, tag: string | undefined): number {
  return tag ? context.items.filter((item) => item.tags.includes(tag)).length : 0;
}

function evaluateCondition(context: SimulationContext, source: SimEntity, condition: EffectCondition): { ok: boolean; reason?: string } {
  switch (condition.type) {
    case "exactly_one":
      return { ok: supportedConditionCount(context, condition.tag) === 1 };
    case "minimum_count":
      return { ok: supportedConditionCount(context, condition.tag) >= (condition.count ?? 0) };
    case "maximum_count":
      return { ok: supportedConditionCount(context, condition.tag) <= (condition.count ?? 0) };
    case "has_tag":
      return { ok: !condition.tag || source.entry.tags.includes(condition.tag) || supportedConditionCount(context, condition.tag) > 0 };
    case "has_tag_expr":
      return { ok: false, reason: "复杂标签表达式条件暂不在理论模拟器中求值。" };
    case "target_has_tag":
      return { ok: false, reason: "目标条件暂不在理论模拟器中求值。" };
    case "has_card_status":
      return { ok: false, reason: "卡牌状态条件暂不在理论模拟器中求值。" };
    case "has_player_state":
      return { ok: false, reason: "玩家状态条件暂不在理论模拟器中求值。" };
  }
}

function evaluateConditions(context: SimulationContext, source: SimEntity, effect: StructuredEffectView): { ok: boolean; reason?: string } {
  for (const condition of effect.conditions ?? []) {
    const evaluated = evaluateCondition(context, source, condition);
    if (evaluated.reason) return evaluated;
    if (!evaluated.ok) return { ok: false, reason: "条件未满足。" };
  }
  return { ok: true };
}

function schedulerTriggerCount(context: SimulationContext, source: SimEntity, effect: StructuredEffectView, event: EffectEvent): TriggerCountResult {
  switch (event) {
    case "cooldown_ready":
      if (source.kind !== "item") return { count: 0, reason: "技能没有主动冷却，暂不模拟主动触发。" };
      return { count: context.itemUseCounts.get(source.entry.id) ?? 0 };
    case "combat_start":
      return { count: 1 };
    case "skill_active":
      return source.kind === "skill" ? { count: 1 } : { count: 0 };
    case "item_used":
    case "tag_item_used":
      return { count: matchingItemUseCount(context, source, effect) };
    case "adjacent_item_used":
      return adjacentItemUseCount(context, source, effect);
    default:
      return { count: 0, reason: "该触发事件不属于当前时间轴模拟范围。" };
  }
}

function triggerCount(context: SimulationContext, source: SimEntity, effect: StructuredEffectView): TriggerCountResult {
  const conditions = evaluateConditions(context, source, effect);
  if (!conditions.ok) return { count: 0, reason: conditions.reason };

  const event = effectiveTriggerEvent(effect);
  if (directlyScheduledEvents.has(event)) {
    return schedulerTriggerCount(context, source, effect, event);
  }

  if (event === "always" || event === "condition_active") {
    return { count: 0, reason: "常驻/条件光环会影响属性或状态，当前版本不把它折算为时间触发次数。" };
  }

  const actionKey = actionEventKey(event);
  if (actionKey) {
    return { count: context.baseActionEvents.get(actionKey) ?? 0, usesActionEvents: true };
  }

  return { count: 0, reason: "该触发事件暂未接入理论模拟器。" };
}

function actionTotalKey(effect: StructuredEffectView): string | null {
  if (effect.action.type === "gain_stat" || effect.action.type === "modify_stat") {
    return effect.action.stat ? `stat:${effect.action.stat}` : null;
  }
  return numericActionLabels[effect.action.type] ? effect.action.type : null;
}

function actionTotalLabel(effect: StructuredEffectView): string | null {
  if (effect.action.type === "gain_stat" || effect.action.type === "modify_stat") {
    return effect.action.stat ? `${effect.action.stat} 属性变化` : null;
  }
  return numericActionLabels[effect.action.type] ?? null;
}

function isCardTargetAction(actionType: EffectActionType): boolean {
  return cardTargetActionTypes.has(actionType);
}

function targetCountForCardAction(context: SimulationContext, source: SimEntity, effect: StructuredEffectView): TargetCountResult {
  const target = effect.target;
  if (!isCardTargetAction(effect.action.type)) return { count: 1 };
  if (!target) return { count: source.kind === "item" ? 1 : 0, reason: source.kind === "skill" ? "技能卡牌目标缺失，暂不模拟。" : undefined };

  if (source.kind !== "item" && ["self", "adjacent", "left", "right", "leftmost", "rightmost", "trigger_source", "trigger_source_adjacent"].includes(target.scope)) {
    return { count: 0, reason: "技能没有可定位的棋盘来源，暂不模拟该目标。" };
  }

  if (target.scope === "self" || target.scope === "trigger_source") return { count: 1 };
  if (target.scope === "adjacent" || target.scope === "trigger_source_adjacent") {
    if (source.kind !== "item") return { count: 0, reason: "缺少来源物品，无法计算相邻目标。" };
    const sourcePlacement = placementForItem(context, source.entry.id);
    if (!sourcePlacement || !context.layout) return { count: 0, reason: "缺少合法棋盘布局，无法计算相邻目标。" };
    const count = getAdjacentNeighbors(sourcePlacement, context.layout.placements)
      .map((placement) => itemForPlacement(context, placement))
      .filter((item): item is SimulatableItem => Boolean(item))
      .filter((item) => itemMatchesStructuredEffectTarget(item as ItemDef, target)).length;
    return count > 0 ? { count } : { count: 0, reason: "没有命中的相邻目标。" };
  }
  if (target.scope === "left" || target.scope === "right") {
    if (source.kind !== "item") return { count: 0, reason: "缺少来源物品，无法计算左右目标。" };
    const sourcePlacement = placementForItem(context, source.entry.id);
    if (!sourcePlacement || !context.layout) return { count: 0, reason: "缺少合法棋盘布局，无法计算左右目标。" };
    const placement = target.scope === "left"
      ? getLeftNeighbor(sourcePlacement, context.layout.placements)
      : getRightNeighbor(sourcePlacement, context.layout.placements);
    const item = itemForPlacement(context, placement);
    if (!item || !itemMatchesStructuredEffectTarget(item as ItemDef, target)) return { count: 0, reason: "指定方向没有命中目标。" };
    return { count: 1 };
  }
  if (target.scope === "leftmost" || target.scope === "rightmost") {
    const item = itemForPlacement(context, edgePlacement(context, target.scope));
    return item && itemMatchesStructuredEffectTarget(item as ItemDef, target) ? { count: 1 } : { count: 0, reason: "边缘目标不存在或不匹配。" };
  }
  if (target.scope === "lowest_value" || target.scope === "highest_value" || target.scope === "fastest_cooldown" || target.scope === "slowest_cooldown") {
    const item = itemForPlacement(context, rankedPlacement(context, target.scope));
    return item && itemMatchesStructuredEffectTarget(item as ItemDef, target) ? { count: 1 } : { count: 0, reason: "排序目标不存在或不匹配。" };
  }
  if (target.scope === "allied_items" || target.scope === "all_items") {
    return { count: allItemsMatchingTarget(context, target, source.kind === "item" ? source.entry : undefined).length };
  }
  if (target.scope === "random") {
    return { count: allItemsMatchingTarget(context, target, source.kind === "item" ? source.entry : undefined).length > 0 ? 1 : 0 };
  }
  if (target.scope === "enemy" || target.scope === "enemy_items") {
    return { count: 0, reason: "敌方卡牌目标不在自定义构筑模拟范围内。" };
  }

  return { count: 0, reason: "该目标类型暂未接入理论模拟器。" };
}

function effectActionEventKey(effect: StructuredEffectView): string | null {
  switch (effect.action.type) {
    case "burn":
    case "damage":
    case "heal":
    case "poison":
    case "shield":
      return effect.action.type;
    default:
      return null;
  }
}

function simulateEffect(
  context: SimulationContext,
  source: SimEntity,
  effect: StructuredEffect,
  includeActionEvents: boolean
): SimulationEffectResult {
  const view = structuredEffectView(effect);
  const event = effectiveTriggerEvent(view);
  const trigger = includeActionEvents ? triggerCount(context, source, view) : directlyScheduledEvents.has(event)
    ? triggerCount(context, source, view)
    : { count: 0 };
  const target = targetCountForCardAction(context, source, view);
  const totalKey = actionTotalKey(view);
  const totalLabel = actionTotalLabel(view);
  const valuePerTrigger = view.action.value ?? null;
  const unsupportedReason = trigger.reason ?? target.reason ?? (totalKey && valuePerTrigger == null ? "动态或引用数值暂不估算，只统计触发次数。" : null);
  const appliedTargetCount = target.reason ? 0 : target.count;
  const totalValue = totalKey && valuePerTrigger != null && !unsupportedReason
    ? roundValue(trigger.count * Math.max(appliedTargetCount, 1) * valuePerTrigger)
    : null;

  return {
    effectId: effect.id,
    rawText: view.rawText,
    triggerEvent: event,
    actionType: view.action.type,
    triggerCount: trigger.count,
    targetMultiplier: target.reason ? 0 : Math.max(appliedTargetCount, 1),
    valuePerTrigger,
    totalValue,
    totalKey,
    totalLabel,
    unsupportedReason
  };
}

function makeContext(params: {
  items: SimulatableItem[];
  skills: SimulatableSkill[];
  layout: BoardLayout | null;
  durationSeconds: number;
}): SimulationContext {
  const itemUseCounts = new Map(params.items.map((item) => [item.id, itemUseCount(item, params.durationSeconds)]));
  const itemById = new Map(params.items.map((item) => [item.id, item]));
  const placementByItemId = new Map((params.layout?.placements ?? []).map((placement) => [placement.itemId, placement]));

  return {
    ...params,
    itemById,
    placementByItemId,
    itemUseCounts,
    baseActionEvents: new Map()
  };
}

function scheduledActionEvents(context: SimulationContext, entities: SimEntity[]): Map<string, number> {
  const events = new Map<string, number>();
  for (const entity of entities) {
    for (const effect of entity.entry.structuredEffects) {
      const simulated = simulateEffect(context, entity, effect, false);
      const eventKey = effectActionEventKey(structuredEffectView(effect));
      if (eventKey) addToMap(events, eventKey, simulated.triggerCount);
    }
  }
  return events;
}

function totalsFromEffects(effects: SimulationEffectResult[]): SimulationTotal[] {
  const totals = new Map<string, { label: string; value: number }>();
  for (const effect of effects) {
    if (!effect.totalKey || !effect.totalLabel || effect.totalValue == null) continue;
    const previous = totals.get(effect.totalKey)?.value ?? 0;
    totals.set(effect.totalKey, { label: effect.totalLabel, value: roundValue(previous + effect.totalValue) });
  }
  return [...totals.entries()]
    .map(([key, total]) => ({ key, label: total.label, value: total.value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function entitySortPosition(context: SimulationContext, entity: SimEntity): number {
  if (entity.kind === "skill") return 1000;
  return placementForItem(context, entity.entry.id)?.startSlot ?? 999;
}

export function simulateCustomBuild(params: {
  items: SimulatableItem[];
  skills: SimulatableSkill[];
  layout: BoardLayout | null;
  durationSeconds: number;
}): BuildSimulationResult {
  const durationSeconds = Math.max(1, Math.min(300, Math.round(params.durationSeconds)));
  const context = makeContext({ ...params, durationSeconds });
  const entities: SimEntity[] = [
    ...params.items.map((entry): SimEntity => ({ kind: "item", entry })),
    ...params.skills.map((entry): SimEntity => ({ kind: "skill", entry }))
  ].sort((a, b) => entitySortPosition(context, a) - entitySortPosition(context, b));

  context.baseActionEvents = scheduledActionEvents(context, entities);

  const cards = entities.map((entity): SimulationCardResult => {
    const effects = entity.entry.structuredEffects.map((effect) => simulateEffect(context, entity, effect, true));
    return {
      entityId: entity.entry.id,
      entityName: entity.entry.name,
      entityKind: entity.kind,
      activeUses: entity.kind === "item" ? context.itemUseCounts.get(entity.entry.id) ?? 0 : 0,
      totalTriggers: effects.reduce((sum, effect) => sum + effect.triggerCount, 0),
      totals: totalsFromEffects(effects),
      effects
    };
  });

  const allEffects = cards.flatMap((card) => card.effects);
  const unsupported = cards.flatMap((card) =>
    card.effects
      .filter((effect) => effect.unsupportedReason)
      .map((effect) => ({
        entityName: card.entityName,
        rawText: effect.rawText,
        reason: effect.unsupportedReason ?? ""
      }))
  );
  const hasReactionTriggers = allEffects.some((effect) => actionEventKey(effect.triggerEvent));
  const hasTempoOutputs = allEffects.some((effect) => tempoActionTypes.has(effect.actionType) && effect.totalValue != null);
  const hasPositionedItems = params.items.length === 0 || params.items.every((item) => context.placementByItemId.has(item.id));
  const warnings = compact([
    "当前模拟是理论时间轴，不代表真实胜率或官方战斗结果。",
    hasReactionTriggers ? "事件触发只展开一层，不递归计算后续连锁。" : "",
    hasTempoOutputs ? "加速、减速、冻结、充能、冷却减少只汇总施加量，暂不反向改写后续冷却时间轴。" : "",
    hasPositionedItems ? "" : "部分物品没有合法棋盘位置，位置类效果会被跳过。"
  ]);

  return {
    durationSeconds,
    totalItemUses: [...context.itemUseCounts.values()].reduce((sum, count) => sum + count, 0),
    totals: totalsFromEffects(allEffects),
    cards,
    warnings,
    unsupported
  };
}

export function sourceOrderForLayout(layout: BoardLayout | null, left: SimulatableItem, right: SimulatableItem): number {
  const leftPlacement = layout?.placements.find((placement) => placement.itemId === left.id);
  const rightPlacement = layout?.placements.find((placement) => placement.itemId === right.id);
  if (leftPlacement && rightPlacement) {
    if (isLeftOf(leftPlacement, rightPlacement)) return -1;
    if (isRightOf(leftPlacement, rightPlacement)) return 1;
  }
  return left.name.localeCompare(right.name);
}
