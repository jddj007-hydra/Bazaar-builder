import { semanticEffectViews, semanticHasAction, semanticUnknownCount } from "./semanticConsumption";
import { structuredEffectView, type StructuredEffectView } from "./structuredEffects";
import type { EffectActionType, EffectEvent, ItemDef, SkillDef, SynergyScore } from "./types";

export const scoringConfig = {
  shieldTrigger: 22,
  healTrigger: 18,
  burnTrigger: 18,
  poisonTrigger: 18,
  hasteLongCooldown: 14,
  chargeLongCooldown: 18,
  tagTrigger: 20,
  adjacentBuff: 10,
  skillTagBuff: 18,
  noDamagePenalty: 60,
  noDefensePenalty: 18,
  unrelatedTagsPenalty: 20,
  tooManyLargeItemsPenalty: 10
};

type ScorableEntity =
  | Pick<ItemDef, "name" | "tags" | "structuredEffects" | "semanticEffects" | "cooldownMs">
  | Pick<SkillDef, "name" | "tags" | "structuredEffects" | "semanticEffects">;

function entityEffects(entity: ScorableEntity): StructuredEffectView[] {
  return semanticEffectViews(entity);
}

function hasAction(entity: ScorableEntity, action: EffectActionType): boolean {
  return semanticHasAction(entity, [action]);
}

function hasTrigger(entity: ScorableEntity, event: EffectEvent): boolean {
  return entity.structuredEffects.some((effect) => structuredEffectView(effect).trigger.event === event);
}

function entityCooldown(entity: ScorableEntity): number | null {
  return "cooldownMs" in entity ? entity.cooldownMs : null;
}

function scoreTriggerSynergy(producer: ScorableEntity, reactor: ScorableEntity): SynergyScore {
  const reasons: string[] = [];
  let score = 0;

  const triggerPairs: Array<[EffectActionType, EffectEvent, number, string]> = [
    ["shield", "gain_shield", scoringConfig.shieldTrigger, "护盾产出能触发护盾联动"],
    ["heal", "heal", scoringConfig.healTrigger, "治疗产出能触发治疗联动"],
    ["burn", "apply_burn", scoringConfig.burnTrigger, "燃烧施加能触发燃烧联动"],
    ["poison", "apply_poison", scoringConfig.poisonTrigger, "中毒施加能触发中毒联动"],
    ["damage", "deal_damage", 12, "伤害输出能触发伤害联动"],
    ["damage", "enemy_damaged", 12, "伤害输出能触发敌人受伤联动"]
  ];

  for (const [action, event, weight, reason] of triggerPairs) {
    if (hasAction(producer, action) && hasTrigger(reactor, event)) {
      score += weight;
      reasons.push(`${producer.name}：${reason}，配合 ${reactor.name}。`);
    }
  }

  return { score, reasons };
}

function scoreSpeedSynergy(producer: ScorableEntity, reactor: ScorableEntity): SynergyScore {
  const cooldown = entityCooldown(reactor);
  if (!cooldown || cooldown < 6000) {
    return { score: 0, reasons: [] };
  }

  if (hasAction(producer, "charge")) {
    return {
      score: scoringConfig.chargeLongCooldown,
      reasons: [`${producer.name} 可以给 ${reactor.name} 的长冷却提供充能。`]
    };
  }

  if (hasAction(producer, "haste")) {
    return {
      score: scoringConfig.hasteLongCooldown,
      reasons: [`${producer.name} 可以给 ${reactor.name} 的长冷却提供加速。`]
    };
  }

  return { score: 0, reasons: [] };
}

function scoreTagSynergy(a: ScorableEntity, b: ScorableEntity): SynergyScore {
  const reasons: string[] = [];
  let score = 0;
  const bTags = new Set(b.tags);

  for (const effect of entityEffects(a)) {
    const triggerTag = effect.trigger.tag;
    if (effect.trigger.event === "tag_item_used" && triggerTag && bTags.has(triggerTag)) {
      score += scoringConfig.tagTrigger;
      reasons.push(`${a.name} 会因 ${b.name} 的 ${triggerTag} 标签触发。`);
    }

    const actionTag = effect.action.tag ?? effect.target?.tag;
    if ((effect.action.type === "buff_tag" || actionTag) && actionTag && bTags.has(actionTag)) {
      score += scoringConfig.skillTagBuff;
      reasons.push(`${a.name} 会增益或指向 ${b.name} 的 ${actionTag} 标签。`);
    }
  }

  return { score, reasons };
}

function scoreAdjacentSynergy(a: ScorableEntity, b: ScorableEntity): SynergyScore {
  const adjacentEffect = entityEffects(a).find((effect) =>
    ["adjacent", "left", "right"].includes(effect.target?.scope ?? "")
  );

  if (!adjacentEffect) {
    return { score: 0, reasons: [] };
  }

  const payoff =
    hasAction(b, "damage") ||
    hasAction(b, "burn") ||
    hasAction(b, "poison") ||
    hasAction(b, "shield") ||
    hasAction(b, "heal") ||
    Boolean(entityCooldown(b));

  return payoff
    ? {
        score: scoringConfig.adjacentBuff,
        reasons: [`${a.name} 有相邻位置增益，可以放大 ${b.name}。`]
      }
    : { score: 0, reasons: [] };
}

function addScore(total: SynergyScore, next: SynergyScore): SynergyScore {
  return {
    score: total.score + next.score,
    reasons: [...total.reasons, ...next.reasons]
  };
}

export function scoreEntityPair(a: ScorableEntity, b: ScorableEntity): SynergyScore {
  let total: SynergyScore = { score: 0, reasons: [] };

  total = addScore(total, scoreTriggerSynergy(a, b));
  total = addScore(total, scoreTriggerSynergy(b, a));
  total = addScore(total, scoreSpeedSynergy(a, b));
  total = addScore(total, scoreSpeedSynergy(b, a));
  total = addScore(total, scoreTagSynergy(a, b));
  total = addScore(total, scoreTagSynergy(b, a));
  total = addScore(total, scoreAdjacentSynergy(a, b));
  total = addScore(total, scoreAdjacentSynergy(b, a));

  return {
    score: total.score,
    reasons: total.reasons.slice(0, 6)
  };
}

export function hasDamagePlan(entity: ScorableEntity): boolean {
  return hasAction(entity, "damage") || hasAction(entity, "burn") || hasAction(entity, "poison");
}

export function hasDefensePlan(entity: ScorableEntity): boolean {
  return hasAction(entity, "shield") || hasAction(entity, "heal") || hasAction(entity, "freeze") || hasAction(entity, "slow");
}

export function unknownEffectCount(entity: ScorableEntity): number {
  return semanticUnknownCount(entity);
}
