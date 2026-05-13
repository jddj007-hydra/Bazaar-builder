import { itemMatchesStructuredEffectTarget } from "./positionEffects";
import { structuredEffectViews, type StructuredEffectView } from "./structuredEffects";
import type { EffectActionType, ItemDef, ItemSize, PlacedItem, SkillDef } from "./types";

const HIGH_VALUE_POSITIONAL_ACTIONS = new Set<EffectActionType>([
  "haste",
  "charge",
  "reduce_cooldown",
  "damage",
  "shield",
  "buff_tag",
  "gain_stat",
  "multicast"
]);

export function isValidPlacement(
  placements: PlacedItem[],
  itemSize: ItemSize,
  startSlot: number,
  slotLimit: number
): boolean {
  if (!Number.isInteger(startSlot) || startSlot < 0) return false;
  const endSlot = startSlot + itemSize - 1;
  if (endSlot >= slotLimit) return false;

  const occupied = getOccupiedSlots(placements);
  for (let slot = startSlot; slot <= endSlot; slot += 1) {
    if (occupied.has(slot)) return false;
  }

  return true;
}

export function placeItem(placements: PlacedItem[], item: ItemDef, startSlot: number): PlacedItem[] {
  return [
    ...placements,
    {
      itemId: item.id,
      itemName: item.name,
      size: item.size,
      startSlot,
      endSlot: startSlot + item.size - 1
    }
  ].sort((a, b) => a.startSlot - b.startSlot);
}

export function getOccupiedSlots(placements: PlacedItem[]): Set<number> {
  const occupied = new Set<number>();
  for (const placement of placements) {
    for (let slot = placement.startSlot; slot <= placement.endSlot; slot += 1) {
      occupied.add(slot);
    }
  }
  return occupied;
}

export function getEmptySlots(placements: PlacedItem[], slotLimit: number): number[] {
  const occupied = getOccupiedSlots(placements);
  return Array.from({ length: slotLimit }, (_, slot) => slot).filter((slot) => !occupied.has(slot));
}

export function isLeftOf(a: PlacedItem, b: PlacedItem): boolean {
  return a.endSlot < b.startSlot;
}

export function isRightOf(a: PlacedItem, b: PlacedItem): boolean {
  return a.startSlot > b.endSlot;
}

export function isAdjacent(a: PlacedItem, b: PlacedItem): boolean {
  return a.endSlot + 1 === b.startSlot || b.endSlot + 1 === a.startSlot;
}

export function getLeftNeighbor(item: PlacedItem, placements: PlacedItem[]): PlacedItem | null {
  return placements.find((candidate) => candidate.endSlot + 1 === item.startSlot) ?? null;
}

export function getRightNeighbor(item: PlacedItem, placements: PlacedItem[]): PlacedItem | null {
  return placements.find((candidate) => item.endSlot + 1 === candidate.startSlot) ?? null;
}

export function getAdjacentNeighbors(item: PlacedItem, placements: PlacedItem[]): PlacedItem[] {
  return [getLeftNeighbor(item, placements), getRightNeighbor(item, placements)].filter(
    (neighbor): neighbor is PlacedItem => Boolean(neighbor)
  );
}

function compactReasons(reasons: string[]): string[] {
  return [...new Set(reasons)].filter(Boolean).slice(0, 12);
}

function compactWarnings(warnings: string[]): string[] {
  return [...new Set(warnings)].filter(Boolean).slice(0, 12);
}

function itemEffects(item: ItemDef): StructuredEffectView[] {
  return structuredEffectViews(item.structuredEffects);
}

function hasAction(item: ItemDef, actions: EffectActionType[]): boolean {
  return itemEffects(item).some((effect) => actions.includes(effect.action.type));
}

function isPayoffItem(item: ItemDef): boolean {
  return (
    hasAction(item, ["damage", "burn", "poison", "gain_stat", "multicast", "increase_value"]) ||
    item.tags.includes("weapon") ||
    item.tags.includes("shield") ||
    Boolean(item.cooldownMs && item.cooldownMs >= 6000)
  );
}

function effectBaseValue(effect: StructuredEffectView): number {
  switch (effect.action.type) {
    case "charge":
      return 18;
    case "haste":
    case "reduce_cooldown":
      return 16;
    case "multicast":
      return 15;
    case "damage":
    case "buff_tag":
    case "gain_stat":
      return 13;
    case "shield":
      return 11;
    case "heal":
    case "burn":
    case "poison":
      return 9;
    default:
      return effect.trigger.event === "adjacent_item_used" ? 8 : 5;
  }
}

function targetPayoffValue(effect: StructuredEffectView, target: ItemDef): number {
  let score = 0;

  if (target.cooldownMs && target.cooldownMs >= 8000) score += effect.action.type === "haste" || effect.action.type === "charge" ? 16 : 9;
  else if (target.cooldownMs && target.cooldownMs >= 6000) score += effect.action.type === "haste" || effect.action.type === "charge" ? 11 : 6;
  else if (target.cooldownMs && target.cooldownMs <= 5000 && effect.trigger.event === "adjacent_item_used") score += 10;

  if (hasAction(target, ["damage", "burn", "poison"])) score += 8;
  if (hasAction(target, ["gain_stat", "multicast", "increase_value"])) score += 6;
  if (target.tags.includes("weapon")) score += 6;
  if (target.tags.includes("tool")) score += 4;
  if (target.tags.includes("shield")) score += 4;

  return score;
}

function targetLabel(effect: StructuredEffectView): string {
  const parts = [
    effect.target?.tag ? `${effect.target.tag} 标签` : null,
    effect.target?.size ? `${effect.target.size} 格` : null
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("、") : "目标";
}

function scoreTargetedNeighbor(source: ItemDef, target: ItemDef, effect: StructuredEffectView, relation: string): { score: number; reasons: string[]; warnings: string[] } {
  if (!itemMatchesStructuredEffectTarget(target, effect.target)) {
    return {
      score: -8,
      reasons: [],
      warnings: [`${source.name} 需要${relation}${targetLabel(effect)}，但 ${target.name} 不匹配。`]
    };
  }

  const score = effectBaseValue(effect) + targetPayoffValue(effect, target) + (effect.target?.tag || effect.target?.size ? 5 : 0);
  const reasons = [`${source.name} 的${relation}效果命中 ${target.name}。`];

  return { score, reasons, warnings: [] };
}

function scoreAdjacentEffect(
  source: ItemDef,
  placement: PlacedItem,
  itemById: Map<string, ItemDef>,
  placements: PlacedItem[],
  effect: StructuredEffectView
): { score: number; reasons: string[]; warnings: string[] } {
  const neighbors = getAdjacentNeighbors(placement, placements);
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  if (neighbors.length === 0) {
    return {
      score: -12,
      reasons,
      warnings: [`${source.name} 有相邻位置效果，但两侧没有物品。`]
    };
  }

  let matched = 0;
  for (const neighborPlacement of neighbors) {
    const neighbor = itemById.get(neighborPlacement.itemId);
    if (!neighbor) continue;
    const next = scoreTargetedNeighbor(source, neighbor, effect, "相邻");
    score += next.score;
    reasons.push(...next.reasons);
    warnings.push(...next.warnings);
    if (next.score > 0) matched += 1;

    if (effect.trigger.event === "adjacent_item_used" && neighbor.cooldownMs) {
      const triggerScore = neighbor.cooldownMs <= 5000 ? 13 : 8;
      score += triggerScore;
      reasons.push(`${source.name} 会被相邻主动物品 ${neighbor.name} 触发。`);
    }
  }

  if ((effect.target?.tag || effect.target?.size) && matched === 0) {
    score -= 8;
    warnings.push(`${source.name} 的相邻${targetLabel(effect)}没有命中。`);
  }

  if (HIGH_VALUE_POSITIONAL_ACTIONS.has(effect.action.type) && neighbors.length === 1 && placements.length >= 3) {
    score -= 4;
    warnings.push(`${source.name} 的强相邻收益只吃到一侧邻居。`);
  }

  return { score, reasons, warnings };
}

function scoreDirectionalEffect(
  source: ItemDef,
  placement: PlacedItem,
  itemById: Map<string, ItemDef>,
  placements: PlacedItem[],
  effect: StructuredEffectView,
  direction: "left" | "right"
): { score: number; reasons: string[]; warnings: string[] } {
  const neighborPlacement = direction === "left" ? getLeftNeighbor(placement, placements) : getRightNeighbor(placement, placements);
  const relation = direction === "left" ? "左侧" : "右侧";

  if (!neighborPlacement) {
    return {
      score: -14,
      reasons: [],
      warnings: [`${source.name} 有${relation}目标效果，但${relation}没有相邻物品。`]
    };
  }

  const neighbor = itemById.get(neighborPlacement.itemId);
  if (!neighbor) {
    return { score: -8, reasons: [], warnings: [`${source.name} 的${relation}目标无法解析。`] };
  }

  const scored = scoreTargetedNeighbor(source, neighbor, effect, relation);
  return {
    ...scored,
    score: scored.score + (scored.score > 0 ? 5 : 0)
  };
}

function scoreExtremeEffect(
  source: ItemDef,
  placement: PlacedItem,
  itemById: Map<string, ItemDef>,
  placements: PlacedItem[],
  effect: StructuredEffectView,
  side: "leftmost" | "rightmost"
): { score: number; reasons: string[]; warnings: string[] } {
  const sorted = [...placements].sort((a, b) => a.startSlot - b.startSlot);
  const targetPlacement = side === "leftmost" ? sorted[0] : sorted[sorted.length - 1];
  const target = targetPlacement ? itemById.get(targetPlacement.itemId) : null;
  const relation = side === "leftmost" ? "最左侧" : "最右侧";

  if (!target) {
    return { score: -6, reasons: [], warnings: [`${source.name} 的${relation}目标无法解析。`] };
  }

  const scored = scoreTargetedNeighbor(source, target, effect, relation);
  const edgeBonus = targetPlacement?.itemId === placement.itemId ? -3 : 3;
  return {
    ...scored,
    score: scored.score + edgeBonus
  };
}

export function scoreLayout(params: {
  items: ItemDef[];
  skills: SkillDef[];
  placements: PlacedItem[];
  slotLimit: number;
}): {
  score: number;
  reasons: string[];
  warnings: string[];
} {
  const { items, placements, slotLimit } = params;
  const itemById = new Map(items.map((item) => [item.id, item]));
  const occupied = getOccupiedSlots(placements);
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  const usedSlots = placements.reduce((sum, placement) => sum + placement.size, 0);
  if (usedSlots > slotLimit || occupied.size !== usedSlots) {
    score -= 100;
    warnings.push("布局无效：物品超过 10 格或存在重叠。");
  }

  if (items.length < 4) {
    score -= 15;
    warnings.push("少于 4 个物品，构筑密度偏低。");
  }

  const emptySlots = getEmptySlots(placements, slotLimit);
  const minOccupied = Math.min(...[...occupied]);
  const maxOccupied = Math.max(...[...occupied]);
  const internalGaps =
    occupied.size === 0
      ? 0
      : emptySlots.filter((slot) => slot > minOccupied && slot < maxOccupied).length;
  if (internalGaps > 0) {
    score -= internalGaps * 4;
    warnings.push(`布局中有 ${internalGaps} 个内部空格，位置收益可能被浪费。`);
  }

  for (const placement of placements) {
    const source = itemById.get(placement.itemId);
    if (!source) continue;

    for (const effect of itemEffects(source)) {
      const scope = effect.target?.scope;
      if (scope === "adjacent") {
        const next = scoreAdjacentEffect(source, placement, itemById, placements, effect);
        score += next.score;
        reasons.push(...next.reasons);
        warnings.push(...next.warnings);
      } else if (scope === "left" || scope === "right") {
        const next = scoreDirectionalEffect(source, placement, itemById, placements, effect, scope);
        score += next.score;
        reasons.push(...next.reasons);
        warnings.push(...next.warnings);
      } else if (scope === "leftmost" || scope === "rightmost") {
        const next = scoreExtremeEffect(source, placement, itemById, placements, effect, scope);
        score += next.score;
        reasons.push(...next.reasons);
        warnings.push(...next.warnings);
      }
    }
  }

  const largeItems = items.filter((item) => item.size === 3);
  const largePositionalPayoffs = largeItems.filter((item) => isPayoffItem(item)).length;
  if (largeItems.length >= 3 && largePositionalPayoffs < largeItems.length - 1) {
    score -= 10;
    warnings.push("大型物品偏多，但相邻位置收益不足。");
  }

  return {
    score: Math.round(score),
    reasons: compactReasons(reasons),
    warnings: compactWarnings(warnings)
  };
}
