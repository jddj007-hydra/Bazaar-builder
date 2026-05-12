import {
  getAdjacentNeighbors,
  getLeftNeighbor,
  getRightNeighbor,
  isAdjacent
} from "./layout";
import { itemMatchesEffectTarget } from "./positionEffects";
import type {
  BoardLayout,
  BuildMechanicProfile,
  EffectDef,
  ItemDef,
  MechanicKey,
  PlacedItem,
  SkillDef
} from "./types";

export const allMechanics: MechanicKey[] = [
  "damage",
  "weapon_damage",
  "crit",
  "burn",
  "poison",
  "shield",
  "shield_scaling",
  "heal",
  "freeze",
  "slow",
  "haste",
  "charge",
  "reduce_cooldown",
  "multicast",
  "scaling",
  "economy",
  "control",
  "tempo",
  "sustain"
];

export const mechanicGroups = {
  winCondition: ["damage", "weapon_damage", "crit", "burn", "poison", "shield_scaling"] as MechanicKey[],
  enablers: ["haste", "charge", "reduce_cooldown", "multicast"] as MechanicKey[],
  control: ["freeze", "slow"] as MechanicKey[],
  sustain: ["shield", "heal"] as MechanicKey[],
  scaling: ["scaling", "crit", "damage", "shield_scaling", "economy"] as MechanicKey[]
};

export const mechanicWeights: Record<MechanicKey, number> = {
  damage: 20,
  weapon_damage: 24,
  crit: 18,
  burn: 18,
  poison: 18,
  shield: 12,
  shield_scaling: 22,
  heal: 10,
  freeze: 16,
  slow: 12,
  haste: 16,
  charge: 18,
  reduce_cooldown: 14,
  multicast: 22,
  scaling: 18,
  economy: 8,
  control: 14,
  tempo: 14,
  sustain: 8
};

const primaryMinimum = 25;
const secondaryMinimum = 20;
const potentialPositionalMultiplier = 0.3;

type MechanicScoreMap = Partial<Record<MechanicKey, number>>;

type PositionedEffectScore = {
  scores: MechanicScoreMap;
  explanations: string[];
};

const labelByMechanic: Record<MechanicKey, string> = {
  damage: "Damage",
  weapon_damage: "Weapon Damage",
  crit: "Crit",
  burn: "Burn",
  poison: "Poison",
  shield: "Shield",
  shield_scaling: "Shield Scaling",
  heal: "Heal",
  freeze: "Freeze",
  slow: "Slow",
  haste: "Haste",
  charge: "Charge",
  reduce_cooldown: "Cooldown Reduction",
  multicast: "Multicast",
  scaling: "Scaling",
  economy: "Economy",
  control: "Control",
  tempo: "Tempo",
  sustain: "Sustain"
};

function lower(value: string | undefined): string {
  return value?.toLowerCase() ?? "";
}

function includesAny(value: string | undefined, needles: string[]): boolean {
  const normalized = lower(value);
  return needles.some((needle) => normalized.includes(needle));
}

function emptyScores(): Record<MechanicKey, number> {
  return Object.fromEntries(allMechanics.map((mechanic) => [mechanic, 0])) as Record<MechanicKey, number>;
}

function addScores(target: MechanicScoreMap, source: MechanicScoreMap, multiplier = 1): void {
  for (const [key, value] of Object.entries(source) as Array<[MechanicKey, number]>) {
    target[key] = (target[key] ?? 0) + value * multiplier;
  }
}

function scaledScores(source: MechanicScoreMap, multiplier: number): MechanicScoreMap {
  const scores: MechanicScoreMap = {};
  addScores(scores, source, multiplier);
  return scores;
}

function hasCritSignal(effect: EffectDef): boolean {
  return includesAny(effect.action.stat, ["crit", "crit chance", "critchance"]) || includesAny(effect.rawText, ["crit"]);
}

function hasShieldScalingSignal(effect: EffectDef): boolean {
  if (effect.trigger.event === "gain_shield" && ["damage", "gain_stat", "multicast", "shield"].includes(effect.action.type)) {
    return true;
  }
  const raw = lower(effect.rawText);
  return raw.includes("shield") && (raw.includes("damage") || raw.includes("crit") || raw.includes("gain"));
}

function hasAction(entity: Pick<ItemDef, "effects"> | Pick<SkillDef, "effects">, actionTypes: EffectDef["action"]["type"][]): boolean {
  return entity.effects.some((effect) => actionTypes.includes(effect.action.type));
}

function hasPayoff(item: ItemDef): boolean {
  return (
    hasAction(item, ["damage", "burn", "poison", "gain_stat", "multicast", "shield"]) ||
    item.tags.includes("weapon") ||
    Boolean(item.cooldownMs)
  );
}

function isTempoAction(action: EffectDef["action"]["type"]): boolean {
  return action === "haste" || action === "charge" || action === "reduce_cooldown";
}

export function scoreEffectMechanics(effect: EffectDef): MechanicScoreMap {
  const scores: MechanicScoreMap = {};

  switch (effect.action.type) {
    case "damage":
      scores.damage = mechanicWeights.damage;
      break;
    case "burn":
      scores.burn = mechanicWeights.burn;
      scores.damage = 8;
      break;
    case "poison":
      scores.poison = mechanicWeights.poison;
      scores.damage = 8;
      break;
    case "shield":
      scores.shield = mechanicWeights.shield;
      scores.sustain = mechanicWeights.sustain;
      break;
    case "heal":
    case "regen":
    case "lifesteal":
    case "gain_health":
      scores.heal = mechanicWeights.heal;
      scores.sustain = mechanicWeights.sustain;
      break;
    case "freeze":
      scores.freeze = mechanicWeights.freeze;
      scores.control = mechanicWeights.control;
      break;
    case "slow":
      scores.slow = mechanicWeights.slow;
      scores.control = 10;
      break;
    case "haste":
      scores.haste = mechanicWeights.haste;
      scores.tempo = mechanicWeights.tempo;
      break;
    case "charge":
      scores.charge = mechanicWeights.charge;
      scores.tempo = 16;
      break;
    case "reduce_cooldown":
      scores.reduce_cooldown = mechanicWeights.reduce_cooldown;
      scores.tempo = 12;
      break;
    case "multicast":
      scores.multicast = mechanicWeights.multicast;
      scores.scaling = 14;
      break;
    case "gain_stat":
    case "buff_tag":
      scores.scaling = 16;
      if (effect.action.stat === "damage" || effect.action.tag === "damage" || includesAny(effect.rawText, ["damage"])) {
        scores.damage = 12;
      }
      break;
    case "increase_value":
    case "gain_gold":
    case "gain_item":
    case "upgrade":
      scores.economy = mechanicWeights.economy;
      scores.scaling = 6;
      break;
    case "reload":
    case "use":
      scores.reduce_cooldown = mechanicWeights.reduce_cooldown;
      scores.tempo = 10;
      break;
    case "repair":
    case "cleanse":
      scores.sustain = mechanicWeights.sustain;
      break;
    default:
      break;
  }

  if (hasCritSignal(effect)) {
    scores.crit = (scores.crit ?? 0) + mechanicWeights.crit;
    scores.scaling = (scores.scaling ?? 0) + 8;
  }

  if (hasShieldScalingSignal(effect)) {
    scores.shield_scaling = (scores.shield_scaling ?? 0) + mechanicWeights.shield_scaling;
    scores.scaling = (scores.scaling ?? 0) + 12;
  }

  return scores;
}

function scoreItemTagMechanics(item: ItemDef): MechanicScoreMap {
  const scores: MechanicScoreMap = {};
  const tags = item.tags.map((tag) => tag.toLowerCase());

  if (tags.includes("weapon")) {
    scores.weapon_damage = (scores.weapon_damage ?? 0) + 18;
    if (hasAction(item, ["damage", "burn", "poison"]) || includesAny(item.text, ["damage"])) {
      scores.weapon_damage = (scores.weapon_damage ?? 0) + mechanicWeights.weapon_damage;
      scores.damage = (scores.damage ?? 0) + 8;
    }
  }

  if (tags.includes("core")) {
    scores.scaling = (scores.scaling ?? 0) + 8;
  }

  if (tags.includes("shield") && hasAction(item, ["damage", "gain_stat"])) {
    scores.shield_scaling = (scores.shield_scaling ?? 0) + 12;
  }

  return scores;
}

export function scoreItemMechanics(item: ItemDef): MechanicScoreMap {
  const scores: MechanicScoreMap = {};

  for (const effect of item.effects) {
    addScores(scores, scoreEffectMechanics(effect));
  }

  addScores(scores, scoreItemTagMechanics(item));
  return scores;
}

export function scoreSkillMechanics(skill: SkillDef): MechanicScoreMap {
  const scores: MechanicScoreMap = {};

  for (const effect of skill.effects) {
    addScores(scores, scoreEffectMechanics(effect));
  }

  const tags = skill.tags.map((tag) => tag.toLowerCase());
  if (tags.includes("weapon") && (scores.damage ?? 0) > 0) {
    scores.weapon_damage = (scores.weapon_damage ?? 0) + 12;
  }

  return scores;
}

export function scoreTempoPayoff(params: {
  source: ItemDef;
  target: ItemDef;
  sourceEffect: EffectDef;
  isPositionallyActive: boolean;
}): MechanicScoreMap {
  const { target, sourceEffect, isPositionallyActive } = params;
  const scores: MechanicScoreMap = {};

  if (!isPositionallyActive || !isTempoAction(sourceEffect.action.type)) {
    return scores;
  }

  const targetHasCooldown = target.cooldownMs !== null;
  const targetIsLongCooldown = target.cooldownMs !== null && target.cooldownMs >= 5000;
  const targetHasDamagePayoff = target.effects.some((effect) => ["damage", "burn", "poison"].includes(effect.action.type));
  const targetHasScalingPayoff = target.effects.some((effect) => effect.action.type === "gain_stat" || effect.action.type === "multicast");

  if (targetHasCooldown) {
    scores.tempo = (scores.tempo ?? 0) + 12;
  }

  if (targetIsLongCooldown) {
    if (sourceEffect.action.type === "haste") {
      scores.haste = (scores.haste ?? 0) + 10;
    }
    if (sourceEffect.action.type === "charge") {
      scores.charge = (scores.charge ?? 0) + 10;
    }
    if (sourceEffect.action.type === "reduce_cooldown") {
      scores.reduce_cooldown = (scores.reduce_cooldown ?? 0) + 8;
    }
  }

  if (targetHasDamagePayoff || target.tags.includes("weapon")) {
    scores.damage = (scores.damage ?? 0) + 8;
  }

  if (targetHasScalingPayoff) {
    scores.scaling = (scores.scaling ?? 0) + 8;
  }

  return scores;
}

function placementForItem(item: ItemDef, layout: BoardLayout): PlacedItem | null {
  return layout.placements.find((placement) => placement.itemId === item.id) ?? null;
}

function targetedPlacements(sourcePlacement: PlacedItem, layout: BoardLayout, effect: EffectDef): PlacedItem[] {
  switch (effect.target?.scope) {
    case "adjacent":
      return getAdjacentNeighbors(sourcePlacement, layout.placements);
    case "left": {
      const left = getLeftNeighbor(sourcePlacement, layout.placements);
      return left ? [left] : [];
    }
    case "right": {
      const right = getRightNeighbor(sourcePlacement, layout.placements);
      return right ? [right] : [];
    }
    case "leftmost":
      return [...layout.placements].sort((a, b) => a.startSlot - b.startSlot).slice(0, 1);
    case "rightmost":
      return [...layout.placements].sort((a, b) => b.startSlot - a.startSlot).slice(0, 1);
    case "allied_items":
      return layout.placements.filter((placement) => placement.itemId !== sourcePlacement.itemId);
    default:
      return [];
  }
}

function isPositionalEffect(effect: EffectDef): boolean {
  return ["adjacent", "left", "right", "leftmost", "rightmost"].includes(effect.target?.scope ?? "");
}

function scorePositionedItemEffect(
  source: ItemDef,
  effect: EffectDef,
  layout: BoardLayout | undefined,
  itemById: Map<string, ItemDef>
): PositionedEffectScore {
  const baseScores = scoreEffectMechanics(effect);

  if (!isPositionalEffect(effect)) {
    return { scores: baseScores, explanations: [] };
  }

  if (!layout) {
    return {
      scores: scaledScores(baseScores, potentialPositionalMultiplier),
      explanations: [`${source.name} 有位置机制，未提供布局时只按潜力计入。`]
    };
  }

  const sourcePlacement = placementForItem(source, layout);
  if (!sourcePlacement) {
    return {
      scores: scaledScores(baseScores, 0.15),
      explanations: [`${source.name} 没有进入布局，位置机制未兑现。`]
    };
  }

  const targets = targetedPlacements(sourcePlacement, layout, effect)
    .map((placement) => itemById.get(placement.itemId))
    .filter((item): item is ItemDef => Boolean(item));
  const matchingTargets = targets.filter((target) => itemMatchesEffectTarget(target, effect.target));

  if (matchingTargets.length === 0) {
    return {
      scores: scaledScores(baseScores, 0.2),
      explanations: [`${source.name} 的位置机制没有命中合适目标。`]
    };
  }

  const scores: MechanicScoreMap = {};
  const multiplier = Math.min(1.6, 0.85 + matchingTargets.length * 0.25);
  addScores(scores, baseScores, multiplier);

  for (const target of matchingTargets) {
    addScores(scores, scoreTempoPayoff({ source, target, sourceEffect: effect, isPositionallyActive: true }));
  }

  return {
    scores,
    explanations: matchingTargets.map((target) => `${source.name} 的位置机制命中 ${target.name}。`).slice(0, 2)
  };
}

function scoreGlobalTempoPayoffs(items: ItemDef[]): MechanicScoreMap {
  const scores: MechanicScoreMap = {};
  const tempoSources = items.filter((item) => item.effects.some((effect) => isTempoAction(effect.action.type)));
  if (tempoSources.length === 0) return scores;

  const payoffTargets = items.filter((item) => hasPayoff(item));
  if (payoffTargets.length === 0) return scores;

  const payoff = Math.min(18, payoffTargets.length * 4);
  scores.tempo = payoff;

  if (payoffTargets.some((item) => item.cooldownMs != null && item.cooldownMs >= 5000)) {
    if (tempoSources.some((item) => hasAction(item, ["haste"]))) scores.haste = 8;
    if (tempoSources.some((item) => hasAction(item, ["charge"]))) scores.charge = 8;
    if (tempoSources.some((item) => hasAction(item, ["reduce_cooldown"]))) scores.reduce_cooldown = 6;
  }

  if (payoffTargets.some((item) => hasAction(item, ["damage", "burn", "poison"]) || item.tags.includes("weapon"))) {
    scores.damage = 6;
  }

  return scores;
}

function normalizeScores(scores: MechanicScoreMap): Record<MechanicKey, number> {
  const normalized = emptyScores();
  for (const mechanic of allMechanics) {
    normalized[mechanic] = Math.max(0, Math.min(100, Math.round(scores[mechanic] ?? 0)));
  }

  normalized.control = Math.max(
    normalized.control,
    Math.min(100, Math.round(normalized.freeze * 0.75 + normalized.slow * 0.7))
  );
  normalized.tempo = Math.max(
    normalized.tempo,
    Math.min(
      100,
      Math.round(
        normalized.haste * 0.45 +
          normalized.charge * 0.45 +
          normalized.reduce_cooldown * 0.45 +
          normalized.multicast * 0.35
      )
    )
  );
  normalized.sustain = Math.max(
    normalized.sustain,
    Math.min(100, Math.round(normalized.shield * 0.65 + normalized.heal * 0.7))
  );

  return normalized;
}

function sortedByScore(scores: Record<MechanicKey, number>, keys: MechanicKey[]): MechanicKey[] {
  return [...keys].sort((a, b) => scores[b] - scores[a]);
}

function inferPrimary(scores: Record<MechanicKey, number>): MechanicKey {
  const specializedWinConditions = mechanicGroups.winCondition.filter((mechanic) => mechanic !== "damage");
  const specializedPrimary = sortedByScore(scores, specializedWinConditions).find(
    (mechanic) => scores[mechanic] >= primaryMinimum && scores[mechanic] >= scores.damage * 0.75
  );
  if (specializedPrimary) return specializedPrimary;

  const winPrimary = sortedByScore(scores, mechanicGroups.winCondition).find((mechanic) => scores[mechanic] >= primaryMinimum);
  if (winPrimary) return winPrimary;

  const nonAggregate = allMechanics.filter((mechanic) => !["control", "tempo", "sustain"].includes(mechanic));
  return sortedByScore(scores, nonAggregate).find((mechanic) => scores[mechanic] >= primaryMinimum) ?? "damage";
}

function inferRoles(scores: Record<MechanicKey, number>): BuildMechanicProfile["roles"] {
  const active = (keys: MechanicKey[], minimum = secondaryMinimum) => keys.filter((mechanic) => scores[mechanic] >= minimum);
  return {
    winCondition: active(mechanicGroups.winCondition, primaryMinimum),
    enablers: active(mechanicGroups.enablers),
    control: active(mechanicGroups.control),
    sustain: active(mechanicGroups.sustain),
    scaling: active(mechanicGroups.scaling)
  };
}

function labelForMechanics(primary: MechanicKey, roles: BuildMechanicProfile["roles"]): string[] {
  const labels: string[] = [];

  if (primary === "weapon_damage" && roles.winCondition.includes("crit")) labels.push("Crit Weapon Damage");
  else if (primary === "weapon_damage") labels.push("Weapon Damage");
  else if (primary === "crit") labels.push("Crit Damage");
  else if (primary === "burn") labels.push("Burn Engine");
  else if (primary === "poison") labels.push("Poison Engine");
  else if (primary === "shield_scaling") labels.push("Shield Scaling");
  else if (primary === "damage") labels.push("Damage Engine");
  else labels.push(labelByMechanic[primary]);

  if (roles.enablers.includes("haste") || roles.enablers.includes("charge")) {
    labels.push("Haste / Charge Tempo");
  } else if (roles.enablers.includes("reduce_cooldown")) {
    labels.push("Cooldown Tempo");
  } else if (roles.enablers.includes("multicast")) {
    labels.push("Multicast Tempo");
  }

  if (roles.control.includes("freeze")) labels.push("Freeze Control");
  else if (roles.control.includes("slow")) labels.push("Slow Control");

  if (roles.sustain.includes("shield")) labels.push("Shield Sustain");
  else if (roles.sustain.includes("heal")) labels.push("Heal Sustain");

  if (roles.scaling.includes("economy")) labels.push("Economy Scaling");

  return [...new Set(labels)].slice(0, 5);
}

function mechanicExplanation(profile: Pick<BuildMechanicProfile, "primary" | "roles" | "scores">, extra: string[]): string[] {
  const explanation: string[] = [];

  if (profile.roles.winCondition.length > 0) {
    explanation.push(`主要胜利路径来自 ${profile.roles.winCondition.map((mechanic) => labelByMechanic[mechanic]).join(" / ")}。`);
  } else {
    explanation.push("没有检测到高置信的核心输出，当前更像混合构筑。");
  }

  if (profile.roles.enablers.length > 0) {
    explanation.push(`${profile.roles.enablers.map((mechanic) => labelByMechanic[mechanic]).join(" / ")} 提供启动或放大能力。`);
  }

  if (profile.roles.control.length > 0) {
    explanation.push(`${profile.roles.control.map((mechanic) => labelByMechanic[mechanic]).join(" / ")} 提供控制和拖时间能力。`);
  }

  if (profile.roles.sustain.length > 0) {
    explanation.push(`${profile.roles.sustain.map((mechanic) => labelByMechanic[mechanic]).join(" / ")} 提供防御或回复层。`);
  }

  return [...new Set([...explanation, ...extra])].slice(0, 6);
}

export function mechanicLabel(mechanic: MechanicKey): string {
  return labelByMechanic[mechanic];
}

export function buildMechanicProfile(params: {
  items: ItemDef[];
  skills: SkillDef[];
  layout?: BoardLayout;
}): BuildMechanicProfile {
  const { items, skills, layout } = params;
  const itemById = new Map(items.map((item) => [item.id, item]));
  const scores: MechanicScoreMap = {};
  const explanations: string[] = [];

  for (const item of items) {
    for (const effect of item.effects) {
      const scored = scorePositionedItemEffect(item, effect, layout, itemById);
      addScores(scores, scored.scores);
      explanations.push(...scored.explanations);
    }

    addScores(scores, scoreItemTagMechanics(item));
  }

  for (const skill of skills) {
    addScores(scores, scoreSkillMechanics(skill));
  }

  if (!layout) {
    addScores(scores, scoreGlobalTempoPayoffs(items));
  } else {
    for (const source of items) {
      const sourcePlacement = placementForItem(source, layout);
      if (!sourcePlacement) continue;
      for (const effect of source.effects) {
        if (!isTempoAction(effect.action.type) || isPositionalEffect(effect)) continue;
        for (const target of items) {
          const targetPlacement = placementForItem(target, layout);
          if (!targetPlacement || target.id === source.id) continue;
          addScores(scores, scoreTempoPayoff({ source, target, sourceEffect: effect, isPositionallyActive: isAdjacent(sourcePlacement, targetPlacement) || !effect.target }));
        }
      }
    }
  }

  const normalized = normalizeScores(scores);
  const primary = inferPrimary(normalized);
  const secondary = sortedByScore(
    normalized,
    allMechanics.filter((mechanic) => mechanic !== primary && !["control", "tempo", "sustain"].includes(mechanic))
  ).filter((mechanic) => normalized[mechanic] >= secondaryMinimum).slice(0, 5);
  const roles = inferRoles(normalized);
  const profileBase = { primary, secondary, scores: normalized, roles };

  return {
    ...profileBase,
    labels: labelForMechanics(primary, roles),
    explanation: mechanicExplanation(profileBase, explanations)
  };
}
