import { getEmptySlots, isValidPlacement, placeItem, scoreLayout } from "./layout";
import type { BoardLayout, ItemDef, PlacedItem, SkillDef } from "./types";

type LayoutCandidate = {
  orderedItemIds: string[];
  remainingItemIds: string[];
  placements: PlacedItem[];
  score: number;
};

function totalSize(items: ItemDef[]): number {
  return items.reduce((sum, item) => sum + item.size, 0);
}

function rightmostEnd(placements: PlacedItem[]): number {
  return placements.reduce((max, placement) => Math.max(max, placement.endSlot), -1);
}

function itemsForPlacements(placements: PlacedItem[], itemById: Map<string, ItemDef>): ItemDef[] {
  return placements.map((placement) => itemById.get(placement.itemId)).filter((item): item is ItemDef => Boolean(item));
}

function makeBoardLayout(
  items: ItemDef[],
  skills: SkillDef[],
  placements: PlacedItem[],
  slotLimit: 10,
  extraWarnings: string[] = []
): BoardLayout {
  const scored = scoreLayout({ items, skills, placements, slotLimit });
  const usedSlots = placements.reduce((sum, placement) => sum + placement.size, 0);
  return {
    slotLimit,
    placements: [...placements].sort((a, b) => a.startSlot - b.startSlot),
    usedSlots,
    emptySlots: getEmptySlots(placements, slotLimit),
    layoutScore: scored.score,
    reasons: scored.reasons,
    warnings: [...scored.warnings, ...extraWarnings]
  };
}

function factorial(value: number): number {
  let result = 1;
  for (let index = 2; index <= value; index += 1) {
    result *= index;
  }
  return result;
}

function packOrder(order: ItemDef[], slotLimit: number): PlacedItem[] | null {
  let startSlot = 0;
  let placements: PlacedItem[] = [];

  for (const item of order) {
    if (!isValidPlacement(placements, item.size, startSlot, slotLimit)) {
      return null;
    }
    placements = placeItem(placements, item, startSlot);
    startSlot += item.size;
  }

  return placements;
}

function exactPackedSearch(items: ItemDef[], skills: SkillDef[], slotLimit: 10, maxLayouts: number): BoardLayout | null {
  const used = new Set<string>();
  const order: ItemDef[] = [];
  let evaluated = 0;
  let best: BoardLayout | null = null;

  const visit = () => {
    if (evaluated >= maxLayouts) return;

    if (order.length === items.length) {
      const placements = packOrder(order, slotLimit);
      if (!placements) return;
      evaluated += 1;
      const layout = makeBoardLayout(items, skills, placements, slotLimit);
      if (!best || layout.layoutScore > best.layoutScore) {
        best = layout;
      }
      return;
    }

    for (const item of items) {
      if (used.has(item.id)) continue;
      used.add(item.id);
      order.push(item);
      visit();
      order.pop();
      used.delete(item.id);
    }
  };

  visit();
  return best;
}

function candidateKey(candidate: LayoutCandidate): string {
  const slots = candidate.placements.map((placement) => `${placement.itemId}@${placement.startSlot}`).join("|");
  return `${candidate.orderedItemIds.join(">")}::${slots}`;
}

function scorePartialCandidate(candidate: LayoutCandidate, itemById: Map<string, ItemDef>, skills: SkillDef[], slotLimit: number): number {
  const partialItems = itemsForPlacements(candidate.placements, itemById);
  const scored = scoreLayout({ items: partialItems, skills, placements: candidate.placements, slotLimit });
  return scored.score;
}

export function optimizeLayoutForBuild(params: {
  items: ItemDef[];
  skills: SkillDef[];
  slotLimit?: number;
  beamWidth?: number;
  maxLayouts?: number;
  allowGaps?: boolean;
}): BoardLayout {
  const { items, skills, beamWidth = 200, maxLayouts = 5000, allowGaps = false } = params;
  const slotLimit: 10 = 10;
  const warnings = params.slotLimit && params.slotLimit !== 10 ? ["V1 固定使用 10 格棋盘，已忽略非 10 的 slotLimit。"] : [];
  const itemById = new Map(items.map((item) => [item.id, item]));

  if (items.length === 0) {
    return makeBoardLayout([], skills, [], slotLimit, warnings);
  }

  if (totalSize(items) > slotLimit) {
    return makeBoardLayout([], skills, [], slotLimit, [...warnings, "物品总尺寸超过 10 格，无法生成合法布局。"]);
  }

  if (!allowGaps && factorial(items.length) <= maxLayouts) {
    const exact = exactPackedSearch(items, skills, slotLimit, maxLayouts);
    if (exact) {
      return {
        ...exact,
        warnings: [...exact.warnings, ...warnings]
      };
    }
  }

  let candidates: LayoutCandidate[] = [
    {
      orderedItemIds: [],
      remainingItemIds: items.map((item) => item.id),
      placements: [],
      score: 0
    }
  ];

  while (candidates.some((candidate) => candidate.remainingItemIds.length > 0)) {
    const nextByKey = new Map<string, LayoutCandidate>();

    for (const candidate of candidates) {
      for (const itemId of candidate.remainingItemIds) {
        const item = itemById.get(itemId);
        if (!item) continue;

        const startSlots = allowGaps
          ? Array.from({ length: slotLimit - item.size + 1 }, (_, slot) => slot)
          : [rightmostEnd(candidate.placements) + 1];

        for (const startSlot of startSlots) {
          if (!isValidPlacement(candidate.placements, item.size, startSlot, slotLimit)) continue;

          const placements = placeItem(candidate.placements, item, startSlot);
          const nextCandidate: LayoutCandidate = {
            orderedItemIds: [...candidate.orderedItemIds, item.id],
            remainingItemIds: candidate.remainingItemIds.filter((remainingId) => remainingId !== item.id),
            placements,
            score: 0
          };
          nextCandidate.score = scorePartialCandidate(nextCandidate, itemById, skills, slotLimit);

          const key = candidateKey(nextCandidate);
          const existing = nextByKey.get(key);
          if (!existing || existing.score < nextCandidate.score) {
            nextByKey.set(key, nextCandidate);
          }
        }
      }
    }

    const expanded = [...nextByKey.values()].sort((a, b) => b.score - a.score).slice(0, beamWidth);
    if (expanded.length === 0) break;
    candidates = expanded;
  }

  const completeLayouts = candidates
    .filter((candidate) => candidate.remainingItemIds.length === 0)
    .slice(0, maxLayouts)
    .map((candidate) => makeBoardLayout(items, skills, candidate.placements, slotLimit, warnings));

  if (completeLayouts.length === 0) {
    return makeBoardLayout([], skills, [], slotLimit, [...warnings, "没有找到合法布局。"]);
  }

  completeLayouts.sort((a, b) => b.layoutScore - a.layoutScore);
  return completeLayouts[0];
}
