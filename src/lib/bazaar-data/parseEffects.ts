import { slugify } from "./slug";
import { inferPositionalTarget } from "./positionEffects";
import type {
  EffectCondition,
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
    const pattern = new RegExp(`\\b${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").toLowerCase()}s?\\b`, "i");
    if (pattern.test(normalizedText)) {
      return slugify(tag);
    }
  }
  return undefined;
}

function findKnownTagInSegment(text: string, tags: TagLike[] = []): string | undefined {
  const normalizedText = lower(text);
  for (const tag of knownTagNames(tags)) {
    const normalizedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").toLowerCase();
    const pattern = new RegExp(`\\b${normalizedTag}s?\\b`, "i");
    if (pattern.test(normalizedText)) {
      return slugify(tag);
    }
  }
  return undefined;
}

function findAssignedTag(text: string, tags: TagLike[] = []): string | undefined {
  const value = lower(text);
  for (const tag of knownTagNames(tags)) {
    const normalizedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").toLowerCase();
    const assignmentPatterns = [
      new RegExp(`\\b(?:is|are)\\s+(?:a|an)?\\s*${normalizedTag}s?\\b`, "i"),
      new RegExp(`\\bhas\\s+(?:the\\s+)?${normalizedTag}\\s+(?:type|core type)\\b`, "i")
    ];
    if (assignmentPatterns.some((pattern) => pattern.test(value))) {
      return slugify(tag);
    }
  }
  return undefined;
}

function subjectSegmentBeforeAssignment(text: string): string | null {
  const match = text.match(/\b(your|this|all|other|adjacent|the)\b(.+?)\b(?:is|are|has\s+(?:the\s+)?[a-z -]+\s+(?:type|core type))\b/i);
  return match ? `${match[1]}${match[2]}` : null;
}

function findSubjectTag(text: string, tags: TagLike[] = []): string | undefined {
  const subject = subjectSegmentBeforeAssignment(text);
  return subject ? findKnownTagInSegment(subject, tags) : undefined;
}

function uniqueConditions(conditions: EffectCondition[]): EffectCondition[] {
  const seen = new Set<string>();
  return conditions.filter((condition) => {
    const key = `${condition.type}:${condition.tag ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferConditionTag(rawTag: string | undefined, tags: TagLike[]): string | undefined {
  if (!rawTag) return undefined;
  return findKnownTag(rawTag, tags) ?? slugify(rawTag);
}

function inferConditions(
  text: string,
  tags: TagLike[],
  inheritedConditions: EffectCondition[] = []
): EffectCondition[] {
  const conditions: EffectCondition[] = [];
  const exactlyOneMatch = text.match(/\bif you have (?:exactly|only) one ([a-z -]+?)(?: items?)?(?:,|\b)/i);
  const alsoTagMatch = text.match(/(?:^|\b)(?:\.\.\.|…+)?if it is also ([a-z -]+?)(?:,|\b)/i);

  if (exactlyOneMatch) {
    conditions.push({
      type: "exactly_one",
      tag: inferConditionTag(exactlyOneMatch[1], tags)
    });
  }

  if (alsoTagMatch) {
    conditions.push(...inheritedConditions.filter((condition) => condition.type === "exactly_one"));
    conditions.push({
      type: "target_has_tag",
      tag: inferConditionTag(alsoTagMatch[1], tags)
    });
  }

  return uniqueConditions(conditions);
}

function targetTagFromConditions(conditions: EffectCondition[] = []): string | undefined {
  return conditions.find((condition) => condition.type === "exactly_one")?.tag;
}

function isTriggerLead(text: string): boolean {
  return /^(?:\.\.\.|…+)?(when|if|while|at the|on day|the first|for each|for every)\b/i.test(text.trim());
}

function actionSegment(text: string): string {
  const commaIndex = text.indexOf(",");
  if (commaIndex >= 0 && isTriggerLead(text.slice(0, commaIndex))) {
    return text.slice(commaIndex + 1).trim();
  }
  return text.trim();
}

function triggerSegment(text: string): string {
  const commaIndex = text.indexOf(",");
  if (commaIndex >= 0 && isTriggerLead(text.slice(0, commaIndex))) {
    return text.slice(0, commaIndex).trim();
  }
  return text.trim();
}

function splitCompoundAssignment(text: string, tags: TagLike[] = []): string[] {
  for (const tag of knownTagNames(tags)) {
    const normalizedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`^(?<assignment>(?<subject>.+?)\\b(?:is|are)\\s+(?:a|an)?\\s*${normalizedTag}s?)\\s+and\\s+(?<rest>.+)$`, "i");
    const match = text.match(pattern);
    const groups = match?.groups as { assignment?: string; subject?: string; rest?: string } | undefined;
    if (!groups?.assignment || !groups.subject || !groups.rest) continue;

    const assignment = groups.assignment.trim();
    const rest = groups.rest.trim();
    const followup = /^(your|all|the|this|adjacent|other)\b/i.test(rest)
      ? rest
      : `${groups.subject.trim()} ${rest}`;
    return [assignment, followup];
  }

  return [text];
}

function inferTrigger(text: string, tags: TagLike[]): EffectDef["trigger"] {
  const value = lower(text);
  const triggerText = triggerSegment(text);

  if (/^(multicast:|lifesteal$|regen\b|heated:|chilled:)/.test(value)) {
    return { event: "always" };
  }
  if (/\b(when combat starts|at the start of each fight|at the start of combat|start of each fight)\b/.test(value)) {
    return { event: "combat_start" };
  }
  if (/\bat the start of each day\b|\bat the start of each hour\b/.test(value)) {
    return { event: "level_up" };
  }
  if (/^on day \d+\b/.test(value)) {
    return { event: "level_up" };
  }
  if (/\bat the end of each fight\b/.test(value)) {
    return { event: "fight_end" };
  }
  if (/\bat the end of each hero fight\b/.test(value)) {
    return { event: "fight_end" };
  }
  if (/\bwhen this item'?s value reaches\b/.test(value)) {
    return { event: "condition_active" };
  }
  if (/\bmerchant items?\b/.test(value)) {
    return { event: "merchant" };
  }
  if (/\bif you have (?:exactly|only) one\b|(?:^|\b)(?:\.\.\.|…+)?if it is also\b/.test(value)) {
    return { event: "condition_active" };
  }
  if (/\bthe first \d+ times?\s+(?:you|your enemy|an enemy|one of your items|your items)?\s*\b/.test(value)) {
    const triggerTag = findKnownTag(triggerText, tags);
    if (/\buses?\b/.test(value) && triggerTag) {
      return { event: "tag_item_used", tag: triggerTag };
    }
    if (/\buses?\b/.test(value)) {
      return { event: "item_used" };
    }
    if (/\bcrits?\b/.test(value)) {
      return { event: "crit" };
    }
    if (/\bshield\b/.test(value)) {
      return { event: "gain_shield" };
    }
    if (/\bheal\b|\bregen\b/.test(value)) {
      return { event: "heal" };
    }
    if (/\bburn\b/.test(value)) {
      return { event: "apply_burn" };
    }
    if (/\bpoison\b/.test(value)) {
      return { event: "apply_poison" };
    }
    if (/\bdestroyed\b/.test(value)) {
      return { event: "destroyed" };
    }
    return { event: "condition_active" };
  }
  if (/\bthe first time\b/.test(value)) {
    return { event: "combat_start" };
  }
  if (/\bwhile\b/.test(value)) {
    return { event: "always" };
  }
  if (/\bwhen you use an adjacent item\b/.test(value)) {
    return { event: "adjacent_item_used" };
  }
  if (/\bwhen an enemy uses an item\b/.test(value)) {
    return { event: "item_used" };
  }
  if (/\bwhen (any|any player|your opponent|your enemy|an enemy|enemy).*uses?\b/.test(value)) {
    return { event: "item_used" };
  }
  if (/\bwhen this is transformed\b/.test(value)) {
    return { event: "transformed" };
  }
  if (/\bwhen (you )?win\b|\bwhen you defeat\b/.test(value)) {
    return { event: "win" };
  }
  if (/\bwhen (you )?lose\b/.test(value)) {
    return { event: "lose" };
  }
  if (/\bwhen this runs out of ammo\b/.test(value)) {
    return { event: "ammo_empty" };
  }
  if (/\bwhen (?:your items?|one of your items?) runs? out of ammo\b/.test(value)) {
    return { event: "ammo_empty" };
  }
  if (/\bwhen (this is|this|an item|your items?) (is )?destroyed\b/.test(value)) {
    return { event: "destroyed" };
  }
  if (/\bwhen you destroy\b|\bwhen you stop being\b|\bwhen an enemy would destroy\b/.test(value)) {
    return { event: "destroyed" };
  }
  if (/\bwhen this destroys\b/.test(value)) {
    return { event: "destroyed" };
  }
  if (/\bwhen you visit a merchant\b/.test(value)) {
    return { event: "merchant" };
  }
  if (/\bmerchants?\s+(sell|buy)\b/.test(value)) {
    return { event: "merchant" };
  }
  if (/\bfor every \d+ merchants?\b/.test(value)) {
    return { event: "merchant" };
  }
  if (/\bwhen you crit\b|\bwhen .* crits?\b/.test(value)) {
    return { event: "crit" };
  }
  if (/\bwhen you enrage\b|\bwhen you become enraged\b|\bwhile you are enraged\b/.test(value)) {
    return { event: "enrage" };
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
  if (/\bwhen you (damage|deal damage)\b/.test(value)) {
    return { event: "deal_damage" };
  }
  if (/\bwhen you (haste|slow|freeze|regen|transform)\b/.test(value)) {
    return { event: "condition_active" };
  }
  if (/\bwhen the sandstorm starts\b/.test(value)) {
    return { event: "condition_active" };
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
  if (/\bwhen .* gains?\b|\bwhen .* starts? flying\b|\bwhen .* slows?\b/.test(value)) {
    return { event: "condition_active" };
  }
  if (/\bwhen .* (is|are) (frozen|slowed|used)\b|\bwhen .* (burns|poisons|deals? damage|stops? flying|reloads?)\b/.test(value)) {
    return { event: "condition_active" };
  }
  if (/\bwhen you use an? [a-z -]+(?: item)?\b/.test(lower(triggerText))) {
    return { event: "tag_item_used", tag: findKnownTag(triggerText, tags) };
  }
  if (/\bwhen you use\b/.test(value)) {
    return { event: "item_used" };
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
  if (/^(deal|gain|shield|heal|burn|poison|haste|slow|freeze|charge|destroy|remove|reduce|increase|reload|repair|cleanse|transform|double|use|enchant|heat)\b/.test(value)) {
    return { event: "cooldown_ready" };
  }
  if (/^this deals?\b|^use all\b|^use another\b/.test(value)) {
    return { event: "cooldown_ready" };
  }
  if (/^sells?\s+for\s+gold\b/.test(value)) {
    return { event: "sell" };
  }
  if (/^(this|an?|all|2|1|adjacent|other|your|the item|the weapon).*\b(starts?|stops?|start or stop)\s+flying\b/.test(value)) {
    return { event: "cooldown_ready" };
  }
  if (/^this\s+(permanently\s+)?(gains?|loses?)\b|^your\s+items?\s+gains?\b|^adjacent\s+items?\s+gains?\b|^a\s+\w+\s+gains?\b|^\d+\s+other\s+items?\s+starts?\b/.test(value)) {
    return { event: "cooldown_ready" };
  }
  if (/\balways\b|\byou have\b|^you [a-z -]+ have\b|^you are enraged\b|^you need\b|^this\s+has\b|^this\s+and\s+.*\s+(have|has|gain|gains|are|is)\b|^all items?\s+have\b|^an?\s+adjacent\s+.*\s+gains?\b|^your\s+.*\s+(have|has|gain|gains|are|is|deal|deals|slow|slows|cost|lasts)\b|^adjacent\s+.*\s+(have|has|gain|gains|are|is)\b|^your\s+flying\s+items?\b|^items? to the (left|right)\b|^the highest enemy\b|^the item to the (left|right)\b|^the weapon to the (left|right)\b|^the potion to the (left|right)\b|^the [a-z -]+ item to the (left|right)\b|^the [a-z -]+ to the (left|right)\b|^the cooldowns? of\b|^for each\b|^for every\b|^every \d+(st|nd|rd|th)\s+hit\b|^if\b|^[a-z ]+\s+have\s+\d+.*value\b|cooldowns?\s+(are\s+)?(reduced|decreased|increased)\b/.test(value)) {
    return { event: "always" };
  }
  if (/^you take\b|^the cooldown of\b|^this item'?s cooldown\b|^permanently gain\b|^every \d+\b/.test(value)) {
    return { event: "always" };
  }

  return { event: "unknown" };
}

function inferAction(text: string, tags: TagLike[]): EffectDef["action"] {
  const actionText = actionSegment(text);
  const value = lower(actionText);
  const amount = firstNumber(actionText) ?? firstNumber(text);
  const assignedTag = findAssignedTag(actionText, tags);
  let type: EffectActionType = "unknown";
  let stat: string | undefined;
  let tag: string | undefined;

  if (/^multicast:\s*\d+|has\s+\+\d+.*\bmulticast\b/.test(value)) {
    type = "multicast";
  } else if (/^lifesteal$|\b(has|have|gains?)\s+lifesteal\b/.test(value)) {
    type = "lifesteal";
  } else if (/\bmax health\b|\bgain health\b|\bhealth\b/.test(value) && /\b(gain|gains|increase|increases|double|doubles|permanently)\b/.test(value)) {
    type = "gain_health";
  } else if (/^regen\b|\bregen\s+\d+|^you have \+?\d+\s+regen\b/.test(value)) {
    type = "regen";
  } else if (/\breload\b/.test(value)) {
    type = "reload";
  } else if (/\buse this\b|\buse the\b|\buse your\b|^use all\b|^use another\b/.test(value)) {
    type = "use";
  } else if (/\brepair\b/.test(value)) {
    type = "repair";
  } else if (/\bcleanse\b/.test(value)) {
    type = "cleanse";
  } else if (/\bthis is destroyed instead\b|\bis destroyed instead\b/.test(value)) {
    type = "destroy";
  } else if (/\btransform\b/.test(value)) {
    type = "transform";
  } else if (/\benchant\b/.test(value)) {
    type = "enchant";
  } else if (/\bupgrade\b/.test(value)) {
    type = "upgrade";
  } else if (/\bremove\s+(freeze|slow|burn|poison)\b/.test(value)) {
    type = "cleanse";
  } else if (/\btrigger an additional time\b/.test(value)) {
    type = "use";
  } else if (/\bdiscount\b/.test(value)) {
    type = "increase_value";
  } else if (/\b(starts?|stops?|start or stop)\s+flying\b/.test(value)) {
    type = "flying";
  } else if (/\btake no damage\b|\btakes no damage\b|\bless damage\b/.test(value)) {
    type = "shield";
  } else if (/\b(learn|embark|expedition)\b/.test(value)) {
    type = "gain_item";
  } else if (/\b(get|gets|create|creates)\s+(a|an|\d+)\b/.test(value)) {
    type = "gain_item";
  } else if (/^sells?\s+for\s+gold\b/.test(value)) {
    type = "gain_gold";
  } else if (/\bcosts?\b.*\bless\s+gold\b|\brerolls cost\b|\bsell items for\b|\bbuy items for\b/.test(value)) {
    type = "gain_gold";
  } else if (/^heat\b/.test(value)) {
    type = "burn";
  } else if (/^deal\b|^this deals?\b/.test(value)) {
    type = "damage";
  } else if (/^shield\b/.test(value)) {
    type = "shield";
  } else if (/^heal\b/.test(value)) {
    type = "heal";
  } else if (/^burn\b|^heated:\s*burn\b/.test(value)) {
    type = "burn";
  } else if (/^poison\b/.test(value)) {
    type = "poison";
  } else if (/\b(chilled|frozen)\b|\bimmune to freeze\b|\baffected by freeze\b/.test(value)) {
    type = "freeze";
  } else if (assignedTag || /\bare\s+(relics|dinosaurs|vehicles|friends|aquatic|drones)\b|\bis a relic\b|\b(has|have)\s+the\s+(types?|core type)\b|\bis a vehicle\b/.test(value)) {
    type = "buff_tag";
    tag = assignedTag ?? findKnownTag(actionText, tags);
  } else if (/\bcooldowns?\b.*\b(reduced|decreased|increased|halved)\b|\b(reduce|decrease|increase)\b.*\bcooldowns?\b/.test(value)) {
    type = "reduce_cooldown";
  } else if (/\bspend all .*ammo\b|^this\s+(permanently\s+)?(gains?|loses?|has|have)\s+\+?\d?.*\b(ammo|value|damage|crit|burn|poison|regen|shield|heal)\b|^it\s+(gains?|loses?|has|have)\s+\+?\d?.*\b(ammo|value|damage|crit|burn|poison|regen|shield|heal)\b|^this\s+gains?\s+damage\b|\bgain\s+\d*(?:\.\d+)?\s*damage\b|^your\s+.*\s+(gain|gains|have|has)\s+\+?\d*(?:\.\d+)?\s*(ammo|value|damage|crit|burn|poison|regen|shield|heal)\b|^adjacent\s+.*\s+(gain|gains|have|has)\s+\+?\d*(?:\.\d+)?\s*(ammo|value|damage|crit|burn|poison|regen|shield|heal)\b|\bincrease this\b/.test(value)) {
    type = "gain_stat";
    stat =
      value.match(/\b(ammo|value|damage|crit|burn|poison|regen|shield|heal)\b/)?.[1] ??
      "damage";
  } else if (/\bdestroy\b/.test(value)) type = "destroy";
  else if (/\bmulticast\b/.test(value)) type = "multicast";
  else if (/\breduce\b.*\bcooldown\b|\bcooldown\b.*\breduce\b|\bcut\b.*\bcooldown\b/.test(value)) type = "reduce_cooldown";
  else if (/\bcharge\b/.test(value)) type = "charge";
  else if (/\bhaste\b/.test(value)) type = "haste";
  else if (/\bslows?\b/.test(value)) type = "slow";
  else if (/\bfreeze|frozen\b/.test(value)) type = "freeze";
  else if (/\bpoison\b/.test(value)) type = "poison";
  else if (/\bburn|heated\b/.test(value)) type = "burn";
  else if (/\bshield\b/.test(value)) type = "shield";
  else if (/\bover-?heal|\bheal\b/.test(value)) type = "heal";
  else if (/\bmax health\b|\bgain health\b|\bhealth\b/.test(value)) type = "gain_health";
  else if (/\bdamage\b|\bcrit\b/.test(value)) type = "damage";
  else if (/\bgold\b|\bincome\b/.test(value)) type = "gain_gold";
  else if (/\bvalue\b|\bsell price\b|\bbuy price\b/.test(value)) type = "increase_value";
  else if (/\bgains? that item'?s types?\b|\bgains? \d+ random types?\b/.test(value)) type = "buff_tag";
  else if (/\bgain\b|\bhave \+|\bhas \+|\bpermanently gains?\b/.test(value)) type = "gain_stat";

  if ((type === "unknown" || type === "gain_stat") && (/\bitems?\b.*\bgain\b|\bhave \+|\bhas double\b|\bbuff\b/.test(value))) {
    const candidateTag = findKnownTag(actionText, tags);
    if (candidateTag) {
      type = "buff_tag";
      tag = candidateTag;
    }
  }

  if (type === "gain_stat") {
    stat = stat ?? findKnownTag(actionText, tags) ?? value.match(/\bgain ([a-z ]+)/)?.[1]?.trim();
  }

  return {
    type,
    ...(amount != null ? { value: amount } : {}),
    ...(stat ? { stat } : {}),
    ...(tag ? { tag } : {})
  };
}

function inferTarget(
  text: string,
  action: EffectDef["action"],
  tags: TagLike[],
  conditions: EffectCondition[] = []
): EffectDef["target"] {
  const positionalTarget = inferPositionalTarget(text, tags);
  if (positionalTarget) {
    return positionalTarget;
  }

  const targetText = actionSegment(text);
  const value = lower(targetText);
  const subjectTag = action.type === "buff_tag" ? findSubjectTag(text, tags) : undefined;
  const knownTargetTag = findKnownTagInSegment(targetText, tags);
  const conditionTargetTag = targetTagFromConditions(conditions);
  let scope: EffectTargetScope = "unknown";
  const defaultEnemyAction = ["damage", "burn", "poison", "slow", "freeze"].includes(action.type);
  const defaultSelfAction = ["shield", "heal", "regen", "lifesteal", "gain_health", "gain_stat", "gain_gold", "gain_item", "increase_value", "multicast", "repair", "reload", "reduce_cooldown", "flying", "cleanse", "transform", "enchant", "upgrade", "use"].includes(action.type);

  if (conditionTargetTag && /\bit\b|\bits\b/.test(value)) scope = "allied_items";
  else if (/^this\s+gains?\b/.test(value)) scope = "self";
  else if (defaultEnemyAction && /^(deal|burn|poison|slow|freeze)\b/.test(value)) scope = "enemy";
  else if (defaultSelfAction && /\bthis item\b|\bthis item's\b|\bits cooldown\b|\bits cooldowns\b/.test(value)) scope = "self";
  else if (/\bit\b|^use this\b|^this\b/.test(value)) scope = "self";
  else if (/^(regen|shield|heal|multicast:|lifesteal|sells?\s+for)\b/.test(value)) scope = "self";
  else if (/\benemy items?\b|\ban enemy item\b/.test(value)) scope = "enemy_items";
  else if (/\benemy\b/.test(value)) scope = "enemy";
  else if (/\byour skills?\b/.test(value)) scope = "allied_skills";
  else if (/\byour\b.*\b(items?|weapons?|tools?|friends?|vehicles?|drones?|relics?|potions?|properties|cores?)\b/.test(value)) scope = "allied_items";
  else if (/\byour (other )?(core|food|friends?|vehicles?|drones?|relics?|tools?|weapons?|potions?|properties|slushees?)\b|\ball (weapon|non-weapon|tech|non-tech|friend|vehicle|drone|tool|property|item)\b|\b(a|another|other|\d+)\s+(core|food|friend|vehicle|drone|relic|tool|weapon|potion|property|toy|enchanted|flying)\b|\byour items?\b|\ball (your )?items?\b|\bother items?\b|\ban? item\b|\ban?\s+(?:non-)?[a-z-]+\s+items?\b|\ban?\s+[a-z-]+\s+or\s+[a-z-]+\s+items?\b|\bthat item\b|\banother item\b|\blargest item\b|\blowest value item\b|\b\d+\s+item\(s\)|\bitem\(s\)|\bitems\b/.test(value)) scope = "allied_items";
  else if (/\byour\b/.test(value) && (knownTargetTag || action.type === "buff_tag" || action.type === "reduce_cooldown")) scope = "allied_items";
  else if (/\bthis\b|\bself\b/.test(value)) scope = "self";
  else if (/\brandom\b/.test(value)) scope = "random";
  else if (defaultEnemyAction) scope = "enemy";
  else if (defaultSelfAction) scope = "self";

  const taggableScopes: EffectTargetScope[] = ["adjacent", "left", "right", "leftmost", "rightmost", "allied_items", "enemy_items", "allied_skills"];
  const targetTag = taggableScopes.includes(scope) ? conditionTargetTag ?? subjectTag ?? knownTargetTag : undefined;

  return {
    scope,
    ...(targetTag && targetTag !== action.type && targetTag !== action.tag ? { tag: targetTag } : {})
  };
}

export function parseEffectText(
  text: string,
  tags: TagLike[] = [],
  inheritedConditions: EffectCondition[] = []
): EffectDef {
  const action = inferAction(text, tags);
  const trigger = inferTrigger(text, tags);
  const conditions = inferConditions(text, tags, inheritedConditions);

  return {
    trigger,
    action,
    target: inferTarget(text, action, tags, conditions),
    ...(conditions.length > 0 ? { conditions } : {}),
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

  const effects: EffectDef[] = [];
  let inheritedConditions: EffectCondition[] = [];

  for (const text of texts) {
    for (const part of splitCompoundAssignment(text, tags)) {
      const effect = parseEffectText(part, tags, inheritedConditions);
      effects.push(effect);
      const exactlyOneConditions = effect.conditions?.filter((condition) => condition.type === "exactly_one") ?? [];
      if (exactlyOneConditions.length > 0) {
        inheritedConditions = exactlyOneConditions;
      }
    }
  }

  return effects;
}

export function hasKnownEffect(effect: EffectDef): boolean {
  return effect.trigger.event !== "unknown" || effect.action.type !== "unknown";
}
