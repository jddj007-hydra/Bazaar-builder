import { asRecord, isEntityAvailableForHero } from "./cardRecord";
import { semanticActionTypes, semanticUnknownCount } from "./semanticConsumption";
import {
  hasDamagePlan,
  hasDefensePlan,
  scoreEntityPair,
  scoringConfig
} from "./synergy";
import { optimizeLayoutForBuild } from "./optimizeLayout";
import { buildMechanicProfile } from "./mechanics";
import type {
  BuildMechanicProfile,
  BoardLayout,
  BuildGenerationParams,
  GeneratedBuild,
  HeroDef,
  ItemDef,
  NormalizedData,
  SkillDef
} from "./types";

export const defaultBuildGenerationParams: BuildGenerationParams = {
  boardSlotLimit: 10,
  maxItems: 8,
  maxSkills: 3,
  beamWidth: 300,
  topBuildsPerHero: 500
};

type BeamState = {
  items: ItemDef[];
  usedSlots: number;
  rawScore: number;
  reasons: string[];
};

type DraftBuild = GeneratedBuild & {
  rawScore: number;
};

const itemBaseScoreCache = new WeakMap<ItemDef, number>();
const skillBaseScoreCache = new WeakMap<SkillDef, number>();
const itemPairScoreCache = new WeakMap<object, Map<string, ReturnType<typeof scoreEntityPair>>>();

function rarityScore(rarity?: string | null): number {
  switch (rarity?.toLowerCase()) {
    case "legendary":
      return 16;
    case "diamond":
      return 13;
    case "gold":
      return 10;
    case "silver":
      return 7;
    case "bronze":
      return 5;
    default:
      return 6;
  }
}

function actionScore(entity: ItemDef | SkillDef): number {
  const actions = semanticActionTypes(entity);
  let score = 0;
  if (actions.has("damage")) score += 16;
  if (actions.has("burn") || actions.has("poison")) score += 14;
  if (actions.has("shield") || actions.has("heal")) score += 10;
  if (actions.has("haste") || actions.has("charge")) score += 9;
  if (actions.has("freeze") || actions.has("slow")) score += 8;
  if (actions.has("buff_tag") || actions.has("gain_stat")) score += 8;
  if (actions.has("multicast")) score += 12;
  if (actions.has("destroy")) score += 8;
  if (actions.has("gain_gold") || actions.has("increase_value")) score += 5;
  return score;
}

export function baseItemScore(item: ItemDef): number {
  const cached = itemBaseScoreCache.get(item);
  if (cached != null) return cached;
  const activeBonus = item.cooldownMs ? 10 : 0;
  const sizeEfficiency = item.size === 1 ? 8 : item.size === 2 ? 4 : 0;
  const score = 10 + rarityScore(item.rarity) + actionScore(item) + activeBonus + sizeEfficiency - semanticUnknownCount(item) * 3;
  itemBaseScoreCache.set(item, score);
  return score;
}

export function baseSkillScore(skill: SkillDef): number {
  const cached = skillBaseScoreCache.get(skill);
  if (cached != null) return cached;
  const score = 8 + rarityScore(skill.rarity) + actionScore(skill) - semanticUnknownCount(skill) * 2;
  skillBaseScoreCache.set(skill, score);
  return score;
}

function cachedEntityPair(a: ItemDef | SkillDef, b: ItemDef | SkillDef): ReturnType<typeof scoreEntityPair> {
  const first = a.id <= b.id ? a : b;
  const second = a.id <= b.id ? b : a;
  let cache = itemPairScoreCache.get(first);
  if (!cache) {
    cache = new Map();
    itemPairScoreCache.set(first, cache);
  }
  const key = second.id;
  const cached = cache.get(key);
  if (cached) return cached;
  const score = scoreEntityPair(first, second);
  cache.set(key, score);
  return score;
}

function buildKey(itemIds: string[], skillIds: string[] = []): string {
  return `${[...itemIds].sort().join("|")}::${[...skillIds].sort().join("|")}`;
}

function compactReasons(reasons: string[]): string[] {
  return [...new Set(reasons)].filter(Boolean).slice(0, 8);
}

function scoreNewItem(state: BeamState, item: ItemDef): { score: number; reasons: string[] } {
  let score = baseItemScore(item);
  const reasons = [`${item.name} 提供 ${Math.round(score)} 点基础物品分。`];

  for (const existing of state.items) {
    const pair = cachedEntityPair(existing, item);
    score += pair.score;
    reasons.push(...pair.reasons);
  }

  return { score, reasons };
}

function makeSeededBuild(seed: ItemDef, candidates: ItemDef[], params: BuildGenerationParams): BeamState | null {
  let state: BeamState = {
    items: [seed],
    usedSlots: seed.size,
    rawScore: baseItemScore(seed),
    reasons: [`${seed.name} 提供 ${Math.round(baseItemScore(seed))} 点基础物品分。`]
  };

  while (state.items.length < params.maxItems && state.usedSlots < params.boardSlotLimit) {
    const used = new Set(state.items.map((item) => item.id));
    let best: { item: ItemDef; score: number; reasons: string[] } | null = null;

    for (const candidate of candidates) {
      if (used.has(candidate.id)) continue;
      if (state.usedSlots + candidate.size > params.boardSlotLimit) continue;

      const delta = scoreNewItem(state, candidate);
      if (!best || delta.score > best.score) {
        best = { item: candidate, ...delta };
      }
    }

    if (!best) break;

    state = {
      items: [...state.items, best.item],
      usedSlots: state.usedSlots + best.item.size,
      rawScore: state.rawScore + best.score,
      reasons: compactReasons([...state.reasons, ...best.reasons])
    };
  }

  return state.items.length >= 4 ? state : null;
}

function makeItemBeams(candidates: ItemDef[], params: BuildGenerationParams): BeamState[] {
  let beams: BeamState[] = [{ items: [], usedSlots: 0, rawScore: 0, reasons: [] }];
  const completed = new Map<string, BeamState>();
  const sortedCandidates = [...candidates].sort((a, b) => baseItemScore(b) - baseItemScore(a));

  for (const seed of sortedCandidates) {
    const seeded = makeSeededBuild(seed, sortedCandidates, params);
    if (!seeded) continue;

    const key = buildKey(seeded.items.map((item) => item.id));
    const existing = completed.get(key);
    if (!existing || existing.rawScore < seeded.rawScore) {
      completed.set(key, seeded);
    }
  }

  for (let depth = 0; depth < params.maxItems; depth += 1) {
    const expanded = new Map<string, BeamState>();

    for (const state of beams) {
      const used = new Set(state.items.map((item) => item.id));
      for (const candidate of sortedCandidates) {
        if (used.has(candidate.id)) continue;
        if (state.usedSlots + candidate.size > params.boardSlotLimit) continue;

        const delta = scoreNewItem(state, candidate);
        const nextItems = [...state.items, candidate];
        const next: BeamState = {
          items: nextItems,
          usedSlots: state.usedSlots + candidate.size,
          rawScore: state.rawScore + delta.score,
          reasons: compactReasons([...state.reasons, ...delta.reasons])
        };
        const key = buildKey(nextItems.map((item) => item.id));
        const existing = expanded.get(key);
        if (!existing || existing.rawScore < next.rawScore) {
          expanded.set(key, next);
        }
      }
    }

    beams = [...expanded.values()].sort((a, b) => b.rawScore - a.rawScore).slice(0, params.beamWidth);

    for (const state of beams) {
      if (state.items.length >= 4) {
        const key = buildKey(state.items.map((item) => item.id));
        const existing = completed.get(key);
        if (!existing || existing.rawScore < state.rawScore) {
          completed.set(key, state);
        }
      }
    }
  }

  return [...completed.values()].sort((a, b) => b.rawScore - a.rawScore);
}

function skillScoreForItems(skill: SkillDef, items: ItemDef[]): { score: number; reasons: string[] } {
  let score = baseSkillScore(skill);
  const reasons = [`${skill.name} 提供 ${Math.round(score)} 点基础技能分。`];
  for (const item of items) {
    const pair = cachedEntityPair(skill, item);
    score += pair.score;
    reasons.push(...pair.reasons);
  }
  return { score, reasons };
}

function selectSkillVariants(skills: SkillDef[], items: ItemDef[], params: BuildGenerationParams): Array<{ skills: SkillDef[]; score: number; reasons: string[] }> {
  const ranked = skills
    .map((skill) => ({ skill, ...skillScoreForItems(skill, items) }))
    .filter((entry) => entry.score > 12)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(params.maxSkills, 1) + 4);

  const variants: Array<{ skills: SkillDef[]; score: number; reasons: string[] }> = [{ skills: [], score: 0, reasons: [] }];

  for (let count = 1; count <= params.maxSkills; count += 1) {
    const chosen = ranked.slice(0, count);
    if (chosen.length === count) {
      let pairScore = 0;
      const pairReasons: string[] = [];
      for (let i = 0; i < chosen.length; i += 1) {
        for (let j = i + 1; j < chosen.length; j += 1) {
          const pair = cachedEntityPair(chosen[i].skill, chosen[j].skill);
          pairScore += pair.score;
          pairReasons.push(...pair.reasons);
        }
      }

      variants.push({
        skills: chosen.map((entry) => entry.skill),
        score: chosen.reduce((sum, entry) => sum + entry.score, 0) + pairScore,
        reasons: compactReasons([...chosen.flatMap((entry) => entry.reasons), ...pairReasons])
      });
    }
  }

  return variants;
}

function finalPenalties(items: ItemDef[], skills: SkillDef[]): { penalty: number; warnings: string[] } {
  const all = [...items, ...skills];
  const warnings: string[] = [];
  let penalty = 0;

  if (!all.some(hasDamagePlan)) {
    penalty += scoringConfig.noDamagePenalty;
    warnings.push("未检测到明确的伤害、燃烧或中毒终结手段。");
  }

  if (items.length >= 5 && !all.some(hasDefensePlan)) {
    penalty += scoringConfig.noDefensePenalty;
    warnings.push("未检测到明确的防御或控制层。");
  }

  const largeCount = items.filter((item) => item.size === 3).length;
  if (largeCount >= 3) {
    penalty += scoringConfig.tooManyLargeItemsPenalty * (largeCount - 2);
    warnings.push("大型物品偏多，棋盘空间可能不够灵活。");
  }

  const cooldownCount = items.filter((item) => item.cooldownMs != null).length;
  if (items.length >= 5 && cooldownCount < 2) {
    penalty += 14;
    warnings.push("主动冷却物品偏少。");
  }

  const tagCounts = new Map<string, number>();
  for (const item of items) {
    for (const tag of item.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const dominantTags = [...tagCounts.values()].filter((count) => count >= 2).length;
  if (items.length >= 5 && dominantTags === 0) {
    penalty += scoringConfig.unrelatedTagsPenalty;
    warnings.push("物品标签之间关联较弱。");
  }

  const unknowns = all.reduce((sum, entity) => sum + semanticUnknownCount(entity), 0);
  if (unknowns >= 3) {
    penalty += Math.min(unknowns * 4, 32);
    warnings.push("部分效果未能高置信解析。");
  }

  const sourceIds = new Set(items.flatMap((item) => item.sourceIds ?? []));
  if (sourceIds.size > 3) {
    warnings.push("部分生成物品可能不来自同一个来源池。");
  }

  return { penalty, warnings };
}

function inferArchetype(profile: BuildMechanicProfile): string {
  const { primary, secondary, roles } = profile;

  if (primary === "weapon_damage" && secondary.includes("crit")) return "Crit Weapon Damage";
  if (primary === "weapon_damage" && roles.enablers.some((mechanic) => mechanic === "haste" || mechanic === "charge")) {
    return "Weapon Damage Tempo";
  }
  if (primary === "weapon_damage") return "Weapon Damage";
  if (primary === "crit" && secondary.includes("weapon_damage")) return "Crit Weapon Damage";
  if (primary === "crit") return "Crit Damage";
  if (primary === "burn") return "Burn Engine";
  if (primary === "poison") return "Poison Engine";
  if (primary === "shield_scaling") return "Shield Scaling";
  if (roles.control.includes("freeze") && roles.enablers.some((mechanic) => mechanic === "haste" || mechanic === "charge")) return "Freeze Tempo";
  if (roles.enablers.some((mechanic) => mechanic === "haste" || mechanic === "charge") && roles.winCondition.includes("damage")) {
    return "Haste Damage Tempo";
  }
  if (roles.control.includes("freeze")) return "Freeze Control";
  if (roles.control.includes("slow")) return "Slow Control";
  if (roles.sustain.includes("heal")) return "Heal Sustain";
  if (roles.sustain.includes("shield")) return "Shield Sustain";
  if (roles.scaling.includes("economy")) return "Economy Scaling";
  if (primary === "damage") return "Damage Engine";
  return "Hybrid Build";
}

function makeDraftBuild(
  hero: HeroDef,
  itemState: BeamState,
  skillVariant: { skills: SkillDef[]; score: number; reasons: string[] },
  layout: BoardLayout
): DraftBuild {
  const items = itemState.items;
  const skills = skillVariant.skills;
  const penalties = finalPenalties(items, skills);
  const mechanicProfile = buildMechanicProfile({ items, skills, layout });
  const rawScore = itemState.rawScore + skillVariant.score + layout.layoutScore - penalties.penalty;
  const imageUrls = [...items, ...skills].map((entity) => entity.imageUrl).filter((url): url is string => Boolean(url));

  return {
    id: `${hero.slug}-${buildKey(items.map((item) => item.id), skills.map((skill) => skill.id)).replace(/[^a-zA-Z0-9]+/g, "-")}`,
    hero: hero.slug,
    itemIds: items.map((item) => item.id),
    itemNames: items.map((item) => item.name),
    skillIds: skills.map((skill) => skill.id),
    skillNames: skills.map((skill) => skill.name),
    usedSlots: layout.usedSlots,
    layout,
    layoutScore: layout.layoutScore,
    powerScore: 0,
    archetype: inferArchetype(mechanicProfile),
    mechanicProfile,
    reasons: compactReasons([...itemState.reasons, ...skillVariant.reasons, ...layout.reasons]),
    warnings: compactReasons([...penalties.warnings, ...layout.warnings]),
    imageUrls: imageUrls.slice(0, 8),
    rawScore
  };
}

function normalizeDraftScores(builds: DraftBuild[]): GeneratedBuild[] {
  if (builds.length === 0) {
    return [];
  }

  const scores = builds.map((build) => build.rawScore);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const span = Math.max(max - min, 1);

  return builds.map(({ rawScore, ...build }) => ({
    ...build,
    powerScore: Math.max(0, Math.min(100, Math.round(35 + ((rawScore - min) / span) * 65)))
  }));
}

function selectBuildsWithItemCoverage(
  drafts: DraftBuild[],
  heroItems: ItemDef[],
  limit: number
): DraftBuild[] {
  const selected = new Map<string, DraftBuild>();

  for (const item of heroItems) {
    const best = drafts.find((build) => build.itemIds.includes(item.id));
    if (best) {
      selected.set(best.id, best);
    }
  }

  for (const draft of drafts) {
    if (selected.size >= limit) break;
    selected.set(draft.id, draft);
  }

  return [...selected.values()].sort((a, b) => b.rawScore - a.rawScore).slice(0, limit);
}

export function generateBuilds(
  data: Pick<NormalizedData, "heroes" | "items" | "skills">,
  params: Partial<BuildGenerationParams> = {}
): GeneratedBuild[] {
  const resolvedParams = { ...defaultBuildGenerationParams, ...params };
  const allBuilds: GeneratedBuild[] = [];

  for (const hero of data.heroes) {
    const heroItems = data.items.filter((item) => isEntityAvailableForHero(asRecord(item.raw), hero.slug));
    const heroSkills = data.skills.filter((skill) => isEntityAvailableForHero(asRecord(skill.raw), hero.slug));
    const itemBeams = makeItemBeams(heroItems, resolvedParams);
    const drafts = new Map<string, DraftBuild>();
    const layoutCache = new Map<string, BoardLayout>();

    for (const state of itemBeams) {
      const itemIds = state.items.map((item) => item.id);
      const layoutKey = buildKey(itemIds);
      let layout = layoutCache.get(layoutKey);
      if (!layout) {
        layout = optimizeLayoutForBuild({
          items: state.items,
          skills: [],
          slotLimit: resolvedParams.boardSlotLimit,
          beamWidth: Math.min(resolvedParams.beamWidth, 80),
          maxLayouts: 700,
          allowGaps: false
        });
        layoutCache.set(layoutKey, layout);
      }

      for (const skillVariant of selectSkillVariants(heroSkills, state.items, resolvedParams)) {
        const key = buildKey(
          itemIds,
          skillVariant.skills.map((skill) => skill.id)
        );
        const draft = makeDraftBuild(hero, state, skillVariant, layout);
        const existing = drafts.get(key);
        if (!existing || existing.rawScore < draft.rawScore) {
          drafts.set(key, draft);
        }
      }
    }

    const sortedDrafts = [...drafts.values()].sort((a, b) => b.rawScore - a.rawScore);
    const selectedDrafts = selectBuildsWithItemCoverage(sortedDrafts, heroItems, resolvedParams.topBuildsPerHero);
    const normalized = normalizeDraftScores(selectedDrafts);
    allBuilds.push(...normalized.sort((a, b) => b.powerScore - a.powerScore));
  }

  return allBuilds;
}
