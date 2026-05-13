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
  };
  triggerTarget?: {
    scope: EffectTargetScope;
    tag?: string;
    size?: ItemSize;
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
    case "damage":
      return "DamageAmount";
    case "gold":
      return "Gold";
    case "haste":
      return "HasteAmount";
    case "heal":
      return "HealAmount";
    case "health":
    case "max health":
      return "HealthMax";
    case "multicast":
      return "Multicast";
    case "poison":
      return actionType === "poison" ? "PoisonApplyAmount" : "Poison";
    case "prestige":
      return "Prestige";
    case "rage":
      return "Rage";
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
    case "destroyed":
      return "TTriggerOnCardDestroyed";
    case "merchant":
      return "TTriggerOnMerchantVisited";
    case "crit":
      return "TTriggerOnCardCritted";
    case "enrage":
      return "TTriggerOnEnrage";
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
  preferRandom = false
): StructuredTarget | undefined {
  const conditions = conditionsFromTarget(tag, size);

  switch (scope) {
    case "self":
      return { $type: "TTargetCardSelf", ...(conditions ? { Conditions: conditions } : {}) };
    case "adjacent":
      return { $type: "TTargetCardPositional", TargetMode: "Neighbor", ...(conditions ? { Conditions: conditions } : {}) };
    case "left":
      return { $type: "TTargetCardPositional", TargetMode: "LeftCard", ...(conditions ? { Conditions: conditions } : {}) };
    case "right":
      return { $type: "TTargetCardPositional", TargetMode: "RightCard", ...(conditions ? { Conditions: conditions } : {}) };
    case "leftmost":
      return { $type: "TTargetCardXMost", TargetMode: "LeftMostCard", ...(conditions ? { Conditions: conditions } : {}) };
    case "rightmost":
      return { $type: "TTargetCardXMost", TargetMode: "RightMostCard", ...(conditions ? { Conditions: conditions } : {}) };
    case "allied_items":
      return {
        $type: preferRandom ? "TTargetCardRandom" : "TTargetCardSection",
        TargetSection: "SelfHand",
        ...(conditions ? { Conditions: conditions } : {})
      };
    case "allied_skills":
      return {
        $type: preferRandom ? "TTargetCardRandom" : "TTargetCardSection",
        TargetSection: "SelfBoard",
        ...(conditions ? { Conditions: conditions } : {})
      };
    case "enemy_items":
      return {
        $type: preferRandom ? "TTargetCardRandom" : "TTargetCardSection",
        TargetSection: "OpponentBoard",
        ...(conditions ? { Conditions: conditions } : {})
      };
    case "enemy":
      return {
        $type: "TTargetCardRandom",
        TargetSection: "OpponentBoard",
        ...(conditions ? { Conditions: conditions } : {})
      };
    case "random":
      return {
        $type: "TTargetCardRandom",
        TargetSection: "AllHands",
        ...(conditions ? { Conditions: conditions } : {})
      };
    case "unknown":
      return { $type: "TTargetUnknown", ...(conditions ? { Conditions: conditions } : {}) };
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

function actionTarget(effect: ParsedEffect): StructuredTarget | undefined {
  if (isPlayerTargetAction(effect)) {
    return playerTargetFromScope(effect.target?.scope, defaultPlayerTargetMode(effect.action.type));
  }

  return effect.target
    ? cardTargetFromScope(effect.target.scope, effect.target.tag, effect.target.size, /\brandom\b/i.test(effect.rawText ?? ""))
    : undefined;
}

function fixedMultiplier(text: string): number | undefined {
  const match =
    text.match(new RegExp(`\\bequal\\s+to\\s+(${NUMBER_PATTERN})\\s+times\\b`, "i")) ??
    text.match(new RegExp(`\\b(${NUMBER_PATTERN})\\s+times\\b`, "i"));
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

function valueFromAction(effect: ParsedEffect): StructuredValue | undefined {
  const text = effect.rawText ?? "";
  const attribute = defaultAttributeForAction(effect.action);

  const target = effect.target ? cardTargetFromScope(effect.target.scope, effect.target.tag, effect.target.size) : undefined;
  const triggerTarget = effect.triggerTarget
    ? cardTargetFromScope(effect.triggerTarget.scope, effect.triggerTarget.tag, effect.triggerTarget.size)
    : undefined;

  if (/\bequal to\b/i.test(text)) {
    if (/\benemy'?s\s+(burn|poison|shield|health|regen)\b/i.test(text)) {
      return withMultiplier({
        $type: "TReferenceValuePlayerAttribute",
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Opponent" },
        AttributeType: attributeFromStat(text.match(/\benemy'?s\s+([a-z]+)/i)?.[1], effect.action.type) ?? "Unknown"
      }, fixedMultiplier(text));
    }

    const referenceAttribute =
      attributeFromStat(text.match(/\bitem'?s\s+([a-z% ]+)\b/i)?.[1], effect.action.type) ??
      attributeFromStat(text.match(/\b(?:its|their|this)\s+([a-z% ]+)\b/i)?.[1], effect.action.type) ??
      (/\bvalue\b/i.test(text) ? "Value" : undefined) ??
      attribute;

    return withMultiplier({
      $type: "TReferenceValueCardAttribute",
      Target: triggerTarget ?? target ?? { $type: "TTargetCardSelf" },
      AttributeType: referenceAttribute ?? "Unknown"
    }, fixedMultiplier(text));
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

function operationFromAction(action: ParsedEffect["action"]): StructuredAction["Operation"] | undefined {
  if (action.type === "reduce_cooldown") return "Subtract";
  if (action.type === "cleanse") return "Subtract";
  if (action.type === "increase_value" || action.type === "gain_stat" || action.type === "gain_health" || action.type === "gain_gold") {
    return "Add";
  }
  if (action.type === "modify_stat") return "Multiply";
  return undefined;
}

function structuredAction(effect: ParsedEffect): StructuredAction {
  const attribute = defaultAttributeForAction(effect.action);
  const target = actionTarget(effect);
  const value = valueFromAction(effect);
  const tags = effect.action.tag ? [effect.action.tag] : undefined;
  const operation = operationFromAction(effect.action);

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
    ? cardTargetFromScope(effect.triggerTarget.scope, effect.triggerTarget.tag, effect.triggerTarget.size)
    : undefined;
  const tagSubject = effect.trigger.tag
    ? cardTargetFromScope("allied_items", effect.trigger.tag)
    : undefined;
  const conditions = effect.conditions?.map(structuredCondition);

  return {
    $type: triggerTypeToStructured(effect.trigger.event),
    SourceEvent: effect.trigger.event,
    ...(effect.trigger.tag ? { Tag: effect.trigger.tag } : {}),
    ...(triggerTarget ?? tagSubject ? { Subject: triggerTarget ?? tagSubject } : {}),
    ...(conditions?.length ? { Conditions: conditions } : {})
  };
}

function isAuraEffect(effect: ParsedEffect): boolean {
  return effect.trigger.event === "always" || effect.trigger.event === "condition_active";
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
    case "DamageAmount":
      return "damage";
    case "FreezeAmount":
      return "freeze";
    case "Gold":
    case "Income":
      return "gold";
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
    case "RegenApplyAmount":
      return "regen";
    case "ReloadAmount":
      return "reload";
    case "Shield":
    case "ShieldApplyAmount":
      return "shield";
    case "SlowAmount":
      return "slow";
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

function targetToView(target: StructuredTarget | undefined): StructuredEffectView["target"] {
  if (!target) return undefined;
  const tag = targetConditionTag(target.Conditions);
  const size = targetConditionSize(target.Conditions);
  const withFilters = (scope: EffectTargetScope): NonNullable<StructuredEffectView["target"]> => ({
    scope,
    ...(tag ? { tag } : {}),
    ...(size ? { size } : {})
  });

  switch (target.$type) {
    case "TTargetCardSelf":
      return withFilters("self");
    case "TTargetCardTriggerSource":
      return withFilters("allied_items");
    case "TTargetCardPositional":
      switch (target.TargetMode) {
        case "Neighbor":
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
      return withFilters(target.TargetMode === "LeftMostCard" ? "leftmost" : "rightmost");
    case "TTargetCardSection":
    case "TTargetCardRandom":
      if (target.TargetSection === "OpponentBoard") return withFilters("enemy_items");
      if (target.TargetSection === "AllHands") return withFilters("random");
      if (target.TargetSection === "SelfBoard") return withFilters("allied_skills");
      return withFilters("allied_items");
    case "TTargetPlayerRelative":
      if (target.TargetMode === "Opponent") return withFilters("enemy");
      if (target.TargetMode === "Self") return withFilters("self");
      return withFilters("unknown");
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
      ...(effect.trigger.Tag ? { tag: effect.trigger.Tag } : {})
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

export function structuredEffectHasAction(effect: StructuredEffect, actionTypes: EffectActionType[]): boolean {
  return actionTypes.includes(structuredEffectView(effect).action.type);
}

export function structuredEffectHasUnknown(effect: StructuredEffect): boolean {
  const view = structuredEffectView(effect);
  return view.trigger.event === "unknown" || view.action.type === "unknown" || view.target?.scope === "unknown";
}
