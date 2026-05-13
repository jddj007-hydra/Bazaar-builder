import type { SemanticEffectDocument } from "./semanticEffects";

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
  | "destroyed"
  | "merchant"
  | "crit"
  | "enrage"
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
  | "allied_items"
  | "enemy_items"
  | "allied_skills"
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
  | "TTriggerOnCardDestroyed"
  | "TTriggerOnMerchantVisited"
  | "TTriggerOnCardCritted"
  | "TTriggerOnEnrage"
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
  | "DamageAmount"
  | "FreezeAmount"
  | "Gold"
  | "HasteAmount"
  | "HealAmount"
  | "Health"
  | "HealthMax"
  | "Income"
  | "Lifesteal"
  | "Multicast"
  | "Poison"
  | "PoisonApplyAmount"
  | "Prestige"
  | "Rage"
  | "RegenApplyAmount"
  | "ReloadAmount"
  | "SellPrice"
  | "Shield"
  | "ShieldApplyAmount"
  | "SlowAmount"
  | "Value"
  | "Unknown";

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
      IncludeOrigin?: boolean;
      Conditions?: StructuredCondition[] | null;
    }
  | {
      $type: "TTargetCardSection";
      TargetSection: "SelfHand" | "SelfHandAndStash" | "SelfBoard" | "SelfStash" | "OpponentBoard" | "AllHands";
      ExcludeSelf?: boolean;
      Conditions?: StructuredCondition[] | null;
    }
  | {
      $type: "TTargetCardRandom";
      TargetSection: "SelfHand" | "SelfHandAndStash" | "SelfBoard" | "SelfStash" | "OpponentBoard" | "AllHands";
      ExcludeSelf?: boolean;
      Conditions?: StructuredCondition[] | null;
    }
  | {
      $type: "TTargetCardXMost";
      TargetMode: "LeftMostCard" | "RightMostCard";
      Conditions?: StructuredCondition[] | null;
    }
  | {
      $type: "TTargetPlayerRelative";
      TargetMode: "Self" | "Opponent" | "Both";
      Conditions?: StructuredCondition[] | null;
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
      Modifier?: StructuredValueModifier;
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
};

export type StructuredAction = {
  $type: StructuredActionType;
  AttributeType?: StructuredAttributeType;
  Operation?: "Add" | "Subtract" | "Multiply" | "Set";
  Value?: StructuredValue;
  Target?: StructuredTarget;
  Tags?: string[];
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

export type ItemDef = {
  id: string;
  slug: string;
  name: string;
  hero: string | null;
  size: ItemSize;
  tags: string[];
  cooldownMs: number | null;
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
