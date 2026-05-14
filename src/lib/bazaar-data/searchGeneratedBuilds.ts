import { mechanicGroups, mechanicLabel, scoreItemMechanics } from "./mechanics";
import type {
  BuildMechanicProfile,
  BuildSearchInput,
  GeneratedBuild,
  ItemDef,
  MechanicKey,
  RecommendedItem
} from "./types";

function selectedIds(input: Pick<BuildSearchInput, "itemIds" | "skillIds">): string[] {
  return [...(input.itemIds ?? []), ...(input.skillIds ?? [])].filter(Boolean);
}

function requestedMechanics(
  input: Pick<BuildSearchInput, "coreOutputs" | "tempoMechanics" | "controlMechanics" | "sustainMechanics">
): MechanicKey[] {
  return [
    ...(input.coreOutputs ?? []),
    ...(input.tempoMechanics ?? []),
    ...(input.controlMechanics ?? []),
    ...(input.sustainMechanics ?? [])
  ].filter(Boolean);
}

const mechanicFilterGroups = [
  "coreOutputs",
  "tempoMechanics",
  "controlMechanics",
  "sustainMechanics"
] as const satisfies Array<keyof Pick<BuildSearchInput, "coreOutputs" | "tempoMechanics" | "controlMechanics" | "sustainMechanics">>;

function requestedMechanicMinimum(mechanic: MechanicKey): number {
  if (mechanicGroups.winCondition.includes(mechanic)) return 25;
  return 20;
}

function mechanicScoreFromScores(scores: Partial<Record<MechanicKey, number>>, mechanic: MechanicKey, thresholdScale = 1): number {
  const score = scores[mechanic] ?? 0;
  return score >= requestedMechanicMinimum(mechanic) * thresholdScale ? Math.min(100, score) : 0;
}

function mechanicScore(profile: BuildMechanicProfile, mechanic: MechanicKey): number {
  return mechanicScoreFromScores(profile.scores, mechanic);
}

function mechanicGroupMatchScore(profile: BuildMechanicProfile, mechanics: MechanicKey[] | undefined): number | null {
  if (!mechanics || mechanics.length === 0) return null;
  return Math.max(...mechanics.map((mechanic) => mechanicScore(profile, mechanic)));
}

function calculateMechanicScoreFromScores(
  scores: Partial<Record<MechanicKey, number>>,
  filters: Pick<BuildSearchInput, "coreOutputs" | "tempoMechanics" | "controlMechanics" | "sustainMechanics">,
  thresholdScale = 1
): number {
  const groupScores = mechanicFilterGroups
    .map((group) => {
      const mechanics = filters[group];
      return mechanics && mechanics.length > 0
        ? Math.max(...mechanics.map((mechanic) => mechanicScoreFromScores(scores, mechanic, thresholdScale)))
        : null;
    })
    .filter((score): score is number => score != null);

  if (groupScores.length === 0) {
    return 100;
  }

  const total = groupScores.reduce((sum, score) => sum + score, 0);
  return Math.round(total / groupScores.length);
}

export function mechanicFiltersMatchProfile(
  profile: BuildMechanicProfile,
  filters: Pick<BuildSearchInput, "coreOutputs" | "tempoMechanics" | "controlMechanics" | "sustainMechanics">
): boolean {
  return mechanicFilterGroups.every((group) => {
    const groupScore = mechanicGroupMatchScore(profile, filters[group]);
    return groupScore == null || groupScore > 0;
  });
}

function buildContainsAll(build: GeneratedBuild, ids: string[]): boolean {
  const buildIds = new Set([...build.itemIds, ...build.skillIds]);
  return ids.every((id) => buildIds.has(id));
}

function buildContainsAny(build: GeneratedBuild, ids: string[]): boolean {
  const buildIds = new Set([...build.itemIds, ...build.skillIds]);
  return ids.some((id) => buildIds.has(id));
}

export function scoreBuildMatch(build: GeneratedBuild, input: Pick<BuildSearchInput, "itemIds" | "skillIds">): number {
  const ids = selectedIds(input);
  if (ids.length === 0) {
    return 100;
  }

  const buildIds = new Set([...build.itemIds, ...build.skillIds]);
  const matched = ids.filter((id) => buildIds.has(id)).length;
  return Math.round((matched / ids.length) * 100);
}

export function calculateMechanicMatchScore(
  profile: BuildMechanicProfile,
  filters: Pick<BuildSearchInput, "coreOutputs" | "tempoMechanics" | "controlMechanics" | "sustainMechanics">
): number {
  return calculateMechanicScoreFromScores(profile.scores, filters);
}

function normalizedLayoutScore(build: GeneratedBuild): number {
  return Math.max(0, Math.min(100, Math.round(build.layoutScore ?? build.layout?.layoutScore ?? 0)));
}

export function searchGeneratedBuilds(builds: GeneratedBuild[], input: BuildSearchInput): GeneratedBuild[] {
  const mode = input.mode ?? "similar";
  const ids = selectedIds(input);
  const limit = input.limit ?? 50;
  const mechanics = requestedMechanics(input);

  return builds
    .filter((build) => !input.hero || build.hero === input.hero)
    .filter((build) => {
      if (ids.length === 0) return true;
      if (mode === "exact") return buildContainsAll(build, ids);
      return buildContainsAny(build, ids);
    })
    .filter((build) => {
      if (mechanics.length === 0) return true;
      return mechanicFiltersMatchProfile(build.mechanicProfile, input);
    })
    .map((build) => {
      const matchScore = scoreBuildMatch(build, input);
      const mechanicMatchScore = calculateMechanicMatchScore(build.mechanicProfile, input);
      const layoutScoreNormalized = normalizedLayoutScore(build);
      const hasSelectedEntities = ids.length > 0;
      const finalScore = hasSelectedEntities
        ? Math.round(build.powerScore * 0.45 + matchScore * 0.2 + mechanicMatchScore * 0.25 + layoutScoreNormalized * 0.1)
        : Math.round(build.powerScore * 0.5 + mechanicMatchScore * 0.35 + layoutScoreNormalized * 0.15);
      return { ...build, matchScore, mechanicMatchScore, finalScore };
    })
    .sort((a, b) => (b.finalScore ?? b.powerScore) - (a.finalScore ?? a.powerScore))
    .slice(0, limit);
}

export function recommendNextItems(
  builds: GeneratedBuild[],
  input: Pick<
    BuildSearchInput,
    "hero" | "itemIds" | "skillIds" | "coreOutputs" | "tempoMechanics" | "controlMechanics" | "sustainMechanics"
  >,
  limit = 12,
  itemCatalog: Array<Pick<ItemDef, "id" | "name" | "tags" | "structuredEffects" | "semanticEffects" | "text">> = []
): RecommendedItem[] {
  const selected = selectedIds(input);
  const mechanics = requestedMechanics(input);
  const selectedItems = new Set(input.itemIds ?? []);
  const itemById = new Map(itemCatalog.map((item) => [item.id, item]));

  if (selected.length === 0 && mechanics.length === 0) {
    return [];
  }

  const matchingBuilds = builds.filter((build) => {
    if (input.hero && build.hero !== input.hero) return false;
    if (selected.length > 0 && !buildContainsAll(build, selected)) return false;
    if (mechanics.length > 0 && !mechanicFiltersMatchProfile(build.mechanicProfile, input)) return false;
    return true;
  });

  const stats = new Map<
    string,
    {
      itemName: string;
      count: number;
      totalPower: number;
      totalMechanicMatch: number;
      candidateMechanicScore: number;
    }
  >();

  for (const build of matchingBuilds) {
    const mechanicMatchScore = calculateMechanicMatchScore(build.mechanicProfile, input);
    for (let index = 0; index < build.itemIds.length; index += 1) {
      const itemId = build.itemIds[index];
      if (selectedItems.has(itemId)) continue;
      const current = stats.get(itemId) ?? {
        itemName: build.itemNames[index] ?? itemId,
        count: 0,
        totalPower: 0,
        totalMechanicMatch: 0,
        candidateMechanicScore: 0
      };
      const item = itemById.get(itemId);
      if (item) {
        const itemScores = scoreItemMechanics({
          ...item,
          id: item.id,
          slug: item.id,
          name: item.name,
          hero: null,
          size: 1,
          cooldownMs: null,
          value: null,
          rarity: null,
          imageUrl: null,
          sourceIds: [],
          structuredEffects: item.structuredEffects,
          semanticEffects: item.semanticEffects,
          raw: {}
        });
        current.candidateMechanicScore =
          mechanics.length === 0
            ? 0
            : calculateMechanicScoreFromScores(itemScores, input, 0.6);
      }
      current.count += 1;
      current.totalPower += build.powerScore;
      current.totalMechanicMatch += mechanicMatchScore;
      stats.set(itemId, current);
    }
  }

  return [...stats.entries()]
    .map(([itemId, stat]) => {
      const averagePower = stat.totalPower / Math.max(stat.count, 1);
      const averageMechanicMatch = stat.totalMechanicMatch / Math.max(stat.count, 1);
      const requestedLabel = mechanics.map((mechanic) => mechanicLabel(mechanic)).join(" / ");
      const hasMechanicFilters = mechanics.length > 0;
      const candidateMechanicScore = stat.candidateMechanicScore;
      return {
        itemId,
        itemName: stat.itemName,
        count: stat.count,
        recommendationScore: hasMechanicFilters
          ? Math.round(candidateMechanicScore * 2.4 + averageMechanicMatch * 0.6 + averagePower * 0.25 + stat.count * 4)
          : Math.round(stat.count * 10 + averagePower),
        reasons:
          hasMechanicFilters
            ? [`出现在 ${stat.count} 个匹配 ${requestedLabel} 的生成构筑中。`]
            : [`出现在 ${stat.count} 个匹配的生成构筑中。`]
      };
    })
    .filter((item) => {
      if (mechanics.length === 0 || itemCatalog.length === 0) return true;
      return (stats.get(item.itemId)?.candidateMechanicScore ?? 0) > 0;
    })
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
    .slice(0, limit);
}
