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

export type ItemSize = 1 | 2 | 3;

export type EffectDef = {
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
  rawText?: string;
};

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
  effects: EffectDef[];
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
  effects: EffectDef[];
  raw: unknown;
};

export type EnchantmentDef = {
  id: string;
  slug: string;
  name: string;
  text: string;
  effects: EffectDef[];
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
  | "effects"
>;

export type SkillIndexEntry = Pick<
  SkillDef,
  "id" | "slug" | "name" | "hero" | "tags" | "rarity" | "imageUrl" | "text" | "effects"
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
