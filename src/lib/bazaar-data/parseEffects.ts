import { slugify } from "./slug";
import { inferPositionalTarget } from "./positionEffects";
import type {
  EffectActionType,
  EffectDef,
  EffectEvent,
  EffectTargetScope,
  TagDef
} from "./types";

type TagLike = TagDef | string;

function lower(value: string): string {
  return value.toLowerCase();
}

function firstNumber(text: string): number | undefined {
  const match = text.match(/[-+]?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function knownTagNames(tags: TagLike[] = []): string[] {
  return tags
    .map((tag) => (typeof tag === "string" ? tag : tag.name))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

function findKnownTag(text: string, tags: TagLike[] = []): string | undefined {
  const normalizedText = lower(text);
  for (const tag of knownTagNames(tags)) {
    const pattern = new RegExp(`\\b${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").toLowerCase()}\\b`, "i");
    if (pattern.test(normalizedText)) {
      return slugify(tag);
    }
  }
  return undefined;
}

function actionSegment(text: string): string {
  const commaIndex = text.indexOf(",");
  return commaIndex >= 0 ? text.slice(commaIndex + 1) : text;
}

function triggerSegment(text: string): string {
  const commaIndex = text.indexOf(",");
  return commaIndex >= 0 ? text.slice(0, commaIndex) : text;
}

function inferTrigger(text: string, tags: TagLike[]): EffectDef["trigger"] {
  const value = lower(text);
  const triggerText = triggerSegment(text);

  if (/\b(when combat starts|at the start of each fight|at the start of combat|start of each fight)\b/.test(value)) {
    return { event: "combat_start" };
  }
  if (/\bwhen you use an adjacent item\b/.test(value)) {
    return { event: "adjacent_item_used" };
  }
  if (/\bwhen you use an? [a-z -]+(?: item)?\b/.test(lower(triggerText))) {
    return { event: "tag_item_used", tag: findKnownTag(triggerText, tags) };
  }
  if (/\bwhen you use\b/.test(value)) {
    return { event: "item_used" };
  }
  if (/\bwhen you (gain )?shield\b/.test(value)) {
    return { event: "gain_shield" };
  }
  if (/\bwhen you (over-?heal|heal)\b/.test(value)) {
    return { event: "heal" };
  }
  if (/\bwhen you (burn|apply burn)\b/.test(value)) {
    return { event: "apply_burn" };
  }
  if (/\bwhen you (poison|apply poison)\b/.test(value)) {
    return { event: "apply_poison" };
  }
  if (/\bwhen you (damage|deal damage|crit)\b/.test(value)) {
    return { event: "deal_damage" };
  }
  if (/\bwhen an enemy (is )?damaged\b/.test(value)) {
    return { event: "enemy_damaged" };
  }
  if (/\bwhen an enemy (is )?healed\b/.test(value)) {
    return { event: "enemy_healed" };
  }
  if (/\bwhen an enemy (is )?shielded\b/.test(value)) {
    return { event: "enemy_shielded" };
  }
  if (/\bwhen you buy\b|\bon buy\b/.test(value)) {
    return { event: "buy" };
  }
  if (/\bwhen you sell\b|\bon sell\b/.test(value)) {
    return { event: "sell" };
  }
  if (/\bwhen you level up\b|\blevel up\b/.test(value)) {
    return { event: "level_up" };
  }
  if (/^(deal|gain|shield|heal|burn|poison|haste|slow|freeze|charge|destroy|reduce|increase)\b/.test(value)) {
    return { event: "cooldown_ready" };
  }
  if (/^this\s+gains?\b/.test(value)) {
    return { event: "cooldown_ready" };
  }
  if (/\balways\b|\byou have\b|^this\s+has\b/.test(value)) {
    return { event: "always" };
  }

  return { event: "unknown" };
}

function inferAction(text: string, tags: TagLike[]): EffectDef["action"] {
  const actionText = actionSegment(text);
  const value = lower(actionText);
  const amount = firstNumber(actionText) ?? firstNumber(text);
  let type: EffectActionType = "unknown";
  let stat: string | undefined;
  let tag: string | undefined;

  if (/^this\s+gains?\s+damage\b|\bgain\s+\d*(?:\.\d+)?\s*damage\b/.test(value)) {
    type = "gain_stat";
    stat = "damage";
  } else if (/\bdestroy\b/.test(value)) type = "destroy";
  else if (/\bmulticast\b/.test(value)) type = "multicast";
  else if (/\breduce\b.*\bcooldown\b|\bcooldown\b.*\breduce\b|\bcut\b.*\bcooldown\b/.test(value)) type = "reduce_cooldown";
  else if (/\bcharge\b/.test(value)) type = "charge";
  else if (/\bhaste\b/.test(value)) type = "haste";
  else if (/\bslow\b/.test(value)) type = "slow";
  else if (/\bfreeze|frozen\b/.test(value)) type = "freeze";
  else if (/\bpoison\b/.test(value)) type = "poison";
  else if (/\bburn|heated\b/.test(value)) type = "burn";
  else if (/\bshield\b/.test(value)) type = "shield";
  else if (/\bover-?heal|\bheal\b/.test(value)) type = "heal";
  else if (/\bmax health\b|\bgain health\b|\bhealth\b/.test(value)) type = "gain_health";
  else if (/\bdamage\b|\bcrit\b/.test(value)) type = "damage";
  else if (/\bgold\b|\bincome\b/.test(value)) type = "gain_gold";
  else if (/\bvalue\b|\bsell price\b|\bbuy price\b/.test(value)) type = "increase_value";
  else if (/\bgain\b/.test(value)) type = "gain_stat";

  if ((type === "unknown" || type === "gain_stat") && (/\bitems?\b.*\bgain\b|\bhave \+|\bhas double\b|\bbuff\b/.test(value))) {
    const candidateTag = findKnownTag(actionText, tags);
    if (candidateTag) {
      type = "buff_tag";
      tag = candidateTag;
    }
  }

  if (type === "gain_stat") {
    stat = findKnownTag(actionText, tags) ?? value.match(/\bgain ([a-z ]+)/)?.[1]?.trim();
  }

  return {
    type,
    ...(amount != null ? { value: amount } : {}),
    ...(stat ? { stat } : {}),
    ...(tag ? { tag } : {})
  };
}

function inferTarget(text: string, action: EffectDef["action"], tags: TagLike[]): EffectDef["target"] {
  const positionalTarget = inferPositionalTarget(text, tags);
  if (positionalTarget) {
    return positionalTarget;
  }

  const targetText = actionSegment(text);
  const value = lower(targetText);
  let scope: EffectTargetScope = "unknown";
  const defaultEnemyAction = ["damage", "burn", "poison", "slow", "freeze"].includes(action.type);

  if (/^this\s+gains?\b/.test(value)) scope = "self";
  else if (defaultEnemyAction && /^(deal|burn|poison|slow|freeze)\b/.test(value)) scope = "enemy";
  else if (/\benemy items?\b|\ban enemy item\b/.test(value)) scope = "enemy_items";
  else if (/\benemy\b/.test(value)) scope = "enemy";
  else if (/\byour skills?\b/.test(value)) scope = "allied_skills";
  else if (/\byour items?\b|\ball items?\b|\bitems\b/.test(value)) scope = "allied_items";
  else if (/\bthis\b|\bself\b/.test(value)) scope = "self";
  else if (/\brandom\b/.test(value)) scope = "random";
  else if (defaultEnemyAction) scope = "enemy";

  const taggableScopes: EffectTargetScope[] = ["adjacent", "left", "right", "leftmost", "rightmost", "allied_items", "enemy_items", "allied_skills"];
  const targetTag = taggableScopes.includes(scope) ? findKnownTag(targetText, tags) : undefined;

  return {
    scope,
    ...(targetTag && targetTag !== action.type ? { tag: targetTag } : {})
  };
}

export function parseEffectText(text: string, tags: TagLike[] = []): EffectDef {
  const action = inferAction(text, tags);
  const trigger = inferTrigger(text, tags);

  return {
    trigger,
    action,
    target: inferTarget(text, action, tags),
    rawText: text
  };
}

export function parseEffectsFromTexts(texts: string[], tags: TagLike[] = []): EffectDef[] {
  if (texts.length === 0) {
    return [
      {
        trigger: { event: "unknown" },
        action: { type: "unknown" },
        target: { scope: "unknown" },
        rawText: ""
      }
    ];
  }

  return texts.map((text) => parseEffectText(text, tags));
}

export function hasKnownEffect(effect: EffectDef): boolean {
  return effect.trigger.event !== "unknown" || effect.action.type !== "unknown";
}
