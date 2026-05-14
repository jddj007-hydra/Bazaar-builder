import type {
  EffectActionType,
  EffectCondition,
  EffectEvent,
  EffectTargetScope,
  ItemSize,
  StructuredAction,
  StructuredActionType,
  StructuredAttributeType,
  StructuredCondition,
  StructuredEffect,
  StructuredEffectFacets,
  StructuredEffectPredicate,
  StructuredTagExpr,
  StructuredTarget,
  StructuredTrigger,
  StructuredTriggerType,
  StructuredValue
} from "./types";
import type { ParsedEffect } from "./effectParserTypes";

type ParsedEffectCondition = NonNullable<ParsedEffect["conditions"]>[number];
const NUMBER_PATTERN = "[-+]?\\d+(?:\\.\\d+)?";

export type StructuredEffectView = {
  trigger: {
    event: EffectEvent;
    tag?: string;
  };
  action: {
    type: EffectActionType;
    value?: number;
    stat?: string;
    tag?: string;
  };
  target?: {
    scope: EffectTargetScope;
    tag?: string;
    size?: ItemSize;
    excludeSelf?: boolean;
  };
  triggerTarget?: {
    scope: EffectTargetScope;
    tag?: string;
    size?: ItemSize;
    excludeSelf?: boolean;
  };
  conditions?: EffectCondition[];
  rawText: string;
};

const viewCache = new WeakMap<StructuredEffect, StructuredEffectView>();
const viewListCache = new WeakMap<StructuredEffect[], StructuredEffectView[]>();

function defined<T>(value: T | null | undefined): value is T {
  return value != null;
}

function attributeFromStat(stat: string | undefined, actionType?: EffectActionType): StructuredAttributeType | undefined {
  const normalized = stat?.toLowerCase().replace(/[^a-z%]+/g, " ").trim();
  switch (normalized) {
    case "ammo":
    case "max ammo":
      return "AmmoMax";
    case "burn":
      return actionType === "burn" ? "BurnApplyAmount" : "Burn";
    case "cooldown":
      return "CooldownMax";
    case "crit":
    case "crit chance":
    case "crit%":
      return "CritChance";
    case "crit damage":
      return "CritDamage";
    case "damage":
      return "DamageAmount";
    case "gold":
      return "Gold";
    case "charge":
      return "ChargeAmount";
    case "haste":
      return "HasteAmount";
    case "heal":
      return "HealAmount";
    case "current health":
      return "Health";
    case "health":
    case "max health":
      return "HealthMax";
    case "income":
      return "Income";
    case "multicast":
      return "Multicast";
    case "poison":
      return actionType === "poison" ? "PoisonApplyAmount" : "Poison";
    case "prestige":
      return "Prestige";
    case "xp":
    case "experience":
      return "Experience";
    case "rage":
      return "Rage";
    case "rage requirement":
    case "rage_requirement":
      return "RageRequirement";
    case "regen":
      return "RegenApplyAmount";
    case "shield":
      return actionType === "shield" ? "ShieldApplyAmount" : "Shield";
    case "slow":
      return "SlowAmount";
    case "value":
      return "Value";
    default:
      return undefined;
  }
}

function referenceAttributeFromText(text: string, stat: string | undefined, actionType?: EffectActionType): StructuredAttributeType | undefined {
  const normalized = stat?.toLowerCase().replace(/[^a-z%]+/g, " ").trim();
  if ((normalized === "ammo" || normalized === "current ammo") && /\b(?:current\s+ammo|(?:this|that)\s+item['’]s\s+ammo|its\s+(?:current\s+)?ammo|their\s+(?:current\s+)?ammo)\b/i.test(text)) {
    return "Ammo";
  }
  return attributeFromStat(stat, actionType);
}

function referencedCardAttributeStat(text: string): string | undefined {
  return text.match(
    /\bequal\s+to\s+(?:double|twice|half|triple|[-+]?\d+(?:\.\d+)?\s+times\s+)?(?:this\s+item['’]s|that\s+item['’]s|its|their|this|that)\s+(?<stat>current\s+ammo|max\s+ammo|ammo|crit(?:%|\s+chance)?|damage|shield|heal|burn|poison|regen|value|cooldown|multicast)\b/i
  )?.groups?.stat;
}

function defaultAttributeForAction(action: ParsedEffect["action"]): StructuredAttributeType | undefined {
  switch (action.type) {
    case "burn":
      return "BurnApplyAmount";
    case "charge":
      return "ChargeAmount";
    case "damage":
      return "DamageAmount";
    case "freeze":
      return "FreezeAmount";
    case "gain_gold":
      return "Gold";
    case "gain_health":
      return "HealthMax";
    case "haste":
      return "HasteAmount";
    case "heal":
      return "HealAmount";
    case "multicast":
      return "Multicast";
    case "poison":
      return "PoisonApplyAmount";
    case "reduce_cooldown":
      return "CooldownMax";
    case "regen":
      return "RegenApplyAmount";
    case "reload":
      return "ReloadAmount";
    case "shield":
      return "ShieldApplyAmount";
    case "slow":
      return "SlowAmount";
    case "increase_value":
      return "Value";
    case "gain_stat":
    case "modify_stat":
      return attributeFromStat(action.stat, action.type) ?? "Unknown";
    default:
      return undefined;
  }
}

function actionTypeToStructured(type: EffectActionType): StructuredActionType {
  switch (type) {
    case "damage":
      return "TActionPlayerDamage";
    case "shield":
      return "TActionPlayerShieldApply";
    case "heal":
      return "TActionPlayerHeal";
    case "regen":
      return "TActionPlayerRegenApply";
    case "burn":
      return "TActionPlayerBurnApply";
    case "poison":
      return "TActionPlayerPoisonApply";
    case "haste":
      return "TActionCardHaste";
    case "slow":
      return "TActionCardSlow";
    case "freeze":
      return "TActionCardFreeze";
    case "charge":
      return "TActionCardCharge";
    case "gain_stat":
    case "increase_value":
    case "reduce_cooldown":
    case "flying":
    case "lifesteal":
    case "multicast":
    case "modify_stat":
      return "TActionCardModifyAttribute";
    case "gain_gold":
    case "gain_health":
      return "TActionPlayerModifyAttribute";
    case "gain_item":
      return "TActionGameSpawnCards";
    case "buff_tag":
      return "TActionCardAddTagsList";
    case "reload":
      return "TActionCardReload";
    case "repair":
      return "TActionCardRepair";
    case "transform":
      return "TActionCardTransform";
    case "enchant":
      return "TActionCardEnchant";
    case "upgrade":
      return "TActionCardUpgrade";
    case "use":
      return "TActionCardForceUse";
    case "destroy":
      return "TActionCardDestroy";
    case "redirect":
      return "TActionCardRedirect";
    case "start_sandstorm":
      return "TActionCardBeginSandstorm";
    case "cleanse":
      return "TActionCardCleanse";
    case "modify_slot":
      return "TActionBoardSlotSetTerrain";
    case "modify_effect":
      return "TActionEffectModify";
    case "modify_status_duration":
      return "TActionStatusDurationModify";
    case "modify_status":
      return "TActionStatusModify";
    case "modify_player_state":
      return "TActionPlayerModifyState";
    case "modify_variable":
      return "TActionVariableModify";
    case "prevent_damage":
      return "TActionPlayerPreventDamage";
    default:
      return "TActionUnknown";
  }
}

function structuredActionType(effect: ParsedEffect): StructuredActionType {
  if (effect.action.type !== "gain_stat") {
    return actionTypeToStructured(effect.action.type);
  }

  const attribute = defaultAttributeForAction(effect.action);
  if (attribute === "Gold" || attribute === "Income" || attribute === "Prestige" || attribute === "Health" || attribute === "HealthMax") {
    return "TActionPlayerModifyAttribute";
  }
  if (attribute === "Experience" || attribute === "Rage" || attribute === "RageRequirement") {
    return "TActionPlayerModifyAttribute";
  }

  return "TActionCardModifyAttribute";
}

function triggerTypeToStructured(event: EffectEvent): StructuredTriggerType {
  switch (event) {
    case "always":
      return "TTriggerAlways";
    case "cooldown_ready":
      return "TTriggerOnCardFired";
    case "combat_start":
      return "TTriggerOnFightStarted";
    case "item_used":
    case "tag_item_used":
    case "adjacent_item_used":
      return "TTriggerOnItemUsed";
    case "gain_shield":
      return "TTriggerOnCardPerformedShield";
    case "heal":
      return "TTriggerOnCardPerformedHeal";
    case "apply_burn":
      return "TTriggerOnCardPerformedBurn";
    case "apply_poison":
      return "TTriggerOnCardPerformedPoison";
    case "deal_damage":
      return "TTriggerOnCardPerformedDamage";
    case "effect_applied":
      return "TTriggerOnEffectApplied";
    case "effect_sequence_completed":
      return "TTriggerOnEffectSequenceCompleted";
    case "unknown":
      return "TTriggerUnknown";
    case "enemy_damaged":
      return "TTriggerOnEnemyDamaged";
    case "enemy_healed":
      return "TTriggerOnEnemyHealed";
    case "enemy_shielded":
      return "TTriggerOnEnemyShielded";
    case "buy":
      return "TTriggerOnCardPurchased";
    case "sell":
      return "TTriggerOnCardSold";
    case "level_up":
      return "TTriggerOnCardUpgraded";
    case "transformed":
      return "TTriggerOnCardTransformed";
    case "fight_end":
      return "TTriggerOnFightEnded";
    case "win":
      return "TTriggerOnCombatWon";
    case "lose":
      return "TTriggerOnCombatLost";
    case "ammo_empty":
      return "TTriggerOnCardAmmoEmpty";
    case "reload":
      return "TTriggerOnCardReloaded";
    case "destroyed":
      return "TTriggerOnCardDestroyed";
    case "merchant":
      return "TTriggerOnMerchantVisited";
    case "crit":
      return "TTriggerOnCardCritted";
    case "enrage":
      return "TTriggerOnEnrage";
    case "status_ended":
      return "TTriggerOnStatusEnded";
    case "status_changed":
      return "TTriggerOnStatusChanged";
    case "would_be_defeated":
      return "TTriggerOnPlayerWouldBeDefeated";
    case "player_attribute_threshold":
      return "TTriggerOnPlayerAttributeThresholdCrossed";
    case "card_attribute_threshold":
      return "TTriggerOnCardAttributeThresholdCrossed";
    case "player_attribute_changed":
      return "TTriggerOnPlayerAttributeChanged";
    case "condition_active":
      return "TTriggerOnConditionMet";
    default:
      return "TTriggerUnknown";
  }
}

function sizeCondition(size: ItemSize | undefined): StructuredCondition | null {
  return size ? { $type: "TCardConditionalSize", Sizes: [size] } : null;
}

function tagCondition(tag: string | undefined): StructuredCondition | null {
  return tag ? { $type: "TCardConditionalTag", Tags: [tag] } : null;
}

function conditionsFromTarget(tag: string | undefined, size: ItemSize | undefined): StructuredCondition[] | null {
  const conditions = [tagCondition(tag), sizeCondition(size)].filter(defined);
  return conditions.length > 0 ? conditions : null;
}

function cardTargetFromScope(
  scope: EffectTargetScope | undefined,
  tag?: string,
  size?: ItemSize,
  preferRandom = false,
  excludeSelf = false,
  explicitConditions?: StructuredCondition[],
  sortAttribute?: StructuredAttributeType
): StructuredTarget | undefined {
  const fallbackConditions = conditionsFromTarget(tag, size) ?? [];
  const conditions = [...(explicitConditions ?? []), ...fallbackConditions];
  const targetConditions = conditions.length > 0 ? conditions : null;

  switch (scope) {
    case "self":
      return { $type: "TTargetCardSelf", ...(targetConditions ? { Conditions: targetConditions } : {}) };
    case "trigger_source":
      return { $type: "TTargetCardTriggerSource", ...(targetConditions ? { Conditions: targetConditions } : {}) };
    case "adjacent":
      return { $type: "TTargetCardPositional", TargetMode: "Neighbor", ...(targetConditions ? { Conditions: targetConditions } : {}) };
    case "left":
      return { $type: "TTargetCardPositional", TargetMode: "LeftCard", ...(targetConditions ? { Conditions: targetConditions } : {}) };
    case "right":
      return { $type: "TTargetCardPositional", TargetMode: "RightCard", ...(targetConditions ? { Conditions: targetConditions } : {}) };
    case "leftmost":
      return { $type: "TTargetCardXMost", TargetMode: "LeftMostCard", ...(targetConditions ? { Conditions: targetConditions } : {}) };
    case "rightmost":
      return { $type: "TTargetCardXMost", TargetMode: "RightMostCard", ...(targetConditions ? { Conditions: targetConditions } : {}) };
    case "lowest_value":
      if (sortAttribute) {
        return {
          $type: "TTargetCardXMost",
          TargetMode: "LowestAttributeCard",
          AttributeType: sortAttribute,
          ...(targetConditions ? { Conditions: targetConditions } : {})
        };
      }
      return { $type: "TTargetCardXMost", TargetMode: "LowestValueCard", ...(targetConditions ? { Conditions: targetConditions } : {}) };
    case "highest_value":
      if (sortAttribute) {
        return {
          $type: "TTargetCardXMost",
          TargetMode: "HighestAttributeCard",
          AttributeType: sortAttribute,
          ...(targetConditions ? { Conditions: targetConditions } : {})
        };
      }
      return { $type: "TTargetCardXMost", TargetMode: "HighestValueCard", ...(targetConditions ? { Conditions: targetConditions } : {}) };
    case "fastest_cooldown":
      return { $type: "TTargetCardXMost", TargetMode: "LowestCooldownCard", ...(targetConditions ? { Conditions: targetConditions } : {}) };
    case "slowest_cooldown":
      return { $type: "TTargetCardXMost", TargetMode: "HighestCooldownCard", ...(targetConditions ? { Conditions: targetConditions } : {}) };
    case "allied_items":
      return {
        $type: preferRandom ? "TTargetCardRandom" : "TTargetCardSection",
        TargetSection: "SelfHand",
        ...(excludeSelf ? { ExcludeSelf: true } : {}),
        ...(targetConditions ? { Conditions: targetConditions } : {})
      };
    case "allied_skills":
      return {
        $type: preferRandom ? "TTargetCardRandom" : "TTargetCardSection",
        TargetSection: "SelfBoard",
        ...(targetConditions ? { Conditions: targetConditions } : {})
      };
    case "enemy_items":
      return {
        $type: preferRandom ? "TTargetCardRandom" : "TTargetCardSection",
        TargetSection: "OpponentBoard",
        ...(targetConditions ? { Conditions: targetConditions } : {})
      };
    case "all_items":
      return {
        $type: preferRandom ? "TTargetCardRandom" : "TTargetCardSection",
        TargetSection: "AllHands",
        ...(excludeSelf ? { ExcludeSelf: true } : {}),
        ...(targetConditions ? { Conditions: targetConditions } : {})
      };
    case "enemy":
      return {
        $type: "TTargetCardRandom",
        TargetSection: "OpponentBoard",
        ...(targetConditions ? { Conditions: targetConditions } : {})
      };
    case "random":
      return {
        $type: "TTargetCardRandom",
        TargetSection: "AllHands",
        ...(targetConditions ? { Conditions: targetConditions } : {})
      };
    case "unknown":
      return { $type: "TTargetUnknown", ...(targetConditions ? { Conditions: targetConditions } : {}) };
    default:
      return undefined;
  }
}

function playerTargetFromScope(scope: EffectTargetScope | undefined, defaultMode: "Self" | "Opponent" | "Both"): StructuredTarget {
  switch (scope) {
    case "enemy":
      return { $type: "TTargetPlayerRelative", TargetMode: "Opponent" };
    case "self":
      return { $type: "TTargetPlayerRelative", TargetMode: "Self" };
    default:
      return { $type: "TTargetPlayerRelative", TargetMode: defaultMode };
  }
}

function isPlayerTargetAction(effect: ParsedEffect): boolean {
  return structuredActionType(effect).startsWith("TActionPlayer");
}

function defaultPlayerTargetMode(action: EffectActionType): "Self" | "Opponent" | "Both" {
  return action === "damage" || action === "burn" || action === "poison" ? "Opponent" : "Self";
}

function hasDirectBothPlayersTarget(action: EffectActionType, rawText: string): boolean {
  const actionPattern =
    action === "damage"
      ? "(?:deal\\s+)?damage"
      : action === "burn" || action === "poison" || action === "shield" || action === "heal" || action === "regen"
        ? action
        : undefined;
  if (!actionPattern) return false;
  return new RegExp(`\\b${actionPattern}\\s+(?:to\\s+)?(?:both players?|each player)\\b`, "i").test(rawText);
}

function actionTarget(effect: ParsedEffect): StructuredTarget | undefined {
  if (isPlayerTargetAction(effect)) {
    return playerTargetFromScope(effect.target?.scope, defaultPlayerTargetMode(effect.action.type));
  }

  return effect.target
    ? cardTargetFromScope(
        effect.target.scope,
        effect.target.tag,
        effect.target.size,
        Boolean(effect.target.preferRandom) || /\brandom\b|\bany\s+(?:other\s+)?items?\b|\ban?\s+(?:(?:small|medium|large|[a-z-]+)\s+){0,4}enemy\s+item\b/i.test(effect.rawText ?? ""),
        effect.target.excludeSelf,
        effect.target.conditions,
        effect.target.sortAttribute
      )
    : undefined;
}

function fixedMultiplier(text: string): number | undefined {
  const expression = text.match(/\bequal\s+to\s+(?<expression>.+)$/i)?.groups?.expression ?? text;
  const percentage = expression.match(new RegExp(`\\b(${NUMBER_PATTERN})(?:\\s+\\w+)?%\\s+of\\b`, "i"));
  if (percentage) {
    return Number(percentage[1]) / 100;
  }
  if (/^\s*half\b/i.test(expression)) return 0.5;
  if (/^\s*(?:a|one)\s+third\b/i.test(expression)) return 1 / 3;
  if (/^\s*(?:double|twice)\b/i.test(expression)) return 2;
  if (/^\s*triple\b/i.test(expression)) return 3;

  const match =
    expression.match(new RegExp(`\\b(${NUMBER_PATTERN})(?:\\s+\\w+)?\\s+times\\b`, "i")) ??
    text.match(new RegExp(`\\bequal\\s+to\\s+(${NUMBER_PATTERN})\\s+times\\b`, "i"));
  return match ? Number(match[1]) : undefined;
}

function withMultiplier(value: StructuredValue, multiplier: number | undefined): StructuredValue {
  if (multiplier == null) {
    return value;
  }

  return {
    ...value,
    Modifier: {
      ModifyMode: "Multiply",
      Value: { $type: "TFixedValue", Value: multiplier }
    }
  } as StructuredValue;
}

function placeholderIdentifierValue(text: string): StructuredValue | undefined {
  const match = text.match(/\{(?<id>(?:ability|aura)\.[^}]+)\}/i);
  return match?.groups?.id ? { $type: "TIdentifierValue", Value: match.groups.id } : undefined;
}

function playerReferenceValue(text: string, actionType: EffectActionType): StructuredValue | undefined {
  const match =
    text.match(/\b(?<owner>enemy|enemy's|enemies|opponent|opponent's|your enemy|your enemy's|an enemy|an enemy's|your|you|self)\s+(?<stat>max\s+health|current\s+health|health|burn|poison|shield|regen|rage|income|gold)\b/i) ??
    text.match(/\b(?<stat>burn|poison|shield|regen|rage|max\s+health|health|income|gold)\s+on\s+(?<owner>your enemy|your opponent|an enemy|enemy)\b/i);
  if (!match?.groups?.stat) return undefined;
  const ownerText = match.groups.owner?.toLowerCase() ?? "your";
  const targetMode = /\benemy|opponent/.test(ownerText) ? "Opponent" : "Self";
  return {
    $type: "TReferenceValuePlayerAttribute",
    Target: { $type: "TTargetPlayerRelative", TargetMode: targetMode },
    AttributeType: attributeFromStat(match.groups.stat, actionType) ?? "Unknown"
  };
}

function cardReferenceTargetFromText(text: string): StructuredTarget | undefined {
  if (/\bthis item'?s\b|\bthis item\b/i.test(text)) {
    return { $type: "TTargetCardSelf" };
  }
  if (/\b(?:that item'?s|its|their)\b/i.test(text)) {
    return { $type: "TTargetCardTriggerSource" };
  }
  return undefined;
}

function countTargetFromForEachText(text: string): StructuredTarget | undefined {
  const match = text.match(/\bfor each(?: of)? (?<filter>.+?)(?:\s+you have|\s*$)/i);
  if (!match?.groups?.filter) return undefined;

  const filter = match.groups.filter
    .replace(/\b(?:your|enemy|items?|item\(s\)|cards?|card)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const normalized = filter.toLowerCase();
  const conditions: StructuredCondition[] = [];
  const status = /\bflying\b/.test(normalized)
    ? "flying"
    : /\bheated\b/.test(normalized)
      ? "heated"
      : /\bchilled\b/.test(normalized)
        ? "chilled"
        : /\bfrozen\b/.test(normalized)
          ? "frozen"
          : /\bslowed\b/.test(normalized)
            ? "slowed"
            : undefined;
  if (status) {
    conditions.push({ $type: "TCardConditionalStatus", Status: status, ...(/\bnon[-\s]/i.test(filter) ? { IsNot: true } : {}) });
  }

  return {
    $type: "TTargetCardSection",
    TargetSection: /\benemy\b|\bopponent\b/i.test(match.groups.filter) ? "OpponentBoard" : "SelfHand",
    ...(conditions.length > 0 ? { Conditions: conditions } : {})
  };
}

function playerPercentReferenceValue(text: string, actionType: EffectActionType): StructuredValue | undefined {
  if (!/\b\d+(?:\.\d+)?% of\b/i.test(text)) return undefined;
  const playerReference = playerReferenceValue(text, actionType);
  if (!playerReference) return undefined;

  const multiplier = fixedMultiplier(text);
  const countTarget = countTargetFromForEachText(text);
  if (multiplier != null && countTarget) {
    return {
      $type: "TExpressionValue",
      Operator: "Multiply",
      Values: [
        { $type: "TFixedValue", Value: multiplier },
        playerReference,
        { $type: "TReferenceValueCardCount", Target: countTarget }
      ]
    };
  }

  return withMultiplier(playerReference, multiplier);
}

function statusActionAttribute(statText: string): StructuredAttributeType | undefined {
  switch (statText.toLowerCase()) {
    case "burn":
    case "burned":
      return "BurnApplyAmount";
    case "poison":
    case "poisoned":
      return "PoisonApplyAmount";
    case "shield":
    case "shielded":
      return "ShieldApplyAmount";
    case "heal":
    case "healed":
      return "HealAmount";
    case "damage":
    case "damaged":
      return "DamageAmount";
    case "regen":
    case "regenerated":
      return "RegenApplyAmount";
    default:
      return undefined;
  }
}

function playerAttributeChangeReferenceValue(text: string): StructuredValue | undefined {
  const scope = /\bthis\s+fight\b|\bcombat\b/i.test(text)
    ? "Fight"
    : /\bthis\s+day\b|\bthis\s+hour\b/i.test(text)
      ? "Day"
      : /\bthis\s+run\b/i.test(text)
        ? "Run"
        : /\bthis\s+encounter\b/i.test(text)
          ? "Encounter"
          : undefined;
  const changeValue = (
    statText: string,
    changeDirection: "Gained" | "Lost" | "Changed"
  ): StructuredValue | undefined => {
    const attribute = attributeFromStat(statText);
    if (!attribute) return undefined;
    return withMultiplier({
      $type: "TReferenceValuePlayerAttributeChange",
      AttributeType: attribute,
      ChangeDirection: changeDirection,
      ...(scope ? { Scope: scope } : {})
    }, fixedMultiplier(text));
  };

  const statChangeMatch =
    text.match(/\b(?<stat>gold|rage|shield|health|damage|burn|poison|regen|xp|experience)\s+(?:you\s+)?(?:have\s+)?gained\b/i) ??
    text.match(/\b(?<stat>gold|rage|shield|health|damage|burn|poison|regen|xp|experience)\s+you'?ve\s+gained\b/i);
  if (statChangeMatch?.groups?.stat) {
    return changeValue(statChangeMatch.groups.stat, "Gained");
  }

  const amountGainedMatch = text.match(/\bamount of (?<stat>gold|rage|shield|health|damage|burn|poison|regen|xp|experience) gained\b/i);
  if (amountGainedMatch?.groups?.stat) {
    return changeValue(amountGainedMatch.groups.stat, "Gained");
  }

  const lostMatch = text.match(/\b(?<stat>gold|rage|shield|health|damage|burn|poison|regen|xp|experience)\s+lost\b/i);
  if (lostMatch?.groups?.stat) {
    return changeValue(lostMatch.groups.stat, "Lost");
  }

  const amountHealedMatch = /\bamount healed\b|\bamount of health healed\b|\bamount of healing\b/i.test(text);
  if (amountHealedMatch) {
    return changeValue("heal", "Gained");
  }

  const amountAppliedMatch = text.match(/\bamount\s+(?<stat>poisoned|burned|shielded|damaged|regenerated)\b/i);
  if (amountAppliedMatch?.groups?.stat) {
    const attribute = statusActionAttribute(amountAppliedMatch.groups.stat);
    if (attribute) {
      return withMultiplier({
        $type: "TReferenceValuePlayerAttributeChange",
        AttributeType: attribute,
        ChangeDirection: "Gained",
        ...(scope ? { Scope: scope } : {})
      }, fixedMultiplier(text));
    }
  }

  return undefined;
}

function cardAttributeAggregateReferenceValue(text: string, actionType: EffectActionType): StructuredValue | undefined {
  if (!/\bequal\b/i.test(text)) return undefined;
  const match =
    text.match(/\b(?<aggregate>highest|lowest)\s+(?<stat>damage|shield|heal|burn|poison|regen|crit chance|value|cooldown|ammo)\s+(?:of\s+)?(?<filter>items?\s+you\s+have|your\s+.+?items?|your\s+.+?item|.+?items?|.+?item|food|weapon|tool|friend|vehicle|drone|relic|property|core|potion)\b/i) ??
    text.match(/\b(?<stat>damage|shield|heal|burn|poison|regen|crit chance|value|cooldown|ammo)\s+of\s+your\s+(?<aggregate>highest|lowest)\s+(?:damage|shield|heal|burn|poison|regen|crit chance|value|cooldown|ammo)\s+(?<filter>.+?item|.+?items?)\b/i) ??
    text.match(/\byour\s+(?<aggregate>highest|lowest)\s+(?<stat>damage|shield|heal|burn|poison|regen|crit chance|value|cooldown|ammo)\s+(?<filter>food|weapon|tool|friend|vehicle|drone|relic|property|core|potion|item)\b/i);
  if (!match?.groups?.aggregate || !match.groups.stat) return undefined;

  const attribute = attributeFromStat(match.groups.stat, actionType);
  if (!attribute) return undefined;

  const filter = match.groups.filter ?? "";
  const targetSection = /\benemy|opponent\b/i.test(filter) ? "OpponentBoard" : "SelfHand";
  const tagText = filter
    .replace(/\bitems?\s+you\s+have\b/gi, " ")
    .replace(/\byour\b|\benemy\b|\bopponent\b|\bhighest\b|\blowest\b|\bitems?\b/gi, " ")
    .trim();
  const tag = tagText && !/^(?:item|items)$/i.test(tagText) ? tagText.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : undefined;

  return withMultiplier({
    $type: "TReferenceValueCardAttributeAggregate",
    Target: {
      $type: "TTargetCardSection",
      TargetSection: targetSection,
      ...(tag ? { Conditions: [{ $type: "TCardConditionalTag", Tags: [tag] }] } : {})
    },
    AttributeType: attribute,
    Aggregate: match.groups.aggregate.toLowerCase() === "lowest" ? "Min" : "Max"
  }, fixedMultiplier(text));
}

function playerAttributeSumReferenceValue(text: string, actionType: EffectActionType): StructuredValue | undefined {
  const match = text.match(/\b(?<left>regen|burn|poison|shield|health|rage|gold|income)\s+plus\s+(?:the\s+)?(?<right>regen|burn|poison|shield|health|rage|gold|income)\s+on\s+(?<owner>both players?|your enemy|your opponent|an enemy|enemy|you|yourself|your)\b/i);
  if (!match?.groups?.left || !match.groups.right) return undefined;
  const owner = match.groups.owner ?? "your";
  const targetMode = /\bboth players?\b/i.test(owner) ? "Both" : /\benemy|opponent\b/i.test(owner) ? "Opponent" : "Self";
  const values = [match.groups.left, match.groups.right]
    .map((stat) => attributeFromStat(stat, actionType))
    .filter((attribute): attribute is StructuredAttributeType => Boolean(attribute))
    .map((attribute): StructuredValue => ({
      $type: "TReferenceValuePlayerAttribute",
      Target: { $type: "TTargetPlayerRelative", TargetMode: targetMode },
      AttributeType: attribute
    }));
  if (values.length !== 2) return undefined;
  return withMultiplier({
    $type: "TExpressionValue",
    Operator: "Add",
    Values: values
  }, fixedMultiplier(text));
}

function playerIncomeReferenceValue(text: string): StructuredValue | undefined {
  if (!/\bequal\s+(?:to\s+)?(?:[-+]?\d+(?:\.\d+)?\s+times\s+)?to\s+your\s+income\b|\bequal\s+to\s+(?:[-+]?\d+(?:\.\d+)?\s+times\s+)?your\s+income\b/i.test(text)) {
    return undefined;
  }

  return withMultiplier({
    $type: "TReferenceValuePlayerAttribute",
    Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" },
    AttributeType: "Income"
  }, fixedMultiplier(text));
}

function valueFromAction(effect: ParsedEffect): StructuredValue | undefined {
  const text = effect.rawText ?? "";
  const attribute = defaultAttributeForAction(effect.action);

  const target = effect.target
    ? cardTargetFromScope(
        effect.target.scope,
        effect.target.tag,
        effect.target.size,
        false,
        effect.target.excludeSelf,
        effect.target.conditions,
        effect.target.sortAttribute
      )
    : undefined;
  const triggerTarget = effect.triggerTarget
    ? cardTargetFromScope(
        effect.triggerTarget.scope,
        effect.triggerTarget.tag,
        effect.triggerTarget.size,
        false,
        effect.triggerTarget.excludeSelf,
        effect.triggerTarget.conditions,
        effect.triggerTarget.sortAttribute
      )
    : undefined;

  const playerPercentReference = playerPercentReferenceValue(text, effect.action.type);
  if (playerPercentReference) {
    return playerPercentReference;
  }

  const playerAttributeChangeReference = playerAttributeChangeReferenceValue(text);
  if (playerAttributeChangeReference) {
    return playerAttributeChangeReference;
  }

  const playerAttributeSumReference = playerAttributeSumReferenceValue(text, effect.action.type);
  if (playerAttributeSumReference) {
    return playerAttributeSumReference;
  }

  const aggregateReference = cardAttributeAggregateReferenceValue(text, effect.action.type);
  if (aggregateReference) {
    return aggregateReference;
  }

  const incomeReference = playerIncomeReferenceValue(text);
  if (incomeReference) {
    return incomeReference;
  }

  if (["charge", "haste", "slow", "freeze"].includes(effect.action.type) && /\bhalf\s+(?:their|its|this item['’]s|that item['’]s)?\s*cooldowns?\b/i.test(text)) {
    return withMultiplier({
      $type: "TReferenceValueCardAttribute",
      Target: target ?? triggerTarget ?? { $type: "TTargetCardTriggerSource" },
      AttributeType: "CooldownMax"
    }, 0.5);
  }

  if (/\bequal to\b/i.test(text)) {
    if (/\benemy'?s\s+(burn|poison|shield|health|regen)\b/i.test(text)) {
      return withMultiplier({
        $type: "TReferenceValuePlayerAttribute",
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Opponent" },
        AttributeType: attributeFromStat(text.match(/\benemy'?s\s+([a-z]+)/i)?.[1], effect.action.type) ?? "Unknown"
      }, fixedMultiplier(text));
    }

    const playerReference = playerReferenceValue(text, effect.action.type);
    if (playerReference) {
      return withMultiplier(playerReference, fixedMultiplier(text));
    }

    const referenceAttribute =
      referenceAttributeFromText(text, referencedCardAttributeStat(text), effect.action.type) ??
      referenceAttributeFromText(text, text.match(/\bitem'?s\s+([a-z% ]+)\b/i)?.[1], effect.action.type) ??
      (/\bvalue\b/i.test(text) ? "Value" : undefined) ??
      attribute;

    return withMultiplier({
      $type: "TReferenceValueCardAttribute",
      Target: referenceAttribute === "Ammo" && /\b(?:its|their|current)\s+(?:current\s+)?ammo\b/i.test(text)
        ? { $type: "TTargetCardSelf" }
        : cardReferenceTargetFromText(text) ?? triggerTarget ?? target ?? { $type: "TTargetCardSelf" },
      AttributeType: referenceAttribute ?? "Unknown"
    }, fixedMultiplier(text));
  }

  const placeholderValue = placeholderIdentifierValue(text);
  if (placeholderValue) {
    return placeholderValue;
  }

  if (effect.action.value != null) {
    return { $type: "TFixedValue", Value: effect.action.value };
  }

  if (/\bfor each\b|\bfor every\b/i.test(text)) {
    return {
      $type: "TReferenceValueCardCount",
      Target: target ?? triggerTarget ?? { $type: "TTargetCardSection", TargetSection: "SelfHand" }
    };
  }

  return undefined;
}

function operationFromAction(action: ParsedEffect["action"], rawText = ""): StructuredAction["Operation"] | undefined {
  const clause = rawText.match(/\bwhen\b.+?,\s*(?<action>.+)$/i)?.groups?.action ?? rawText;
  if (action.type === "reduce_cooldown") {
    if (/\bhalved\b|\breduced by half\b/i.test(clause)) return "Multiply";
    if (/\bincreases?\b|\bincreased\b/i.test(clause)) return "Add";
    return "Subtract";
  }
  if (action.type === "cleanse") return "Subtract";
  if ((action.type === "gain_stat" || action.type === "increase_value") && /\bloses?\b/i.test(clause)) return "Subtract";
  if (action.type === "increase_value" || action.type === "gain_stat" || action.type === "gain_health" || action.type === "gain_gold") {
    return "Add";
  }
  if (action.type === "modify_stat") return "Multiply";
  return undefined;
}

function structuredAction(effect: ParsedEffect): StructuredAction {
  const attribute = defaultAttributeForAction(effect.action);
  const directBothPlayersTarget = hasDirectBothPlayersTarget(effect.action.type, effect.rawText ?? "");
  const target = directBothPlayersTarget && structuredActionType(effect).startsWith("TActionPlayer")
    ? { $type: "TTargetPlayerRelative" as const, TargetMode: "Both" as const }
    : actionTarget(effect);
  const value = valueFromAction(effect);
  const tags = effect.action.tag ? [effect.action.tag] : undefined;
  const operation = operationFromAction(effect.action, effect.rawText ?? "");

  return {
    $type: structuredActionType(effect),
    SourceAction: effect.action.type,
    ...(attribute ? { AttributeType: attribute } : {}),
    ...(operation ? { Operation: operation } : {}),
    ...(value ? { Value: value } : {}),
    ...(target ? { Target: target } : {}),
    ...(tags ? { Tags: tags } : {})
  };
}

function structuredCondition(condition: ParsedEffectCondition): StructuredCondition {
  switch (condition.type) {
    case "exactly_one":
      return {
        $type: "TCardConditionalCount",
        ComparisonOperator: "Equal",
        Amount: 1,
        ...(condition.tag ? { Tags: [condition.tag] } : {})
      };
    case "has_tag":
    case "target_has_tag":
      return condition.tag ? { $type: "TCardConditionalTag", Tags: [condition.tag], Role: condition.type } : { $type: "TConditionUnknown" };
    case "has_tag_expr":
      return { $type: "TCardConditionalTagExpr", Expr: condition.expr };
    case "has_card_status":
      return { $type: "TCardConditionalStatus", Status: condition.status };
    case "has_player_state":
      return {
        $type: "TPlayerConditionalState",
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" },
        StateType: condition.stateType,
        StateValue: { $type: "TIdentifierValue", Value: condition.stateValue }
      };
    case "minimum_count":
      return {
        $type: "TCardConditionalCount",
        ComparisonOperator: "GreaterThanOrEqual",
        Amount: condition.count ?? 0,
        ...(condition.tag ? { Tags: [condition.tag] } : {})
      };
    case "maximum_count":
      return {
        $type: "TCardConditionalCount",
        ComparisonOperator: "LessThanOrEqual",
        Amount: condition.count ?? 0,
        ...(condition.tag ? { Tags: [condition.tag] } : {})
      };
  }
}

function structuredTrigger(effect: ParsedEffect): StructuredTrigger {
  const triggerTarget = effect.triggerTarget
    ? cardTargetFromScope(
        effect.triggerTarget.scope,
        effect.triggerTarget.tag,
        effect.triggerTarget.size,
        false,
        effect.triggerTarget.excludeSelf,
        effect.triggerTarget.conditions,
        effect.triggerTarget.sortAttribute
      )
    : undefined;
  const tagSubject = effect.trigger.tag
    ? cardTargetFromScope("allied_items", effect.trigger.tag)
    : undefined;
  const thresholdSubject = effect.trigger.event === "player_attribute_threshold" && effect.trigger.targetMode
    ? ({ $type: "TTargetPlayerRelative", TargetMode: effect.trigger.targetMode } as const)
    : undefined;
  const conditions = effect.conditions?.map(structuredCondition);

  return {
    $type: triggerTypeToStructured(effect.trigger.event),
    SourceEvent: effect.trigger.event,
    ...(effect.trigger.tag ? { Tag: effect.trigger.tag } : {}),
    ...(effect.trigger.status ? { Status: effect.trigger.status } : effect.trigger.event === "status_ended" && /stop being enraged/i.test(effect.rawText ?? "") ? { Status: "enraged" } : {}),
    ...(triggerTarget ?? tagSubject ?? thresholdSubject ? { Subject: triggerTarget ?? tagSubject ?? thresholdSubject } : {}),
    ...(conditions?.length ? { Conditions: conditions } : {}),
    ...(effect.trigger.effectPredicate ? { EffectPredicate: effect.trigger.effectPredicate } : {}),
    ...(effect.trigger.limit ? { Limit: effect.trigger.limit } : {}),
    ...(effect.trigger.attributeType ? { AttributeType: effect.trigger.attributeType } : {}),
    ...(effect.trigger.threshold ? { Threshold: effect.trigger.threshold } : {}),
    ...(effect.trigger.crossing ? { Crossing: effect.trigger.crossing } : {}),
    ...(effect.trigger.changeDirection ? { ChangeDirection: effect.trigger.changeDirection } : {})
  };
}

function isAuraEffect(effect: ParsedEffect): boolean {
  return effect.trigger.event === "always" || (effect.trigger.event === "condition_active" && !effect.trigger.limit && !effect.trigger.attributeType);
}

export function toStructuredEffect(effect: ParsedEffect, index = 0): StructuredEffect {
  return {
    id: String(index),
    kind: isAuraEffect(effect) ? "aura" : "ability",
    activeIn: "hand_only",
    ...(isAuraEffect(effect) ? {} : { trigger: structuredTrigger(effect) }),
    action: structuredAction(effect),
    ...(effect.conditions?.length ? { prerequisites: effect.conditions.map(structuredCondition) } : {}),
    rawText: effect.rawText ?? ""
  };
}

function attributeToStat(attribute: StructuredAttributeType | undefined): string | undefined {
  switch (attribute) {
    case "Ammo":
    case "AmmoMax":
      return "ammo";
    case "Burn":
    case "BurnApplyAmount":
      return "burn";
    case "BuyPrice":
    case "SellPrice":
    case "Value":
      return "value";
    case "CooldownMax":
      return "cooldown";
    case "CritChance":
      return "crit";
    case "CritDamage":
      return "crit_damage";
    case "DamageAmount":
      return "damage";
    case "FreezeAmount":
      return "freeze";
    case "Gold":
    case "Income":
      return "gold";
    case "Experience":
      return "experience";
    case "HasteAmount":
      return "haste";
    case "HealAmount":
      return "heal";
    case "Health":
    case "HealthMax":
      return "health";
    case "Lifesteal":
      return "lifesteal";
    case "Multicast":
      return "multicast";
    case "Poison":
    case "PoisonApplyAmount":
      return "poison";
    case "Prestige":
      return "prestige";
    case "Rage":
      return "rage";
    case "RageRequirement":
      return "rage";
    case "RegenApplyAmount":
      return "regen";
    case "ReloadAmount":
      return "reload";
    case "RerollCost":
      return "gold";
    case "Shield":
    case "ShieldApplyAmount":
      return "shield";
    case "SlowAmount":
      return "slow";
    case "EffectMagnitude":
      return "effect_magnitude";
    case "EffectDuration":
      return "effect_duration";
    case "EffectValue":
      return "effect_value";
    case "EffectTrigger":
      return "effect_trigger";
    default:
      return undefined;
  }
}

function fixedValue(value: StructuredValue | undefined): number | undefined {
  return value?.$type === "TFixedValue" ? value.Value : undefined;
}

function targetConditionTag(conditions: StructuredCondition[] | null | undefined): string | undefined {
  return conditions?.find((condition) => condition.$type === "TCardConditionalTag")?.Tags[0];
}

function targetConditionSize(conditions: StructuredCondition[] | null | undefined): ItemSize | undefined {
  return conditions?.find((condition) => condition.$type === "TCardConditionalSize")?.Sizes[0];
}

function targetConditions(target: StructuredTarget | undefined): StructuredCondition[] | null | undefined {
  return target && "Conditions" in target ? target.Conditions : undefined;
}

function targetToView(target: StructuredTarget | undefined): StructuredEffectView["target"] {
  if (!target) return undefined;
  const conditions = targetConditions(target);
  const tag = targetConditionTag(conditions);
  const size = targetConditionSize(conditions);
  const withFilters = (scope: EffectTargetScope): NonNullable<StructuredEffectView["target"]> => ({
    scope,
    ...(tag ? { tag } : {}),
    ...(size ? { size } : {}),
    ...("ExcludeSelf" in target && target.ExcludeSelf ? { excludeSelf: true } : {})
  });

  switch (target.$type) {
    case "TTargetCardSelf":
      return withFilters("self");
    case "TTargetCardTriggerSource":
      return withFilters("trigger_source");
    case "TTargetCardPositional":
      switch (target.TargetMode) {
        case "Neighbor":
          if (target.Anchor?.$type === "TTargetCardTriggerSource") return withFilters("trigger_source_adjacent");
          return withFilters("adjacent");
        case "LeftCard":
        case "AllLeftCards":
          return withFilters("left");
        case "RightCard":
        case "AllRightCards":
          return withFilters("right");
        case "LeftMostCard":
          return withFilters("leftmost");
        case "RightMostCard":
          return withFilters("rightmost");
      }
      break;
    case "TTargetCardXMost":
      if (target.TargetMode === "LeftMostCard") return withFilters("leftmost");
      if (target.TargetMode === "RightMostCard") return withFilters("rightmost");
      if (target.TargetMode === "LowestValueCard" || target.TargetMode === "LowestAttributeCard") return withFilters("lowest_value");
      if (target.TargetMode === "HighestValueCard" || target.TargetMode === "HighestAttributeCard") return withFilters("highest_value");
      if (target.TargetMode === "LowestCooldownCard") return withFilters("fastest_cooldown");
      return withFilters("slowest_cooldown");
    case "TTargetCardSection":
    case "TTargetCardRandom":
      if (target.TargetSection === "OpponentBoard") return withFilters("enemy_items");
      if (target.TargetSection === "AllBoards") return withFilters("all_items");
      if (target.TargetSection === "AllHands") return withFilters("all_items");
      if (target.TargetSection === "SelfBoard") return withFilters("allied_skills");
      return withFilters("allied_items");
    case "TTargetPlayerRelative":
      if (target.TargetMode === "Both") return withFilters("self");
      if (target.TargetMode === "Opponent") return withFilters("enemy");
      if (target.TargetMode === "Self") return withFilters("self");
      return withFilters("unknown");
    case "TTargetPlayerTriggerSource":
      return withFilters("trigger_player");
    case "TTargetBoardSlotRandom":
    case "TTargetBoardSlotSection":
    case "TTargetBoardSlotPositional":
    case "TTargetEffect":
    case "TTargetStatusApplication":
      return undefined;
    case "TTargetUnknown":
      return withFilters("unknown");
  }
}

function conditionToView(condition: StructuredCondition): EffectCondition {
  switch (condition.$type) {
    case "TCardConditionalTag":
      return { type: condition.Role === "target_has_tag" ? "target_has_tag" : "has_tag", tag: condition.Tags[0] };
    case "TCardConditionalSize":
      return { type: "has_tag", tag: condition.Sizes[0] === 1 ? "small" : condition.Sizes[0] === 2 ? "medium" : "large" };
    case "TCardConditionalRarity":
      return { type: "has_tag", tag: condition.Rarity.toLowerCase() };
    case "TCardConditionalCount":
      if (condition.ComparisonOperator === "Equal" && condition.Amount === 1) {
        return { type: "exactly_one", tag: condition.Tags?.[0] };
      }
      return {
        type: condition.ComparisonOperator === "LessThanOrEqual" ? "maximum_count" : "minimum_count",
        count: condition.Amount,
        tag: condition.Tags?.[0]
      };
    case "TCardConditionalAttribute":
    case "TCardConditionalTierComparison":
    case "TCardConditionalTagExpr":
      return { type: "has_tag" };
    case "TCardConditionalStatus":
      return { type: "has_card_status", status: condition.Status };
    case "TPlayerConditionalState":
    case "TConditionUnknown":
      return { type: "has_tag" };
  }
}

function actionTypeFromStructured(action: StructuredAction): EffectActionType {
  return action.SourceAction ?? "unknown";
}

function triggerFromStructured(effect: StructuredEffect): StructuredEffectView["trigger"] {
  if (effect.trigger) {
    return {
      event: effect.trigger.SourceEvent,
      ...(effect.trigger.Tag ? { tag: effect.trigger.Tag } : {}),
      ...(effect.trigger.Status ? { tag: effect.trigger.Status } : {})
    };
  }

  return {
    event: effect.prerequisites?.length ? "condition_active" : "always"
  };
}

export function structuredEffectView(effect: StructuredEffect): StructuredEffectView {
  const cached = viewCache.get(effect);
  if (cached) return cached;

  const actionType = actionTypeFromStructured(effect.action);
  const target = targetToView(effect.action.Target);
  const triggerTarget = targetToView(effect.trigger?.Subject);
  const conditions = [
    ...(effect.trigger?.Conditions ?? []),
    ...(effect.prerequisites ?? [])
  ].map(conditionToView);
  const stat = attributeToStat(effect.action.AttributeType);
  const value = fixedValue(effect.action.Value);
  const tag = effect.action.Tags?.[0];

  const view: StructuredEffectView = {
    trigger: triggerFromStructured(effect),
    action: {
      type: actionType,
      ...(value != null ? { value } : {}),
      ...(stat ? { stat } : {}),
      ...(tag ? { tag } : {})
    },
    ...(target ? { target } : {}),
    ...(triggerTarget ? { triggerTarget } : {}),
    ...(conditions.length > 0 ? { conditions } : {}),
    rawText: effect.rawText
  };
  viewCache.set(effect, view);
  return view;
}

export function structuredEffectViews(effects: StructuredEffect[]): StructuredEffectView[] {
  const cached = viewListCache.get(effects);
  if (cached) return cached;

  const views = effects.map(structuredEffectView);
  viewListCache.set(effects, views);
  return views;
}

function titleCase(value: string): string {
  return value ? `${value.slice(0, 1).toUpperCase()}${value.slice(1)}` : value;
}

function addUnique<T>(target: Set<T>, value: T | null | undefined): void {
  if (value != null && value !== "") target.add(value);
}

function collectTagExpr(expr: StructuredTagExpr | undefined, output: Set<string>): void {
  if (!expr) return;
  if (expr.$type === "HasTag") {
    output.add(expr.Tag);
  } else if (expr.$type === "AnyOf" || expr.$type === "AllOf" || expr.$type === "NoneOf") {
    expr.Tags.forEach((tag) => output.add(tag));
  } else if (expr.$type === "Not") {
    collectTagExpr(expr.Expr, output);
  } else if (expr.$type === "And" || expr.$type === "Or") {
    expr.Exprs.forEach((entry: StructuredTagExpr) => collectTagExpr(entry, output));
  }
}

function collectConditions(
  conditions: StructuredCondition[] | null | undefined,
  cardTags: Set<string>,
  attributes: Set<StructuredAttributeType>,
  playerTags?: Set<string>,
  statuses?: Set<string>
): void {
  conditions?.forEach((condition) => {
    if (condition.$type === "TCardConditionalTag") condition.Tags.forEach((tag) => cardTags.add(tag));
    if (condition.$type === "TCardConditionalTagExpr") collectTagExpr(condition.Expr, cardTags);
    if (condition.$type === "TCardConditionalStatus") statuses?.add(condition.Status);
    if (condition.$type === "TCardConditionalAttribute") attributes.add(condition.AttributeType);
    if (condition.$type === "TCardConditionalTierComparison") attributes.add("Unknown");
    if (condition.$type === "TCardConditionalRarity") cardTags.add(condition.Rarity.toLowerCase());
    if (condition.$type === "TPlayerConditionalState") {
      const value = condition.StateValue.$type === "TIdentifierValue" ? condition.StateValue.Value : undefined;
      if (playerTags && value) playerTags.add(value);
    }
  });
}

function collectValue(value: StructuredValue | undefined, output: { hasDynamicValue: boolean; attributes: Set<StructuredAttributeType>; cardTags: Set<string> }): void {
  if (!value) return;
  if (value.$type === "TVariableValue" || value.$type === "TExpressionValue") output.hasDynamicValue = true;
  if (
    value.$type === "TReferenceValueCardAttribute" ||
    value.$type === "TReferenceValueCardAttributeAggregate" ||
    value.$type === "TReferenceValuePlayerAttribute"
  ) {
    output.hasDynamicValue = true;
    output.attributes.add(value.AttributeType);
    collectTarget(value.Target, output);
  }
  if (value.$type === "TReferenceValueCardCount" || value.$type === "TReferenceValueCardTagCount") {
    output.hasDynamicValue = true;
    collectTarget(value.Target, output);
  }
  if (value.$type === "TReferenceValuePlayerAttributeChange") {
    output.hasDynamicValue = true;
    if (value.AttributeType) output.attributes.add(value.AttributeType);
  }
  if (value.$type === "TExpressionValue") value.Values.forEach((entry) => collectValue(entry, output));
  if ("Modifier" in value && value.Modifier) collectValue(value.Modifier.Value, output);
}

function collectEffectPredicate(predicate: StructuredEffectPredicate | undefined, actionFamilies: Set<string>, attributes: Set<StructuredAttributeType>): void {
  if (!predicate) return;
  if (predicate.$type === "TEffectPredicateFamily") {
    actionFamilies.add(titleCase(predicate.Family));
  } else if (predicate.$type === "TEffectPredicateAttribute") {
    attributes.add(predicate.AttributeType);
  } else if (predicate.$type === "TEffectPredicateNot") {
    collectEffectPredicate(predicate.Predicate, actionFamilies, attributes);
  } else {
    predicate.Predicates.forEach((entry) => collectEffectPredicate(entry, actionFamilies, attributes));
  }
}

function collectTarget(
  target: StructuredTarget | undefined,
  output: { targetKinds?: Set<string>; cardTags: Set<string>; statuses?: Set<string>; actionFamilies?: Set<string>; attributes: Set<StructuredAttributeType> }
): void {
  if (!target) return;
  if (target.$type.startsWith("TTargetCard")) {
    output.targetKinds?.add("Card");
    if (target.$type === "TTargetCardXMost" && "AttributeType" in target) output.attributes.add(target.AttributeType);
    collectConditions("Conditions" in target ? target.Conditions : undefined, output.cardTags, output.attributes, undefined, output.statuses);
  } else if (target.$type.startsWith("TTargetBoardSlot")) {
    output.targetKinds?.add("Slot");
    collectConditions("Conditions" in target ? target.Conditions : undefined, output.cardTags, output.attributes, undefined, output.statuses);
  } else if (target.$type === "TTargetPlayerRelative" || target.$type === "TTargetPlayerTriggerSource") {
    output.targetKinds?.add("Player");
    collectConditions(target.Conditions, output.cardTags, output.attributes, undefined, output.statuses);
  } else if (target.$type === "TTargetEffect") {
    output.targetKinds?.add("Effect");
    collectEffectPredicate(target.Predicate, output.actionFamilies ?? new Set<string>(), output.attributes);
  } else if (target.$type === "TTargetStatusApplication") {
    output.targetKinds?.add("StatusApplication");
    output.statuses?.add(target.Status);
    collectTarget(target.Target, output);
  } else {
    output.targetKinds?.add("Unknown");
    collectConditions("Conditions" in target ? target.Conditions : undefined, output.cardTags, output.attributes, undefined, output.statuses);
  }
}

export function structuredEffectFacets(effect: StructuredEffect): StructuredEffectFacets {
  const actionFamilies = new Set<string>();
  const targetKinds = new Set<string>();
  const cardTags = new Set<string>();
  const playerTags = new Set<string>();
  const statuses = new Set<string>();
  const terrains = new Set<string>();
  const attributes = new Set<StructuredAttributeType>();
  const dynamic = { hasDynamicValue: false, attributes, cardTags };

  const action = effect.action;
  addUnique(actionFamilies, action.SourceAction === "unknown" ? undefined : titleCase(action.SourceAction));
  if (action.$type === "TActionBoardSlotSetTerrain") actionFamilies.add("SlotTerrain");
  if (action.$type === "TActionEffectModify") actionFamilies.add("EffectModifier");
  if (action.$type === "TActionStatusDurationModify") actionFamilies.add("StatusDurationModifier");
  if (action.$type === "TActionStatusModify") actionFamilies.add("StatusModifier");
  if (action.$type === "TActionPlayerModifyState") actionFamilies.add("PlayerState");
  if (action.$type === "TActionVariableModify") actionFamilies.add("Variable");
  if (action.$type === "TActionPlayerPreventDamage") actionFamilies.add("PreventDamage");

  addUnique(attributes, action.AttributeType);
  action.Tags?.forEach((tag) => cardTags.add(tag));
  addUnique(terrains, action.Terrain);
  addUnique(statuses, action.OccupantStatusHint);
  addUnique(statuses, action.Status);
  if (action.Target?.$type === "TTargetStatusApplication") statuses.add(action.Target.Status);
  if (action.StateType === "PlayerTag" || action.StateType === "PlayerStatus" || action.StateType === "FactionMembership") {
    const value = action.StateValue?.$type === "TIdentifierValue" ? action.StateValue.Value : undefined;
    addUnique(playerTags, value);
  }
  collectEffectPredicate(action.EffectPredicate, actionFamilies, attributes);
  collectTarget(action.Target, { targetKinds, cardTags, statuses, actionFamilies, attributes });
  collectTarget(effect.trigger?.Subject, { targetKinds, cardTags, statuses, actionFamilies, attributes });
  collectTarget(effect.trigger?.Target, { targetKinds, cardTags, statuses, actionFamilies, attributes });
  collectConditions(effect.trigger?.Conditions, cardTags, attributes, playerTags, statuses);
  addUnique(statuses, effect.trigger?.Status);
  collectEffectPredicate(effect.trigger?.EffectPredicate, actionFamilies, attributes);
  collectConditions(effect.prerequisites, cardTags, attributes, playerTags, statuses);
  collectValue(action.Value, dynamic);
  effect.variableDeclarations?.forEach((variable) => {
    collectValue(variable.defaultValue, dynamic);
    addUnique(attributes, variable.attributeHint);
  });

  return {
    actionFamilies: [...actionFamilies].sort(),
    targetKinds: [...targetKinds].sort(),
    cardTags: [...cardTags].sort(),
    playerTags: [...playerTags].sort(),
    statuses: [...statuses].sort(),
    terrains: [...terrains].sort(),
    attributes: [...attributes].sort(),
    hasTriggerLimit: Boolean(effect.trigger?.Limit),
    hasDynamicValue: dynamic.hasDynamicValue,
    isEffectModifier: action.$type === "TActionEffectModify"
  };
}

export function structuredEffectFacetsList(effects: StructuredEffect[]): StructuredEffectFacets[] {
  return effects.map(structuredEffectFacets);
}

export function structuredEffectHasAction(effect: StructuredEffect, actionTypes: EffectActionType[]): boolean {
  return actionTypes.includes(structuredEffectView(effect).action.type);
}

export function structuredEffectHasUnknown(effect: StructuredEffect): boolean {
  const view = structuredEffectView(effect);
  return view.trigger.event === "unknown" || view.action.type === "unknown" || view.target?.scope === "unknown";
}
