import type { SemanticEffectDocument, SemanticWarning } from "./semanticEffects";

export type EffectEvent =
  | "always"
  | "combat_start"
  | "cooldown_ready"
  | "item_used"
  | "skill_active"
  | "tag_item_used"
  | "adjacent_item_used"
  | "gain_shield"
  | "heal"
  | "apply_burn"
  | "apply_poison"
  | "deal_damage"
  | "effect_applied"
  | "effect_sequence_completed"
  | "enemy_damaged"
  | "enemy_healed"
  | "enemy_shielded"
  | "buy"
  | "sell"
  | "level_up"
  | "transformed"
  | "fight_end"
  | "win"
  | "lose"
  | "ammo_empty"
  | "reload"
  | "repair_or_transform"
  | "destroyed"
  | "merchant"
  | "day_started"
  | "crit"
  | "enrage"
  | "status_ended"
  | "status_changed"
  | "would_be_defeated"
  | "player_attribute_threshold"
  | "card_attribute_threshold"
  | "player_attribute_changed"
  | "condition_active"
  | "unknown";

export type EffectActionType =
  | "damage"
  | "shield"
  | "heal"
  | "regen"
  | "lifesteal"
  | "burn"
  | "poison"
  | "haste"
  | "slow"
  | "freeze"
  | "charge"
  | "reduce_cooldown"
  | "gain_stat"
  | "gain_item"
  | "buff_tag"
  | "increase_value"
  | "gain_gold"
  | "gain_health"
  | "multicast"
  | "reload"
  | "repair"
  | "transform"
  | "enchant"
  | "flying"
  | "cleanse"
  | "upgrade"
  | "use"
  | "destroy"
  | "redirect"
  | "modify_stat"
  | "modify_slot"
  | "modify_effect"
  | "modify_status_duration"
  | "modify_status"
  | "modify_player_state"
  | "modify_variable"
  | "prevent_damage"
  | "start_sandstorm"
  | "unknown";

export type EffectTargetScope =
  | "self"
  | "enemy"
  | "adjacent"
  | "left"
  | "right"
  | "leftmost"
  | "rightmost"
  | "lowest_value"
  | "highest_value"
  | "fastest_cooldown"
  | "slowest_cooldown"
  | "allied_items"
  | "enemy_items"
  | "all_items"
  | "allied_skills"
  | "trigger_source"
  | "trigger_source_adjacent"
  | "trigger_player"
  | "random"
  | "unknown";

export type EffectCondition =
  | {
      type: "exactly_one";
      tag?: string;
    }
  | {
      type: "target_has_tag";
      tag?: string;
    }
  | {
      type: "has_tag";
      tag?: string;
    }
  | {
      type: "has_tag_expr";
      expr: StructuredTagExpr;
      tag?: string;
    }
  | {
      type: "has_player_state";
      stateType: StructuredPlayerStateType;
      stateValue: string;
      tag?: string;
    }
  | {
      type: "has_card_status";
      status: string;
      tag?: string;
    }
  | {
      type: "minimum_count";
      tag?: string;
      count?: number;
    }
  | {
      type: "maximum_count";
      tag?: string;
      count?: number;
    };

export type StructuredEffectKind = "ability" | "aura";

export type StructuredActiveIn = "hand_only" | "hand_and_stash";

export type StructuredTriggerType =
  | "TTriggerAlways"
  | "TTriggerOnCardFired"
  | "TTriggerOnFightStarted"
  | "TTriggerOnItemUsed"
  | "TTriggerOnCardPerformedShield"
  | "TTriggerOnCardPerformedHeal"
  | "TTriggerOnCardPerformedBurn"
  | "TTriggerOnCardPerformedPoison"
  | "TTriggerOnCardPerformedDamage"
  | "TTriggerOnEffectApplied"
  | "TTriggerOnEffectSequenceCompleted"
  | "TTriggerOnEnemyDamaged"
  | "TTriggerOnEnemyHealed"
  | "TTriggerOnEnemyShielded"
  | "TTriggerOnCardPurchased"
  | "TTriggerOnCardSold"
  | "TTriggerOnCardUpgraded"
  | "TTriggerOnCardTransformed"
  | "TTriggerOnFightEnded"
  | "TTriggerOnCombatWon"
  | "TTriggerOnCombatLost"
  | "TTriggerOnCardAmmoEmpty"
  | "TTriggerOnCardReloaded"
  | "TTriggerOnRepairOrTransform"
  | "TTriggerOnCardDestroyed"
  | "TTriggerOnMerchantVisited"
  | "TTriggerOnDayStarted"
  | "TTriggerOnCardCritted"
  | "TTriggerOnEnrage"
  | "TTriggerOnStatusEnded"
  | "TTriggerOnStatusChanged"
  | "TTriggerOnPlayerWouldBeDefeated"
  | "TTriggerOnPlayerAttributeThresholdCrossed"
  | "TTriggerOnCardAttributeThresholdCrossed"
  | "TTriggerOnPlayerAttributeChanged"
  | "TTriggerOnConditionMet"
  | "TTriggerUnknown";

export type StructuredActionType =
  | "TActionPlayerDamage"
  | "TActionPlayerShieldApply"
  | "TActionPlayerHeal"
  | "TActionPlayerRegenApply"
  | "TActionPlayerBurnApply"
  | "TActionPlayerPoisonApply"
  | "TActionCardHaste"
  | "TActionCardSlow"
  | "TActionCardFreeze"
  | "TActionCardCharge"
  | "TActionCardModifyAttribute"
  | "TActionPlayerModifyAttribute"
  | "TActionGameSpawnCards"
  | "TActionCardAddTagsList"
  | "TActionCardReload"
  | "TActionCardRepair"
  | "TActionCardTransform"
  | "TActionCardEnchant"
  | "TActionCardUpgrade"
  | "TActionCardForceUse"
  | "TActionCardDestroy"
  | "TActionCardRedirect"
  | "TActionCardBeginSandstorm"
  | "TActionCardCleanse"
  | "TActionBoardSlotSetTerrain"
  | "TActionEffectModify"
  | "TActionStatusDurationModify"
  | "TActionStatusModify"
  | "TActionPlayerModifyState"
  | "TActionVariableModify"
  | "TActionPlayerPreventDamage"
  | "TActionUnknown";

export type StructuredAttributeType =
  | "Ammo"
  | "AmmoMax"
  | "Burn"
  | "BurnApplyAmount"
  | "BuyPrice"
  | "ChargeAmount"
  | "CooldownMax"
  | "CritChance"
  | "CritDamage"
  | "DamageAmount"
  | "FreezeAmount"
  | "Gold"
  | "HasteAmount"
  | "HealAmount"
  | "Health"
  | "HealthMax"
  | "Income"
  | "Experience"
  | "Lifesteal"
  | "Multicast"
  | "Poison"
  | "PoisonApplyAmount"
  | "Prestige"
  | "Rage"
  | "RageRequirement"
  | "RegenApplyAmount"
  | "ReloadAmount"
  | "RerollCost"
  | "SellPrice"
  | "Shield"
  | "ShieldApplyAmount"
  | "SlowAmount"
  | "Value"
  | "EffectMagnitude"
  | "EffectDuration"
  | "EffectValue"
  | "EffectTrigger"
  | "Unknown";

export type StructuredTagExpr =
  | {
      $type: "HasTag";
      Tag: string;
    }
  | {
      $type: "AnyOf" | "AllOf" | "NoneOf";
      Tags: string[];
    }
  | {
      $type: "Not";
      Expr: StructuredTagExpr;
    }
  | {
      $type: "And" | "Or";
      Exprs: StructuredTagExpr[];
    };

export type StructuredTriggerLimit = {
  Mode: "First" | "MaxTimes" | "Nth" | "EveryNth";
  Count: number;
  Reset: "Fight" | "Encounter" | "Day" | "Run" | "Never";
  Scope: "SourceEffectInstance" | "SourceCardInstance" | "Player" | "TriggerSubject";
  Key?: string;
};

export type StructuredEffectPredicate =
  | {
      $type: "TEffectPredicateFamily";
      Family: string;
    }
  | {
      $type: "TEffectPredicateAttribute";
      AttributeType: StructuredAttributeType;
    }
  | {
      $type: "TEffectPredicateAnd" | "TEffectPredicateOr";
      Predicates: StructuredEffectPredicate[];
    }
  | {
      $type: "TEffectPredicateNot";
      Predicate: StructuredEffectPredicate;
    };

export type StructuredPlayerStateType = "FactionMembership" | "PlayerTag" | "PlayerFlag" | "PlayerStatus";

export type SlotTerrainType = "Stove" | "Cooler" | (string & {});

export type StructuredEffectAnchor =
  | "PreviousSemanticAction"
  | "PreviousEffectInGroup"
  | "SourceEffectGroup"
  | "SourceEffectInstance";

export type StructuredVariableDecl = {
  id: string;
  name: string;
  valueType: "number" | "boolean" | "set";
  defaultValue?: StructuredValue;
  attributeHint?: StructuredAttributeType;
  lifetime: "Combat" | "Day" | "Run" | "Permanent";
};

export type StructuredEffectFacets = {
  actionFamilies: string[];
  targetKinds: string[];
  cardTags: string[];
  playerTags: string[];
  statuses: string[];
  terrains: string[];
  attributes: StructuredAttributeType[];
  hasTriggerLimit: boolean;
  hasDynamicValue: boolean;
  isEffectModifier: boolean;
};

export type StructuredCardSpec = {
  RawDescription: string;
  CardKind?: "Item" | "Skill" | "Card";
  Count?: StructuredValue;
  Selector?: StructuredTarget;
  SourcePool?: "SelfHero" | "AnyHero" | "AnotherHero" | "AnyPlayer" | "Unknown";
  CopyOf?: StructuredTarget;
  NameHints?: string[];
  SelectionMode?: "OneMatching" | "AllListed" | "Copy" | "Unspecified";
  Duration?: "Fight" | "Run" | "Permanent" | "Unspecified";
};

export type StructuredTagMutation = {
  Mode: "CopyFrom" | "AddRandom";
  TagDomain: "ItemType" | "CardTag";
  Source?: StructuredTarget;
  Count?: StructuredValue;
  RawDescription?: string;
};

export type StructuredActionGraphLink = {
  GraphId: string;
  RootNode: "Sequence" | "Parallel" | "Conditional";
  NodePath: number[];
  NodeIndex: number;
  NodeCount: number;
  SourceClauseId?: string;
};

export type StructuredTarget =
  | {
      $type: "TTargetCardSelf";
      Conditions?: StructuredCondition[] | null;
    }
  | {
      $type: "TTargetCardTriggerSource";
      Conditions?: StructuredCondition[] | null;
    }
  | {
      $type: "TTargetCardPositional";
      TargetMode: "Neighbor" | "LeftCard" | "RightCard" | "LeftMostCard" | "RightMostCard" | "AllLeftCards" | "AllRightCards";
      Anchor?: StructuredTarget;
      IncludeOrigin?: boolean;
      Conditions?: StructuredCondition[] | null;
    }
  | {
      $type: "TTargetCardSection";
      TargetSection: "SelfHand" | "SelfHandAndStash" | "SelfBoard" | "SelfStash" | "OpponentBoard" | "AllHands" | "AllBoards";
      ExcludeSelf?: boolean;
      Conditions?: StructuredCondition[] | null;
    }
  | {
      $type: "TTargetCardRandom";
      TargetSection: "SelfHand" | "SelfHandAndStash" | "SelfBoard" | "SelfStash" | "OpponentBoard" | "AllHands" | "AllBoards";
      ExcludeSelf?: boolean;
      Conditions?: StructuredCondition[] | null;
    }
  | {
      $type: "TTargetCardXMost";
      TargetMode: "LeftMostCard" | "RightMostCard" | "LowestValueCard" | "HighestValueCard" | "LowestCooldownCard" | "HighestCooldownCard";
      TargetSection?: "SelfHand" | "SelfHandAndStash" | "SelfBoard" | "SelfStash" | "OpponentBoard" | "AllHands" | "AllBoards";
      Conditions?: StructuredCondition[] | null;
    }
  | {
      $type: "TTargetCardXMost";
      TargetMode: "LowestAttributeCard" | "HighestAttributeCard";
      AttributeType: StructuredAttributeType;
      TargetSection?: "SelfHand" | "SelfHandAndStash" | "SelfBoard" | "SelfStash" | "OpponentBoard" | "AllHands" | "AllBoards";
      Conditions?: StructuredCondition[] | null;
    }
  | {
      $type: "TTargetPlayerRelative";
      TargetMode: "Self" | "Opponent" | "Both";
      Conditions?: StructuredCondition[] | null;
    }
  | {
      $type: "TTargetPlayerTriggerSource";
      Conditions?: StructuredCondition[] | null;
    }
  | {
      $type: "TTargetBoardSlotRandom";
      TargetSection: "SelfBoard" | "OpponentBoard" | "AllBoards";
      Conditions?: StructuredCondition[] | null;
    }
  | {
      $type: "TTargetBoardSlotSection";
      TargetSection: "SelfBoard" | "OpponentBoard" | "AllBoards";
      Conditions?: StructuredCondition[] | null;
    }
  | {
      $type: "TTargetBoardSlotPositional";
      TargetMode: "Neighbor" | "LeftSlot" | "RightSlot" | "LeftMostSlot" | "RightMostSlot";
      Conditions?: StructuredCondition[] | null;
    }
  | {
      $type: "TTargetEffect";
      Entity: "EffectTemplate" | "EffectInstance";
      Owner?: "Self" | "Opponent" | "Any";
      Recipient?: StructuredTarget;
      Predicate?: StructuredEffectPredicate;
      Anchor?: StructuredEffectAnchor;
      AnchorId?: string;
    }
  | {
      $type: "TTargetStatusApplication";
      Target: StructuredTarget;
      Status: string;
    }
  | {
      $type: "TTargetUnknown";
      Conditions?: StructuredCondition[] | null;
    };

export type StructuredValue =
  | {
      $type: "TFixedValue";
      Value: number;
    }
  | {
      $type: "TRangeValue";
      MinValue?: number;
      MaxValue?: number;
    }
  | {
      $type: "TReferenceValueCardAttribute";
      Target: StructuredTarget;
      AttributeType: StructuredAttributeType;
      DefaultValue?: number;
      Modifier?: StructuredValueModifier;
    }
  | {
      $type: "TReferenceValueCardAttributeAggregate";
      Target: StructuredTarget;
      AttributeType: StructuredAttributeType;
      Aggregate?: "Sum" | "Min" | "Max" | "Average";
      DefaultValue?: number;
      Modifier?: StructuredValueModifier;
    }
  | {
      $type: "TReferenceValueCardCount";
      Target: StructuredTarget;
      Modifier?: StructuredValueModifier;
    }
  | {
      $type: "TReferenceValueCardTagCount";
      Target: StructuredTarget;
      Modifier?: StructuredValueModifier;
    }
  | {
      $type: "TReferenceValuePlayerAttribute";
      Target: StructuredTarget;
      AttributeType: StructuredAttributeType;
      DefaultValue?: number;
      Modifier?: StructuredValueModifier;
    }
  | {
      $type: "TReferenceValuePlayerAttributeChange";
      AttributeType?: StructuredAttributeType;
      ChangeDirection?: "Gained" | "Lost" | "Changed";
      Scope?: "Fight" | "Day" | "Run" | "Encounter";
      Modifier?: StructuredValueModifier;
    }
  | {
      $type: "TFractionValue";
      Numerator: number;
      Denominator: number;
    }
  | {
      $type: "TExpressionValue";
      Operator: "Add" | "Subtract" | "Multiply" | "Divide" | "Min" | "Max";
      Values: StructuredValue[];
      Rounding?: "Unspecified" | "Floor" | "Ceil" | "Nearest";
    }
  | {
      $type: "TVariableValue";
      VariableId: string;
    }
  | {
      $type: "TIdentifierValue";
      Value: string;
    }
  | {
      $type: "TUnknownValue";
      Text?: string;
    };

export type StructuredValueModifier = {
  ModifyMode: "Add" | "Subtract" | "Multiply";
  Value: StructuredValue;
};

export type StructuredCondition =
  | {
      $type: "TCardConditionalTag";
      Tags: string[];
      IsNot?: boolean;
      Role?: "has_tag" | "target_has_tag";
    }
  | {
      $type: "TCardConditionalSize";
      Sizes: ItemSize[];
      IsNot?: boolean;
    }
  | {
      $type: "TCardConditionalRarity";
      Rarity: "Bronze" | "Silver" | "Gold" | "Diamond" | "Legendary";
      ComparisonOperator?: "Equal" | "GreaterThanOrEqual" | "LessThanOrEqual";
      IsNot?: boolean;
    }
  | {
      $type: "TCardConditionalCount";
      ComparisonOperator: "Equal" | "GreaterThanOrEqual" | "LessThanOrEqual";
      Amount: number;
      Tags?: string[];
    }
  | {
      $type: "TCardConditionalAttribute";
      AttributeType: StructuredAttributeType;
      ComparisonOperator?: "Equal" | "GreaterThan" | "GreaterThanOrEqual" | "LessThan" | "LessThanOrEqual";
      Value?: StructuredValue;
    }
  | {
      $type: "TCardConditionalTierComparison";
      ComparisonOperator: "Equal" | "GreaterThan" | "GreaterThanOrEqual" | "LessThan" | "LessThanOrEqual";
      Reference: StructuredTarget;
    }
  | {
      $type: "TCardConditionalTagExpr";
      Expr: StructuredTagExpr;
    }
  | {
      $type: "TCardConditionalStatus";
      Status: string;
      IsNot?: boolean;
    }
  | {
      $type: "TPlayerConditionalState";
      Target?: StructuredTarget;
      StateType: StructuredPlayerStateType;
      StateValue: StructuredValue;
      IsNot?: boolean;
    }
  | {
      $type: "TVariableConditionalValue";
      VariableId: string;
      ComparisonOperator: "Equal" | "GreaterThan" | "GreaterThanOrEqual" | "LessThan" | "LessThanOrEqual";
      Value: StructuredValue;
    }
  | {
      $type: "TConditionUnknown";
      Text?: string;
    };

export type StructuredTrigger = {
  $type: StructuredTriggerType;
  Subject?: StructuredTarget;
  Target?: StructuredTarget;
  Conditions?: StructuredCondition[] | null;
  SourceEvent: EffectEvent;
  Tag?: string;
  Status?: string;
  EffectPredicate?: StructuredEffectPredicate;
  Limit?: StructuredTriggerLimit;
  AttributeType?: StructuredAttributeType;
  Threshold?: StructuredValue;
  Crossing?: "FromAtOrAboveToBelow" | "FromAtOrBelowToAbove" | "Above" | "Below";
  ChangeDirection?: "Gained" | "Lost" | "Changed";
  CombatOnly?: boolean;
};

export type StructuredAction = {
  $type: StructuredActionType;
  AttributeType?: StructuredAttributeType;
  Operation?: "Add" | "Subtract" | "Multiply" | "Set" | "Toggle";
  Value?: StructuredValue;
  Target?: StructuredTarget;
  Tags?: string[];
  Terrain?: SlotTerrainType;
  OccupantStatusHint?: string;
  EffectPredicate?: StructuredEffectPredicate;
  ReplacementTrigger?: StructuredTrigger;
  OriginalTarget?: StructuredTarget;
  ReplacementTiming?: "BeforeOriginalResolution" | "InsteadOfOriginalResolution" | "AfterOriginalResolution";
  GeneratedCards?: StructuredCardSpec[];
  TransformInto?: StructuredCardSpec;
  TagMutation?: StructuredTagMutation;
  EnchantmentSelection?: "Specified" | "Unspecified";
  HealthSetMode?: "HealToThreshold";
  Status?: string;
  StateType?: StructuredPlayerStateType;
  StateValue?: StructuredValue;
  VariableId?: string;
  Rounding?: "Unspecified" | "Floor" | "Ceil" | "Nearest";
  ApplicationTiming?: "Immediate" | "OnResolve" | "Continuous";
  SourceAction: EffectActionType;
};

export type StructuredEffect = {
  id: string;
  kind: StructuredEffectKind;
  activeIn: StructuredActiveIn;
  trigger?: StructuredTrigger;
  action: StructuredAction;
  semanticSourceIds?: string[];
  projectionStatus?: "exact" | "partial" | "lossy" | "unsupported";
  projectionWarnings?: string[];
  prerequisites?: StructuredCondition[] | null;
  groupId?: string;
  actionGraph?: StructuredActionGraphLink;
  variableDeclarations?: StructuredVariableDecl[];
  rawText: string;
};

export type ItemSize = 1 | 2 | 3;

export type HeroDef = {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
};

export type TagDef = {
  id: string;
  name: string;
  slug: string;
};

export type SourceIndexEntry = {
  id: string;
  name: string;
  nameEn: string;
  category: string | null;
  categoryType: string | null;
  days: number[];
  availabilityLabels: string[];
  cardCount: number;
};

export type ItemDef = {
  id: string;
  slug: string;
  name: string;
  hero: string | null;
  size: ItemSize;
  tags: string[];
  cooldownMs: number | null;
  ammoMax: number | null;
  value: number | null;
  rarity?: string | null;
  sourceIds?: string[];
  imageUrl?: string | null;
  text: string;
  structuredEffects: StructuredEffect[];
  semanticEffects?: SemanticEffectDocument;
  raw: unknown;
};

export type SkillDef = {
  id: string;
  slug: string;
  name: string;
  hero: string | null;
  tags: string[];
  rarity?: string | null;
  imageUrl?: string | null;
  text: string;
  structuredEffects: StructuredEffect[];
  semanticEffects?: SemanticEffectDocument;
  raw: unknown;
};

export type EnchantmentDef = {
  id: string;
  slug: string;
  name: string;
  text: string;
  structuredEffects: StructuredEffect[];
  semanticEffects?: SemanticEffectDocument;
  raw: unknown;
};

export type EffectCorpusClause = {
  id: string;
  kind: SemanticEffectDocument["clauses"][number]["kind"];
  sourceText?: string;
  normalizedText?: string;
  warningCodes: string[];
  warnings: Array<Pick<SemanticWarning, "code" | "severity" | "message"> & { evidence?: SemanticWarning["evidence"] }>;
  unsupportedReasons: string[];
};

export type EffectCorpusStructuredEffect = Pick<
  StructuredEffect,
  | "id"
  | "kind"
  | "activeIn"
  | "trigger"
  | "action"
  | "prerequisites"
  | "semanticSourceIds"
  | "projectionStatus"
  | "projectionWarnings"
  | "groupId"
  | "actionGraph"
  | "variableDeclarations"
  | "rawText"
>;

export type EffectCorpusEntry = {
  schemaVersion: string;
  parserVersion: string;
  semanticSchemaVersion: string;
  corpusId: string;
  entityType: "item" | "skill" | "enchantment";
  entityId: string;
  slug: string;
  sourceCardIds: string[];
  sourceCardNames: string[];
  nameZh: string;
  nameEn: string;
  hero?: string | null;
  rarity?: string | null;
  size?: number;
  tags?: string[];
  rawTextHash: string;
  originalFullTextEn: string;
  normalizedFullTextEn: string;
  rawTextEn: string;
  rawTextZh: string;
  tooltipTextsEn: string[];
  tooltipTextsZh: string[];
  currentParse: {
    structuredEffectCount: number;
    structuredUnknownCount: number;
    structuredUnknownTokenCount: number;
    semanticClauseCount: number;
    semanticUnknownActionCount: number;
    semanticWarningCodes: string[];
    semanticWarningMessages: string[];
    projectionStatus: "exact" | "partial" | "lossy" | "unsupported";
    projectionUnsupportedCount: number;
    projectionWarnings: string[];
    projectionReasons: string[];
    unsupportedReasons: string[];
    legacyStructuredUnknownReasons: string[];
    semanticProjectionReasons: string[];
  };
  clauses: EffectCorpusClause[];
  structuredEffects: EffectCorpusStructuredEffect[];
  semanticProjectedStructuredEffects: EffectCorpusStructuredEffect[];
};

export type PlacedItem = {
  itemId: string;
  itemName: string;
  size: ItemSize;
  startSlot: number;
  endSlot: number;
};

export type BoardLayout = {
  slotLimit: 10;
  placements: PlacedItem[];
  usedSlots: number;
  emptySlots: number[];
  layoutScore: number;
  reasons: string[];
  warnings: string[];
};

export type MechanicKey =
  | "damage"
  | "weapon_damage"
  | "crit"
  | "burn"
  | "poison"
  | "shield"
  | "shield_scaling"
  | "heal"
  | "freeze"
  | "slow"
  | "haste"
  | "charge"
  | "reduce_cooldown"
  | "multicast"
  | "scaling"
  | "economy"
  | "control"
  | "tempo"
  | "sustain";

export type BuildMechanicProfile = {
  primary: MechanicKey;
  secondary: MechanicKey[];
  scores: Record<MechanicKey, number>;
  roles: {
    winCondition: MechanicKey[];
    enablers: MechanicKey[];
    control: MechanicKey[];
    sustain: MechanicKey[];
    scaling: MechanicKey[];
  };
  labels: string[];
  explanation: string[];
};

export type GeneratedBuild = {
  id: string;
  hero: string;
  itemIds: string[];
  itemNames: string[];
  skillIds: string[];
  skillNames: string[];
  usedSlots: number;
  layout: BoardLayout;
  layoutScore: number;
  powerScore: number;
  matchScore?: number;
  mechanicMatchScore?: number;
  finalScore?: number;
  archetype: string;
  mechanicProfile: BuildMechanicProfile;
  reasons: string[];
  warnings: string[];
  imageUrls?: string[];
};

export type ItemIndexEntry = Pick<
  ItemDef,
  | "id"
  | "slug"
  | "name"
  | "hero"
  | "size"
  | "tags"
  | "cooldownMs"
  | "ammoMax"
  | "value"
  | "rarity"
  | "sourceIds"
  | "imageUrl"
  | "text"
  | "structuredEffects"
  | "semanticEffects"
>;

export type SkillIndexEntry = Pick<
  SkillDef,
  "id" | "slug" | "name" | "hero" | "tags" | "rarity" | "imageUrl" | "text" | "structuredEffects" | "semanticEffects"
>;

export type BuildGeneratorMeta = {
  generatedAt: string;
  itemCount: number;
  skillCount: number;
  heroCount: number;
  buildCount: number;
  warnings: string[];
};

export type RawDataBundle = {
  dataRoot: string;
  cards: unknown;
  items: unknown;
  skills: unknown;
  heroes: unknown;
  enchantments: unknown;
  sources: unknown;
  tags: unknown;
  imageManifest: unknown;
  manifests: Record<string, unknown>;
};

export type NormalizedData = {
  heroes: HeroDef[];
  tags: TagDef[];
  items: ItemDef[];
  skills: SkillDef[];
  enchantments: EnchantmentDef[];
  warnings: string[];
};

export type SynergyScore = {
  score: number;
  reasons: string[];
};

export type BuildGenerationParams = {
  boardSlotLimit: number;
  maxItems: number;
  maxSkills: number;
  beamWidth: number;
  topBuildsPerHero: number;
};

export type SearchMode = "exact" | "similar" | "mechanic";

export type BuildSearchInput = {
  hero?: string;
  itemIds?: string[];
  skillIds?: string[];
  coreOutputs?: MechanicKey[];
  tempoMechanics?: MechanicKey[];
  controlMechanics?: MechanicKey[];
  sustainMechanics?: MechanicKey[];
  mode?: SearchMode;
  limit?: number;
};

export type RecommendedItem = {
  itemId: string;
  itemName: string;
  count: number;
  recommendationScore: number;
  reasons?: string[];
};
