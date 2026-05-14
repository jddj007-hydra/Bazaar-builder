import { describe, expect, it } from "vitest";
import { normalizeSize } from "./cardRecord";
import { generateBuilds } from "./generateBuilds";
import {
  getAdjacentNeighbors,
  getLeftNeighbor,
  getRightNeighbor,
  isAdjacent,
  isLeftOf,
  isRightOf,
  isValidPlacement,
  placeItem,
  scoreLayout
} from "./layout";
import { normalizeHeroes } from "./normalizeHeroes";
import { normalizeItems } from "./normalizeItems";
import { normalizeSkills } from "./normalizeSkills";
import { normalizeTags } from "./normalizeTags";
import { optimizeLayoutForBuild } from "./optimizeLayout";
import { parseStructuredEffectsFromTexts } from "./parseEffects";
import { createImageResolver, resolveCardImage } from "./resolveImages";
import { scoreSemanticMechanics, semanticSearchIndex, semanticSummary } from "./semanticConsumption";
import { parseSemanticEffectDocumentFromTexts, projectSemanticDocumentToStructuredEffects } from "./semanticEffects";
import { projectionAudit, structuredUnknownTokenCount } from "./effectParserAudit";
import { EFFECT_CORPUS_SCHEMA_VERSION, EFFECT_PARSER_VERSION, SEMANTIC_IR_SCHEMA_VERSION } from "./effectParserVersions";
import { structuredEffectView, type StructuredEffectView } from "./structuredEffects";
import {
  allMechanics,
  buildMechanicProfile,
  scoreEffectMechanics,
  scoreItemMechanics,
  scoreSkillMechanics
} from "./mechanics";
import { calculateMechanicMatchScore, recommendNextItems, searchGeneratedBuilds } from "./searchGeneratedBuilds";
import { scoreEntityPair } from "./synergy";
import { slugify } from "./slug";
import type { BoardLayout, BuildMechanicProfile, GeneratedBuild, HeroDef, ItemDef, MechanicKey, SkillDef } from "./types";

const tags = normalizeTags({
  visible_tags: ["Weapon", "Tool", "Drone", "Relic", "Vehicle", "Food", "Aquatic"],
  hidden_tags: ["Shield", "Damage", "Haste", "Slow", "Freeze", "Tech", "Ammo", "Burn", "Poison", "Regen", "Charge", "PoisonReference"],
  mechanic_tags: ["Common", "Item", "Skill"],
  all_tags: [
    "Weapon",
    "Tool",
    "Drone",
    "Relic",
    "Vehicle",
    "Food",
    "Aquatic",
    "Shield",
    "Damage",
    "Haste",
    "Slow",
    "Freeze",
    "Tech",
    "Ammo",
    "Burn",
    "Poison",
    "Regen",
    "Charge",
    "PoisonReference",
    "Common",
    "Item",
    "Skill"
  ]
});

type TestItemInput = Partial<ItemDef> & Pick<ItemDef, "id" | "name"> & { effectTexts?: string[] };
type TestSkillInput = Partial<SkillDef> & Pick<SkillDef, "id" | "name"> & { effectTexts?: string[] };

function parseEffectView(text: string): StructuredEffectView {
  return structuredEffectView(parseStructuredEffectsFromTexts([text], tags)[0]);
}

function parseEffectViews(texts: string[]): StructuredEffectView[] {
  return parseStructuredEffectsFromTexts(texts, tags).map(structuredEffectView);
}

function item(partial: TestItemInput): ItemDef {
  const parsedEffects = partial.structuredEffects ?? (partial.effectTexts ? parseStructuredEffectsFromTexts(partial.effectTexts, tags) : []);
  const { effectTexts: _effectTexts, structuredEffects: _structuredEffects, ...rest } = partial;
  return {
    slug: slugify(partial.name),
    hero: null,
    size: 1,
    tags: [],
    cooldownMs: 4000,
    value: null,
    rarity: "Silver",
    imageUrl: null,
    text: "",
    structuredEffects: parsedEffects,
    raw: { Heroes: ["Common"] },
    ...rest
  };
}

function skill(partial: TestSkillInput): SkillDef {
  const parsedEffects = partial.structuredEffects ?? (partial.effectTexts ? parseStructuredEffectsFromTexts(partial.effectTexts, tags) : []);
  const { effectTexts: _effectTexts, structuredEffects: _structuredEffects, ...rest } = partial;
  return {
    slug: slugify(partial.name),
    hero: null,
    tags: [],
    rarity: "Silver",
    imageUrl: null,
    text: "",
    structuredEffects: parsedEffects,
    raw: { Heroes: ["Common"] },
    ...rest
  };
}

function layout(partial: Partial<BoardLayout> = {}): BoardLayout {
  return {
    slotLimit: 10,
    placements: [],
    usedSlots: 0,
    emptySlots: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    layoutScore: partial.layoutScore ?? 0,
    reasons: [],
    warnings: [],
    ...partial
  };
}

function profile(
  primary: MechanicKey = "damage",
  scoreOverrides: Partial<Record<MechanicKey, number>> = {}
): BuildMechanicProfile {
  const scores = Object.fromEntries(allMechanics.map((mechanic) => [mechanic, 0])) as Record<MechanicKey, number>;
  for (const [mechanic, score] of Object.entries(scoreOverrides) as Array<[MechanicKey, number]>) {
    scores[mechanic] = score;
  }
  scores[primary] = Math.max(scores[primary], 30);

  return {
    primary,
    secondary: allMechanics.filter((mechanic) => mechanic !== primary && scores[mechanic] >= 20),
    scores,
    roles: {
      winCondition: (["damage", "weapon_damage", "crit", "burn", "poison", "shield_scaling"] as MechanicKey[]).filter((mechanic) => scores[mechanic] >= 25),
      enablers: (["haste", "charge", "reduce_cooldown", "multicast"] as MechanicKey[]).filter((mechanic) => scores[mechanic] >= 20),
      control: (["freeze", "slow"] as MechanicKey[]).filter((mechanic) => scores[mechanic] >= 20),
      sustain: (["shield", "heal"] as MechanicKey[]).filter((mechanic) => scores[mechanic] >= 20),
      scaling: (["scaling", "crit", "damage", "shield_scaling", "economy"] as MechanicKey[]).filter((mechanic) => scores[mechanic] >= 20)
    },
    labels: [primary],
    explanation: []
  };
}

function generatedBuild(partial: Partial<GeneratedBuild> & Pick<GeneratedBuild, "id" | "itemIds" | "itemNames">): GeneratedBuild {
  const buildLayout = partial.layout ?? layout({ usedSlots: partial.usedSlots ?? 0, layoutScore: partial.layoutScore ?? 0 });
  return {
    hero: "vanessa",
    skillIds: [],
    skillNames: [],
    usedSlots: buildLayout.usedSlots,
    layout: buildLayout,
    layoutScore: buildLayout.layoutScore,
    powerScore: 50,
    archetype: "Hybrid Build",
    mechanicProfile: profile(),
    reasons: [],
    warnings: [],
    ...partial
  };
}

describe("bazaar data pipeline", () => {
  it("generates stable slugs", () => {
    expect(slugify("Infused Arm Wraps")).toBe("infused-arm-wraps");
    expect(slugify("  Give it a Whack!  ")).toBe("give-it-a-whack");
  });

  it("normalizes heroes", () => {
    const heroes = normalizeHeroes({ heroes: [{ hero: "Common" }, { hero: "Vanessa" }] });
    expect(heroes).toEqual([
      { id: "common", name: "通用", slug: "common", imageUrl: null },
      { id: "vanessa", name: "瓦妮莎", slug: "vanessa", imageUrl: null }
    ]);
  });

  it("normalizes tags from string bundles", () => {
    expect(tags.map((tag) => tag.slug)).toContain("weapon");
    expect(tags.map((tag) => tag.slug)).toContain("poisonreference");
  });

  it("normalizes item sizes from common raw formats", () => {
    expect(normalizeSize("Small")).toBe(1);
    expect(normalizeSize("Medium")).toBe(2);
    expect(normalizeSize("Large")).toBe(3);
    expect(normalizeSize("small")).toBe(1);
    expect(normalizeSize("medium")).toBe(2);
    expect(normalizeSize("large")).toBe(3);
    expect(normalizeSize("S")).toBe(1);
    expect(normalizeSize("M")).toBe(2);
    expect(normalizeSize("L")).toBe(3);
    expect(normalizeSize(1)).toBe(1);
    expect(normalizeSize(2)).toBe(2);
    expect(normalizeSize(3)).toBe(3);
    expect(normalizeSize(undefined)).toBe(1);
  });

  it("normalizes items from BazaarDB-style records", () => {
    const resolver = createImageResolver({
      imageManifest: { images: [{ card_id: "item-1", image_url: "/x.webp" }] },
      manifests: {}
    });
    const items = normalizeItems(
      {
        items: [
          {
            Id: "item-1",
            Type: "Item",
            Title: { Text: "Shield Wand" },
            Size: "Small",
            Heroes: ["Vanessa"],
            BaseTier: "Gold",
            BaseAttributes: { CooldownMax: 5000 },
            DisplayTags: ["Weapon"],
            HiddenTags: ["Shield"],
            Tooltips: [{ Content: { Text: "Gain {ability.0} Shield" } }],
            TooltipReplacements: { "{ability.0}": { Gold: 50 } },
            TooltipReplacementKeywords: { "{ability.0}": "Shield" }
          }
        ]
      },
      { cards: [] },
      { sources: [] },
      resolver,
      tags
    );

    expect(items[0]).toMatchObject({
      id: "item-1",
      name: "Shield Wand",
      hero: "vanessa",
      size: 1,
      cooldownMs: 5000,
      imageUrl: "/x.webp"
    });
    expect(structuredEffectView(items[0].structuredEffects[0]).action.type).toBe("shield");
    expect(items[0].structuredEffects[0]).toMatchObject({
      kind: "ability",
      trigger: { $type: "TTriggerOnCardFired" },
      action: {
        $type: "TActionPlayerShieldApply",
        AttributeType: "ShieldApplyAmount",
        Value: { $type: "TFixedValue", Value: 50 }
      }
    });
    expect(items[0].semanticEffects).toMatchObject({
      schemaVersion: "semantic-ir/v1",
      sourceCardId: "item-1",
      rawText: "Gain 50 Shield Shield",
      extractedTags: { mechanics: ["shield"] }
    });
  });

  it("normalizes skills from BazaarDB-style records", () => {
    const skills = normalizeSkills(
      {
        skills: [
          {
            Id: "skill-1",
            Type: "Skill",
            Title: { Text: "Quick Tools" },
            Heroes: ["Common"],
            DisplayTags: ["Tool"],
            Tooltips: [{ Content: { Text: "When you use a Tool item, charge an adjacent item 1 second" } }]
          }
        ]
      },
      { cards: [] },
      createImageResolver({ imageManifest: {}, manifests: {} }),
      tags
    );

    expect(skills[0].hero).toBeNull();
    expect(skills[0].tags).toContain("tool");
    expect(structuredEffectView(skills[0].structuredEffects[0]).trigger).toMatchObject({ event: "tag_item_used", tag: "tool" });
    expect(skills[0].structuredEffects[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnItemUsed",
        Tag: "tool",
        Subject: { $type: "TTargetCardSection", TargetSection: "SelfHand" }
      },
      action: {
        $type: "TActionCardCharge",
        AttributeType: "ChargeAmount",
        Target: { $type: "TTargetCardPositional", TargetMode: "Neighbor" },
        Value: { $type: "TFixedValue", Value: 1 }
      }
    });
    expect(skills[0].semanticEffects).toMatchObject({
      schemaVersion: "semantic-ir/v1",
      sourceCardId: "skill-1",
      extractedTags: { mechanics: ["charge"], itemTypes: ["tool"] }
    });
  });

  it("falls back to null when image lookup is missing", () => {
    const resolver = createImageResolver({ imageManifest: { images: [] }, manifests: {} });
    expect(resolveCardImage({ Id: "missing", Title: { Text: "Missing" } }, resolver)).toBeNull();
  });

  it("parses tooltip text conservatively", () => {
    const effect = parseEffectView("When you use a Weapon item, Haste an adjacent item for 1 second");
    expect(effect.trigger).toMatchObject({ event: "tag_item_used", tag: "weapon" });
    expect(effect.action.type).toBe("haste");
    expect(effect.target?.scope).toBe("adjacent");
  });

  it("parses tooltip text into structured trigger/action/target records", () => {
    expect(parseStructuredEffectsFromTexts(["When you use a Weapon item, Haste an adjacent item for 1 second"], tags)[0]).toMatchObject({
      id: "0",
      kind: "ability",
      activeIn: "hand_only",
      trigger: {
        $type: "TTriggerOnItemUsed",
        SourceEvent: "tag_item_used",
        Tag: "weapon",
        Subject: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          Conditions: [{ $type: "TCardConditionalTag", Tags: ["weapon"] }]
        }
      },
      action: {
        $type: "TActionCardHaste",
        SourceAction: "haste",
        AttributeType: "HasteAmount",
        Value: { $type: "TFixedValue", Value: 1 },
        Target: { $type: "TTargetCardPositional", TargetMode: "Neighbor" }
      },
      rawText: "When you use a Weapon item, Haste an adjacent item for 1 second"
    });

    expect(parseStructuredEffectsFromTexts(["Your leftmost item is a Relic"], tags)[0]).toMatchObject({
      kind: "aura",
      action: {
        $type: "TActionCardAddTagsList",
        Tags: ["relic"],
        Target: { $type: "TTargetCardXMost", TargetMode: "LeftMostCard" }
      }
    });

    expect(parseStructuredEffectsFromTexts(["When you use a Tool, gain Max Health equal to 2 times its value"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnItemUsed",
        Subject: {
          $type: "TTargetCardSection",
          Conditions: [{ $type: "TCardConditionalTag", Tags: ["tool"] }]
        }
      },
      action: {
        $type: "TActionPlayerModifyAttribute",
        AttributeType: "HealthMax",
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" },
        Value: {
          $type: "TReferenceValueCardAttribute",
          AttributeType: "Value",
          Modifier: {
            ModifyMode: "Multiply",
            Value: { $type: "TFixedValue", Value: 2 }
          }
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Burn equal to 10% of this item's Damage"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionPlayerBurnApply",
        Value: {
          $type: "TReferenceValueCardAttribute",
          Target: { $type: "TTargetCardSelf" },
          AttributeType: "DamageAmount",
          Modifier: { ModifyMode: "Multiply", Value: { $type: "TFixedValue", Value: 0.1 } }
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Deal Damage equal to 20% of an enemy's Max Health"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionPlayerDamage",
        Value: {
          $type: "TReferenceValuePlayerAttribute",
          AttributeType: "HealthMax",
          Target: { $type: "TTargetPlayerRelative", TargetMode: "Opponent" },
          Modifier: { ModifyMode: "Multiply", Value: { $type: "TFixedValue", Value: 0.2 } }
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["The first time you would be defeated each fight, Heal for 10% of your Max Health"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionPlayerHeal",
        SourceAction: "heal",
        Value: {
          $type: "TReferenceValuePlayerAttribute",
          AttributeType: "HealthMax",
          Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" },
          Modifier: { ModifyMode: "Multiply", Value: { $type: "TFixedValue", Value: 0.1 } }
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["When you stop being Enraged, Heal for 15% of your Max Health"], tags)[0]).toMatchObject({
      trigger: { $type: "TTriggerOnStatusEnded", SourceEvent: "status_ended", Status: "enraged" },
      action: {
        $type: "TActionPlayerHeal",
        Value: {
          $type: "TReferenceValuePlayerAttribute",
          AttributeType: "HealthMax",
          Modifier: { ModifyMode: "Multiply", Value: { $type: "TFixedValue", Value: 0.15 } }
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["The first time you fall below half Health each fight, Heal 10% of your Max Health for each of your Flying items"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionPlayerHeal",
        Value: {
          $type: "TExpressionValue",
          Operator: "Multiply",
          Values: [
            { $type: "TFixedValue", Value: 0.1 },
            { $type: "TReferenceValuePlayerAttribute", AttributeType: "HealthMax" },
            {
              $type: "TReferenceValueCardCount",
              Target: {
                $type: "TTargetCardSection",
                TargetSection: "SelfHand",
                Conditions: [{ $type: "TCardConditionalStatus", Status: "flying" }]
              }
            }
          ]
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Burn equal to half this item's value"], tags)[0]).toMatchObject({
      action: {
        Value: {
          $type: "TReferenceValueCardAttribute",
          Target: { $type: "TTargetCardSelf" },
          AttributeType: "Value",
          Modifier: { ModifyMode: "Multiply", Value: { $type: "TFixedValue", Value: 0.5 } }
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Shield equal to your current Health"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionPlayerShieldApply",
        Value: {
          $type: "TReferenceValuePlayerAttribute",
          AttributeType: "Health",
          Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" }
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["When you use an item, it gains Shield equal to that item's value"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnItemUsed",
        Subject: { $type: "TTargetCardSection", TargetSection: "SelfHand" }
      },
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "Shield",
        Target: { $type: "TTargetCardTriggerSource" },
        Value: {
          $type: "TReferenceValueCardAttribute",
          Target: { $type: "TTargetCardTriggerSource" },
          AttributeType: "Value"
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Your items gain +Heal equal to this item's value"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "HealAmount",
        Target: { $type: "TTargetCardSection", TargetSection: "SelfHand" },
        Value: {
          $type: "TReferenceValueCardAttribute",
          Target: { $type: "TTargetCardSelf" },
          AttributeType: "Value"
        }
      }
    });
    expect(parseStructuredEffectsFromTexts(["Your items gain +Heal equal to this item's value"], ["value", "heal"])[0].action.Target).not.toMatchObject({
      Conditions: [{ $type: "TCardConditionalTag", Tags: ["value"] }]
    });

    expect(parseStructuredEffectsFromTexts(["Your items have +Crit Chance equal to this item's Value"], ["value", "crit"])[0]).toMatchObject({
      action: {
        AttributeType: "CritChance",
        Target: { $type: "TTargetCardSection", TargetSection: "SelfHand" },
        Value: { $type: "TReferenceValueCardAttribute", AttributeType: "Value", Target: { $type: "TTargetCardSelf" } }
      }
    });
    expect(parseStructuredEffectsFromTexts(["Your items have +Crit Chance equal to this item's Value"], ["value", "crit"])[0].action.Target).not.toMatchObject({
      Conditions: [{ $type: "TCardConditionalTag", Tags: ["value"] }]
    });

    expect(parseStructuredEffectsFromTexts(["Your other Properties have +Value equal to this item's Value during combat"], ["property", "value"])[0]).toMatchObject({
      action: {
        AttributeType: "Value",
        Target: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          ExcludeSelf: true,
          Conditions: [{ $type: "TCardConditionalTag", Tags: ["property"] }]
        },
        Value: { $type: "TReferenceValueCardAttribute", AttributeType: "Value", Target: { $type: "TTargetCardSelf" } }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Your lowest value item has +1 Multicast"], ["value", "multicast"])[0]).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        AttributeType: "Multicast",
        Target: { $type: "TTargetCardXMost", TargetMode: "LowestValueCard" },
        Value: { $type: "TFixedValue", Value: 1 }
      }
    });

    expect(parseStructuredEffectsFromTexts(["When this item's value reaches 10 out of combat, upgrade it"], ["value"])[0]).toMatchObject({
      kind: "ability",
      activeIn: "hand_only",
      trigger: {
        $type: "TTriggerOnCardAttributeThresholdCrossed",
        SourceEvent: "card_attribute_threshold",
        Subject: { $type: "TTargetCardSelf" },
        AttributeType: "Value",
        Threshold: { $type: "TFixedValue", Value: 10 },
        Crossing: "FromAtOrBelowToAbove"
      },
      action: { $type: "TActionCardUpgrade", Target: { $type: "TTargetCardSelf" } },
      projectionStatus: "partial"
    });

    expect(parseStructuredEffectsFromTexts(["At the start of each hour, set this item's value to a number between 0 and 5"], ["value"])[0]).toMatchObject({
      trigger: { $type: "TTriggerOnDayStarted", SourceEvent: "day_started" },
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "increase_value",
        AttributeType: "Value",
        Operation: "Set",
        Value: { $type: "TRangeValue", MinValue: 0, MaxValue: 5 },
        Target: { $type: "TTargetCardSelf" }
      },
      projectionStatus: "exact"
    });

    expect(parseStructuredEffectsFromTexts(["The first time you fall below half Health each fight, Shield equal to 2 times the Burn on your enemy"], tags)[0]).toMatchObject({
      trigger: { $type: "TTriggerOnPlayerAttributeThresholdCrossed" },
      action: {
        Value: {
          $type: "TReferenceValuePlayerAttribute",
          AttributeType: "Burn",
          Target: { $type: "TTargetPlayerRelative", TargetMode: "Opponent" },
          Modifier: { ModifyMode: "Multiply", Value: { $type: "TFixedValue", Value: 2 } }
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Burn equal to the Rage you have gained this fight"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionPlayerBurnApply",
        SourceAction: "burn",
        Value: { $type: "TReferenceValuePlayerAttributeChange", AttributeType: "Rage" },
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Opponent" }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Deal damage equal to double the Rage you have gained this fight"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionPlayerDamage",
        SourceAction: "damage",
        Value: {
          $type: "TReferenceValuePlayerAttributeChange",
          AttributeType: "Rage",
          Modifier: { ModifyMode: "Multiply", Value: { $type: "TFixedValue", Value: 2 } }
        },
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Opponent" }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Heal equal to 1 times the Rage you have gained this fight"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionPlayerHeal",
        SourceAction: "heal",
        Value: {
          $type: "TReferenceValuePlayerAttributeChange",
          AttributeType: "Rage",
          Modifier: { ModifyMode: "Multiply", Value: { $type: "TFixedValue", Value: 1 } }
        },
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Your items have +Crit Chance equal to the Rage you've gained this fight"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        AttributeType: "CritChance",
        Value: { $type: "TReferenceValuePlayerAttributeChange", AttributeType: "Rage" },
        Target: { $type: "TTargetCardSection", TargetSection: "SelfHand" }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Your rightmost weapon has +Damage equal to your Rage"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        AttributeType: "DamageAmount",
        Target: {
          $type: "TTargetCardXMost",
          TargetMode: "RightMostCard",
          Conditions: [{ $type: "TCardConditionalTag", Tags: ["weapon"] }]
        },
        Value: {
          $type: "TReferenceValuePlayerAttribute",
          AttributeType: "Rage",
          Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" }
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Your slowest Weapon has +Damage equal to its Crit Chance"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        AttributeType: "DamageAmount",
        Target: {
          $type: "TTargetCardXMost",
          TargetMode: "HighestCooldownCard",
          Conditions: [{ $type: "TCardConditionalTag", Tags: ["weapon"] }]
        },
        Value: {
          $type: "TReferenceValueCardAttribute",
          AttributeType: "CritChance",
          Target: { $type: "TTargetCardTriggerSource" }
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Deal damage equal to twice the gold you have gained this run"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionPlayerDamage",
        SourceAction: "damage",
        Value: {
          $type: "TReferenceValuePlayerAttributeChange",
          AttributeType: "Gold",
          ChangeDirection: "Gained",
          Scope: "Run",
          Modifier: { ModifyMode: "Multiply", Value: { $type: "TFixedValue", Value: 2 } }
        },
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Opponent" }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Your items gain +Damage equal to half the gold you have gained this run"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        AttributeType: "DamageAmount",
        Target: { $type: "TTargetCardSection", TargetSection: "SelfHand" },
        Value: {
          $type: "TReferenceValuePlayerAttributeChange",
          AttributeType: "Gold",
          ChangeDirection: "Gained",
          Scope: "Run",
          Modifier: { ModifyMode: "Multiply", Value: { $type: "TFixedValue", Value: 0.5 } }
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["When you gain Gold, permanently gain Max Health equal to 1 times the amount of Gold gained"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnPlayerAttributeChanged",
        SourceEvent: "player_attribute_changed",
        AttributeType: "Gold",
        ChangeDirection: "Gained"
      },
      action: {
        $type: "TActionPlayerModifyAttribute",
        AttributeType: "HealthMax",
        Value: {
          $type: "TReferenceValuePlayerAttributeChange",
          AttributeType: "Gold",
          ChangeDirection: "Gained",
          Modifier: { ModifyMode: "Multiply", Value: { $type: "TFixedValue", Value: 1 } }
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["When you lose Shield, this gains Damage equal to the Shield lost"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnPlayerAttributeChanged",
        SourceEvent: "player_attribute_changed",
        AttributeType: "Shield",
        ChangeDirection: "Lost"
      },
      action: {
        $type: "TActionCardModifyAttribute",
        AttributeType: "DamageAmount",
        Operation: "Add",
        Target: { $type: "TTargetCardSelf" },
        Value: { $type: "TReferenceValuePlayerAttributeChange", AttributeType: "Shield", ChangeDirection: "Lost" }
      }
    });

    expect(parseStructuredEffectsFromTexts(["When you Heal, Shield equal to the amount Healed"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnCardPerformedHeal",
        SourceEvent: "heal"
      },
      action: {
        $type: "TActionPlayerShieldApply",
        Value: { $type: "TReferenceValuePlayerAttributeChange", AttributeType: "HealAmount", ChangeDirection: "Gained" }
      }
    });
  });

  it("parses aggregate and event amount dynamic value references", () => {
    expect(parseStructuredEffectsFromTexts(["Deal Damage equal to the highest Shield of items you have"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionPlayerDamage",
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Opponent" },
        Value: {
          $type: "TReferenceValueCardAttributeAggregate",
          AttributeType: "Shield",
          Aggregate: "Max",
          Target: { $type: "TTargetCardSection", TargetSection: "SelfHand" }
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Shield equal to your highest Shield Food"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionPlayerShieldApply",
        Value: {
          $type: "TReferenceValueCardAttributeAggregate",
          AttributeType: "ShieldApplyAmount",
          Aggregate: "Max",
          Target: {
            $type: "TTargetCardSection",
            TargetSection: "SelfHand",
            Conditions: [{ $type: "TCardConditionalTag", Tags: ["food"] }]
          }
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["This has Multicast equal to its current ammo"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        AttributeType: "Multicast",
        Value: {
          $type: "TReferenceValueCardAttribute",
          AttributeType: "Ammo",
          Target: { $type: "TTargetCardSelf" }
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["This has +Damage equal to its Crit Chance"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        AttributeType: "DamageAmount",
        Value: {
          $type: "TReferenceValueCardAttribute",
          AttributeType: "CritChance",
          Target: { $type: "TTargetCardTriggerSource" }
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Your items gain +Burn equal to this item's Poison"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        AttributeType: "Burn",
        Value: {
          $type: "TReferenceValueCardAttribute",
          AttributeType: "Poison",
          Target: { $type: "TTargetCardSelf" }
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Deal Damage equal to double this item's Max Ammo"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionPlayerDamage",
        Value: {
          $type: "TReferenceValueCardAttribute",
          AttributeType: "AmmoMax",
          Target: { $type: "TTargetCardSelf" },
          Modifier: { ModifyMode: "Multiply", Value: { $type: "TFixedValue", Value: 2 } }
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Deal Damage equal to the Regen plus the Burn on both Players"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionPlayerDamage",
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Opponent" },
        Value: {
          $type: "TExpressionValue",
          Operator: "Add",
          Values: [
            {
              $type: "TReferenceValuePlayerAttribute",
              Target: { $type: "TTargetPlayerRelative", TargetMode: "Both" },
              AttributeType: "RegenApplyAmount"
            },
            {
              $type: "TReferenceValuePlayerAttribute",
              Target: { $type: "TTargetPlayerRelative", TargetMode: "Both" },
              AttributeType: "Burn"
            }
          ]
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["When you Poison, this gains +Damage equal to the amount Poisoned"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        AttributeType: "DamageAmount",
        Target: { $type: "TTargetCardSelf" },
        Value: {
          $type: "TReferenceValuePlayerAttributeChange",
          AttributeType: "PoisonApplyAmount",
          ChangeDirection: "Gained"
        }
      }
    });

    const incomeScaling = parseStructuredEffectsFromTexts(["Your items have +Damage equal 1 times to your income"], tags)[0];
    expect(incomeScaling).toMatchObject({
      kind: "aura",
      action: {
        $type: "TActionCardModifyAttribute",
        AttributeType: "DamageAmount",
        Target: { $type: "TTargetCardSection", TargetSection: "SelfHand" },
        Value: {
          $type: "TReferenceValuePlayerAttribute",
          Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" },
          AttributeType: "Income",
          Modifier: { ModifyMode: "Multiply", Value: { $type: "TFixedValue", Value: 1 } }
        }
      }
    });
    expect(incomeScaling.action.Target).not.toMatchObject({
      Conditions: [{ $type: "TCardConditionalTag", Tags: ["damage"] }]
    });

    expect(parseStructuredEffectsFromTexts(["When you buy this, gain +1 Income"], tags)[0]).toMatchObject({
      trigger: { $type: "TTriggerOnCardPurchased", SourceEvent: "buy" },
      action: {
        $type: "TActionPlayerModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "Income",
        Operation: "Add",
        Value: { $type: "TFixedValue", Value: 1 },
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" }
      }
    });

    expect(parseStructuredEffectsFromTexts(["The highest enemy Shield item loses 10% Shield"], tags)[0]).toMatchObject({
      kind: "aura",
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "Shield",
        Operation: "Multiply",
        Value: { $type: "TFixedValue", Value: 0.9 },
        Target: {
          $type: "TTargetCardXMost",
          TargetMode: "HighestAttributeCard",
          AttributeType: "Shield",
          TargetSection: "OpponentBoard"
        }
      },
      projectionStatus: "exact"
    });

    expect(parseStructuredEffectsFromTexts(["When you Reload this, it gains +1 Multicast"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnCardReloaded",
        SourceEvent: "reload",
        Subject: { $type: "TTargetCardSelf" }
      },
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "Multicast",
        Operation: "Add",
        Value: { $type: "TFixedValue", Value: 1 },
        Target: { $type: "TTargetCardTriggerSource" }
      }
    });

    expect(parseStructuredEffectsFromTexts(["When you Reload a Potion, Charge it +1 Charge seconds"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnCardReloaded",
        SourceEvent: "reload",
        Subject: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          Conditions: [{ $type: "TCardConditionalTag", Tags: ["potion"] }]
        }
      },
      action: {
        $type: "TActionCardCharge",
        SourceAction: "charge",
        Target: { $type: "TTargetCardTriggerSource", Conditions: [{ $type: "TCardConditionalTag", Tags: ["potion"] }] }
      }
    });

    expect(parseStructuredEffectsFromTexts(["At the end of each fight, if this has no Ammo, permanently destroy it"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnFightEnded",
        SourceEvent: "fight_end",
        Subject: {
          $type: "TTargetCardSelf",
          Conditions: [
            {
              $type: "TCardConditionalAttribute",
              AttributeType: "Ammo",
              ComparisonOperator: "Equal",
              Value: { $type: "TFixedValue", Value: 0 }
            }
          ]
        }
      },
      action: {
        $type: "TActionCardDestroy",
        SourceAction: "destroy",
        Target: { $type: "TTargetCardSelf" }
      },
      projectionStatus: "exact"
    });

    expect(parseStructuredEffectsFromTexts(["When you Transform a Potion, this gains 20 Damage"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnCardTransformed",
        SourceEvent: "transformed",
        Subject: { $type: "TTargetCardSection", TargetSection: "SelfHand", Conditions: [{ $type: "TCardConditionalTag", Tags: ["potion"] }] }
      },
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "DamageAmount",
        Operation: "Add",
        Value: { $type: "TFixedValue", Value: 20 },
        Target: { $type: "TTargetCardSelf" }
      }
    });

    expect(parseStructuredEffectsFromTexts(["When you transform a Reagent, permanently gain Regen 3 Heal"], tags)).toMatchObject([
      {
        kind: "ability",
        trigger: {
          $type: "TTriggerOnCardTransformed",
          SourceEvent: "transformed",
          Subject: { $type: "TTargetCardSection", TargetSection: "SelfHand", Conditions: [{ $type: "TCardConditionalTag", Tags: ["reagent"] }] }
        },
        action: {
          $type: "TActionCardModifyAttribute",
          SourceAction: "gain_stat",
          AttributeType: "RegenApplyAmount",
          Operation: "Add",
          Value: { $type: "TFixedValue", Value: 3 },
          Target: { $type: "TTargetCardSelf" }
        },
        projectionStatus: "exact"
      }
    ]);

    expect(parseStructuredEffectsFromTexts(["When you sell this, permanently gain 2 Heal Regen"], tags)).toMatchObject([
      {
        kind: "ability",
        trigger: {
          $type: "TTriggerOnCardSold",
          SourceEvent: "sell",
          Subject: { $type: "TTargetCardSelf" }
        },
        action: {
          $type: "TActionCardModifyAttribute",
          SourceAction: "gain_stat",
          AttributeType: "RegenApplyAmount",
          Operation: "Add",
          Value: { $type: "TFixedValue", Value: 2 },
          Target: { $type: "TTargetCardSelf" }
        },
        projectionStatus: "exact"
      }
    ]);

    expect(parseStructuredEffectsFromTexts(["You have +10 Heal Regen"], tags)).toMatchObject([
      {
        kind: "aura",
        action: {
          $type: "TActionCardModifyAttribute",
          SourceAction: "gain_stat",
          AttributeType: "RegenApplyAmount",
          Operation: "Add",
          Value: { $type: "TFixedValue", Value: 10 },
          Target: { $type: "TTargetCardSelf" }
        },
        projectionStatus: "exact"
      }
    ]);

    expect(parseStructuredEffectsFromTexts(["When you Repair or Transform in combat, this gains 150 Damage"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnRepairOrTransform",
        SourceEvent: "repair_or_transform",
        CombatOnly: true,
        EffectPredicate: {
          $type: "TEffectPredicateOr",
          Predicates: [
            { $type: "TEffectPredicateFamily", Family: "repair" },
            { $type: "TEffectPredicateFamily", Family: "transform" }
          ]
        }
      },
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "DamageAmount",
        Operation: "Add",
        Value: { $type: "TFixedValue", Value: 150 },
        Target: { $type: "TTargetCardSelf" }
      },
      projectionStatus: "exact"
    });
  });

  it("parses first-time semantic clauses with limiter and ambiguity warnings", () => {
    const document = parseSemanticEffectDocumentFromTexts(
      ["The first time you use a non-Burn or non-Poison item each fight, Charge your Burn and Poison items 1 Charge second(s)"],
      tags,
      { sourceCardName: "Anything to Win", structuredEffectIds: ["0"] }
    );

    expect(document).toMatchObject({
      schemaVersion: "semantic-ir/v1",
      sourceCardName: "Anything to Win",
      confidence: "medium",
      clauses: [
        {
          kind: "triggered",
          trigger: {
            event: "item_used",
            subject: {
              entity: "item",
              predicates: {
                op: "not",
                expr: {
                  op: "or",
                  exprs: [
                    { op: "atom", atom: { kind: "has_mechanic", mechanic: "burn" } },
                    { op: "atom", atom: { kind: "has_mechanic", mechanic: "poison" } }
                  ]
                }
              }
            }
          },
          limiter: { kind: "once", reset: "fight", consume: "on_trigger_match" }
        }
      ],
      extractedTags: {
        mechanics: ["burn", "charge", "poison"],
        zones: ["board"]
      },
      projection: { structuredEffectIds: ["0"], status: "partial" }
    });
    expect(document.clauses[0].actions[0]).toMatchObject({
      node: "atomic",
      action: {
        type: "apply_effect",
        mechanic: "charge",
        target: {
          entity: "item",
          predicates: {
            op: "or",
            exprs: [
              { op: "atom", atom: { kind: "has_mechanic", mechanic: "burn" } },
              { op: "atom", atom: { kind: "has_mechanic", mechanic: "poison" } }
            ]
          }
        },
        amount: { kind: "fixed", value: 1, unit: "seconds" }
      }
    });
    expect(document.clauses[0].warnings?.map((warning) => warning.code)).toEqual(["BOOLEAN_AMBIGUITY", "TARGET_AMBIGUITY"]);

    const tierDocument = parseSemanticEffectDocumentFromTexts(
      ["The first time an enemy uses an item of the same or lower tier as this each fight, Destroy that item"],
      tags
    );
    expect(tierDocument).toMatchObject({
      confidence: "high",
      clauses: [
        {
          kind: "triggered",
          trigger: {
            event: "item_used",
            actor: { entity: "player", owner: "enemy" },
            subject: {
              entity: "item",
              owner: "enemy",
              predicates: {
                op: "atom",
                atom: { kind: "tier_compare", cmp: "lte", reference: { entity: "item", quantifier: "self" } }
              }
            }
          },
          limiter: { kind: "once", reset: "fight", consume: "on_trigger_match" }
        }
      ]
    });

    expect(parseSemanticEffectDocumentFromTexts(
      ["The first time an enemy uses an item of the same or lower tier as this, Destroy that item"],
      tags
    )).toMatchObject({
      clauses: [
        {
          trigger: {
            event: "item_used",
            actor: { entity: "player", owner: "enemy" },
            subject: {
              entity: "item",
              owner: "enemy",
              predicates: {
                op: "atom",
                atom: { kind: "tier_compare", cmp: "lte", reference: { entity: "item", quantifier: "self" } }
              }
            }
          },
          limiter: { kind: "once", reset: "never", consume: "on_trigger_match" }
        }
      ]
    });
  });

  it("parses slot terrain semantic clauses without projecting terrain as burn or freeze actions", () => {
    const stove = parseSemanticEffectDocumentFromTexts(["One of your slots becomes a Stove (The item here is Heated)"], tags);
    expect(stove).toMatchObject({
      clauses: [
        {
          kind: "declarative",
          actions: [
            {
              node: "atomic",
              action: {
                type: "modify_slot",
                target: { entity: "slot", owner: "self", zone: "board", quantifier: "one" },
                op: "set_terrain",
                terrain: "stove",
                linkedEffects: [
                  {
                    kind: "aura",
                    actions: [
                      {
                        node: "atomic",
                        action: {
                          type: "modify_status",
                          status: "heated",
                          target: { entity: "item", zone: "slot", position: "occupant_of_source_slot" }
                        }
                      }
                    ]
                  }
                ]
              }
            }
          ]
        }
      ],
      extractedTags: { statuses: ["heated"], zones: ["board", "slot"] }
    });

    const cooler = parseSemanticEffectDocumentFromTexts(["One of your slots becomes a Cooler (The item here is Chilled)"], tags);
    expect(cooler.extractedTags.statuses).toEqual(["chilled"]);
    expect(cooler.clauses[0].actions[0]).toMatchObject({
      node: "atomic",
      action: { type: "modify_slot", terrain: "cooler" }
    });
  });

  it("parses effect modifiers as effect-template transforms", () => {
    const document = parseSemanticEffectDocumentFromTexts(["All Charge effects are reduced by half"], tags, {
      structuredEffectIds: ["0"]
    });

    expect(document).toMatchObject({
      confidence: "medium",
      clauses: [
        {
          kind: "modifier",
          activeIn: ["combat"],
          actions: [
            {
              node: "atomic",
              action: {
                type: "modify_effect",
                target: {
                  entity: "effect_template",
                  owner: "any",
                  predicates: { op: "atom", atom: { kind: "has_mechanic", mechanic: "charge" } }
                },
                transform: { kind: "scale", field: "chargeSeconds", factor: 0.5, rounding: "unknown" }
              }
            }
          ],
          warnings: [{ code: "ROUNDING_UNKNOWN" }]
        }
      ],
      extractedTags: { mechanics: ["charge"] },
      projection: { status: "partial" }
    });
  });

  it("projects semantic documents conservatively back to legacy structured effects", () => {
    const simple = parseSemanticEffectDocumentFromTexts(["When you use a Tool item, Charge an adjacent item 1 second"], tags);
    const simpleProjection = projectSemanticDocumentToStructuredEffects(simple);
    expect(simpleProjection).toMatchObject({
      status: "exact",
      structuredEffects: [
        {
          action: {
            $type: "TActionCardCharge",
            SourceAction: "charge",
            AttributeType: "ChargeAmount",
            Value: { $type: "TFixedValue", Value: 1 }
          },
          semanticSourceIds: ["c_0_when_item_used"],
          projectionStatus: "exact"
        }
      ]
    });

    const rateLimiter = parseSemanticEffectDocumentFromTexts(["All Charge effects are reduced by half"], tags);
    expect(projectSemanticDocumentToStructuredEffects(rateLimiter)).toMatchObject({
      status: "exact",
      structuredEffects: [
        {
          action: {
            $type: "TActionEffectModify",
            SourceAction: "modify_effect",
            AttributeType: "EffectMagnitude",
            Operation: "Multiply",
            Value: { $type: "TFixedValue", Value: 0.5 },
            Target: {
              $type: "TTargetEffect",
              Entity: "EffectTemplate",
              Owner: "Any",
              Predicate: { $type: "TEffectPredicateFamily", Family: "charge" }
            },
            Rounding: "Unspecified"
          },
          semanticSourceIds: ["c_0_charge_effect_modifier"],
          projectionStatus: "exact"
        }
      ]
    });

    const stove = parseSemanticEffectDocumentFromTexts(["One of your slots becomes a Stove (The item here is Heated)"], tags);
    expect(projectSemanticDocumentToStructuredEffects(stove).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionBoardSlotSetTerrain",
        SourceAction: "modify_slot",
        Terrain: "stove",
        OccupantStatusHint: "heated",
        Target: { $type: "TTargetBoardSlotRandom", TargetSection: "SelfBoard" }
      },
      semanticSourceIds: ["c_0_slot_stove"],
      projectionStatus: "exact"
    });

    const tierDocument = parseSemanticEffectDocumentFromTexts(
      ["The first time an enemy uses an item of the same or lower tier as this each fight, Destroy that item"],
      tags
    );
    expect(projectSemanticDocumentToStructuredEffects(tierDocument)).toMatchObject({
      status: "exact",
      structuredEffects: [
        {
          trigger: {
            $type: "TTriggerOnItemUsed",
            SourceEvent: "item_used",
            Subject: {
              $type: "TTargetCardSection",
              TargetSection: "OpponentBoard",
              Conditions: [
                {
                  $type: "TCardConditionalTierComparison",
                  ComparisonOperator: "LessThanOrEqual",
                  Reference: { $type: "TTargetCardSelf" }
                }
              ]
            },
            Limit: { Mode: "First", Count: 1, Reset: "Fight", Scope: "SourceEffectInstance" }
          },
          action: {
            $type: "TActionCardDestroy",
            SourceAction: "destroy",
            Target: { $type: "TTargetCardTriggerSource" }
          },
          projectionStatus: "exact"
        }
      ]
    });

    const theirItemsTierDocument = parseSemanticEffectDocumentFromTexts(
      ["The first time an enemy uses an item of the same or lower tier as this, Slow their items for 1 seconds"],
      tags
    );
    expect(projectSemanticDocumentToStructuredEffects(theirItemsTierDocument).structuredEffects[0]).toMatchObject({
      trigger: {
        Subject: {
          $type: "TTargetCardSection",
          TargetSection: "OpponentBoard",
          Conditions: [{ $type: "TCardConditionalTierComparison", ComparisonOperator: "LessThanOrEqual" }]
        },
        Limit: { Mode: "First", Count: 1, Reset: "Never", Scope: "SourceEffectInstance" }
      },
      action: {
        $type: "TActionCardSlow",
        AttributeType: "SlowAmount",
        Target: { $type: "TTargetCardSection", TargetSection: "OpponentBoard" }
      },
      projectionStatus: "exact"
    });

    const eachPlayerSlow = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["When you use a Vehicle or Flying item, Slow an item on each Player's board for 1 Slow second(s)"], tags)
    );
    expect(eachPlayerSlow.structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionCardSlow",
        SourceAction: "slow",
        Target: { $type: "TTargetCardRandom", TargetSection: "AllBoards" }
      }
    });

    const eachPlayerDestroy = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["The first time you use an item, destroy an item on each Player's board"], tags)
    );
    expect(eachPlayerDestroy.structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionCardDestroy",
        SourceAction: "destroy",
        Target: { $type: "TTargetCardRandom", TargetSection: "AllBoards" }
      }
    });
    expect(eachPlayerDestroy.structuredEffects[0].action.Target).not.toMatchObject({
      Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "destroy" } }]
    });

    const eachPlayerTransform = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["Transform another non-Legendary Small item on each Player's board into Virus for the rest of the fight"], tags)
    );
    expect(eachPlayerTransform.structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionCardTransform",
        SourceAction: "transform",
        Target: {
          $type: "TTargetCardRandom",
          TargetSection: "AllBoards",
          Conditions: [
            { $type: "TCardConditionalSize", Sizes: [1] },
            { $type: "TCardConditionalRarity", Rarity: "Legendary", ComparisonOperator: "Equal", IsNot: true }
          ]
        },
        TransformInto: {
          RawDescription: "Virus for the rest of the fight",
          CardKind: "Item",
          NameHints: ["Virus"],
          Duration: "Fight",
          SelectionMode: "OneMatching"
        }
      }
    });

    const destroyedInstead = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["When an enemy would destroy your items, this is destroyed instead"], tags)
    );
    expect(destroyedInstead.structuredEffects[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnCardDestroyed",
        SourceEvent: "destroyed",
        Subject: { $type: "TTargetCardSection", TargetSection: "SelfHand" }
      },
      action: {
        $type: "TActionCardRedirect",
        SourceAction: "redirect",
        Target: { $type: "TTargetCardSelf" },
        OriginalTarget: { $type: "TTargetCardSection", TargetSection: "SelfHand" },
        ReplacementTrigger: {
          $type: "TTriggerOnCardDestroyed",
          SourceEvent: "destroyed",
          Subject: { $type: "TTargetCardSection", TargetSection: "SelfHand" }
        },
        ReplacementTiming: "InsteadOfOriginalResolution",
        Value: { $type: "TIdentifierValue", Value: "destroyed_instead" }
      },
      projectionStatus: "exact"
    });
    expect(destroyedInstead.structuredEffects[0].trigger?.Subject).not.toMatchObject({
      Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "destroy" } }]
    });
    expect(destroyedInstead.structuredEffects[0].projectionWarnings).toBeUndefined();
    expect(destroyedInstead.status).toBe("exact");

    const noResetTierDocument = parseSemanticEffectDocumentFromTexts(
      ["The first time an enemy uses an item of the same or lower tier as this, Destroy that item"],
      tags
    );
    expect(projectSemanticDocumentToStructuredEffects(noResetTierDocument)).toMatchObject({
      status: "exact",
      structuredEffects: [
        {
          trigger: {
            $type: "TTriggerOnItemUsed",
            SourceEvent: "item_used",
            Subject: {
              $type: "TTargetCardSection",
              TargetSection: "OpponentBoard",
              Conditions: [{ $type: "TCardConditionalTierComparison", ComparisonOperator: "LessThanOrEqual" }]
            },
            Limit: { Mode: "First", Count: 1, Reset: "Never", Scope: "SourceEffectInstance" }
          },
          action: {
            $type: "TActionCardDestroy",
            SourceAction: "destroy",
            Target: { $type: "TTargetCardTriggerSource" }
          },
          projectionStatus: "exact"
        }
      ]
    });
  });

  it("parses the 10 targeted unsupported examples into explicit structured IR", () => {
    expect(parseStructuredEffectsFromTexts(["One of your slots becomes a Stove (The item here is Heated)"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionBoardSlotSetTerrain",
        SourceAction: "modify_slot",
        Terrain: "Stove",
        OccupantStatusHint: "Heated",
        Target: { $type: "TTargetBoardSlotRandom", TargetSection: "SelfBoard" }
      },
      projectionStatus: "exact"
    });

    expect(parseStructuredEffectsFromTexts(["All Charge effects are reduced by half"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionEffectModify",
        SourceAction: "modify_effect",
        AttributeType: "EffectMagnitude",
        Operation: "Multiply",
        Value: { $type: "TFractionValue", Numerator: 1, Denominator: 2 },
        Target: {
          $type: "TTargetEffect",
          Entity: "EffectTemplate",
          Owner: "Any",
          Predicate: { $type: "TEffectPredicateFamily", Family: "charge" }
        },
        Rounding: "Unspecified"
      },
      projectionStatus: "exact"
    });

    expect(
      parseStructuredEffectsFromTexts(
        ["The first time you use a non-Burn or non-Poison item each fight, Charge your Burn and Poison items 1 Charge second(s)"],
        tags
      )[0]
    ).toMatchObject({
      trigger: {
        $type: "TTriggerOnItemUsed",
        SourceEvent: "item_used",
        Limit: { Mode: "First", Count: 1, Reset: "Fight", Scope: "SourceEffectInstance" },
        Subject: {
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "NoneOf", Tags: ["burn", "poison"] } }]
        }
      },
      action: {
        $type: "TActionCardCharge",
        SourceAction: "charge",
        Value: { $type: "TFixedValue", Value: 1 },
        Target: {
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "AnyOf", Tags: ["burn", "poison"] } }]
        }
      },
      projectionStatus: "exact"
    });

    expect(parseStructuredEffectsFromTexts(["One of your slots becomes a Cooler (The item here is Chilled)"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionBoardSlotSetTerrain",
        Terrain: "Cooler",
        OccupantStatusHint: "Chilled"
      },
      projectionStatus: "exact"
    });

    expect(
      parseStructuredEffectsFromTexts(
        ["The first time you fall below half Health each fight, Haste your Burn and Regen items for 1 Haste second(s)"],
        tags
      )[0]
    ).toMatchObject({
      trigger: {
        $type: "TTriggerOnPlayerAttributeThresholdCrossed",
        SourceEvent: "player_attribute_threshold",
        AttributeType: "Health",
        Crossing: "FromAtOrAboveToBelow",
        Threshold: {
          $type: "TExpressionValue",
          Operator: "Multiply",
          Values: [
            { $type: "TFixedValue", Value: 0.5 },
            { $type: "TReferenceValuePlayerAttribute", AttributeType: "HealthMax" }
          ]
        },
        Limit: { Mode: "First", Count: 1, Reset: "Fight", Scope: "SourceEffectInstance" }
      },
      action: {
        $type: "TActionCardHaste",
        SourceAction: "haste",
        Value: { $type: "TFixedValue", Value: 1 },
        Target: {
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "AnyOf", Tags: ["burn", "regen"] } }]
        }
      },
      projectionStatus: "exact"
    });

    expect(parseStructuredEffectsFromTexts(["The first time ANY Player falls below half Health, Destroy a Small item"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnPlayerAttributeThresholdCrossed",
        SourceEvent: "player_attribute_threshold",
        Subject: { $type: "TTargetPlayerRelative", TargetMode: "Both" },
        AttributeType: "Health",
        Threshold: {
          $type: "TExpressionValue",
          Values: [
            { $type: "TFixedValue", Value: 0.5 },
            { $type: "TReferenceValuePlayerAttribute", Target: { $type: "TTargetPlayerRelative", TargetMode: "Both" }, AttributeType: "HealthMax" }
          ]
        },
        Crossing: "FromAtOrAboveToBelow",
        Limit: { Mode: "First", Count: 1 }
      },
      action: {
        $type: "TActionCardDestroy",
        SourceAction: "destroy",
        Target: { Conditions: [{ $type: "TCardConditionalSize", Sizes: [1] }] }
      },
      projectionStatus: "exact"
    });

    const shieldBonus = parseStructuredEffectsFromTexts(
      ["Your items have +1 Shield. When you sell a Small item, this gains 1 bonus"],
      tags
    );
    expect(shieldBonus).toMatchObject([
      {
        groupId: "g_bonus_shield",
        variableDeclarations: [
          {
            id: "bonus_shield",
            defaultValue: { $type: "TFixedValue", Value: 1 },
            attributeHint: "Shield"
          }
        ],
        action: {
          $type: "TActionCardModifyAttribute",
          AttributeType: "Shield",
          Value: { $type: "TVariableValue", VariableId: "bonus_shield" }
        },
        projectionStatus: "exact"
      },
      {
        groupId: "g_bonus_shield",
        trigger: {
          $type: "TTriggerOnCardSold",
          Subject: { Conditions: [{ $type: "TCardConditionalSize", Sizes: [1] }] }
        },
        action: {
          $type: "TActionVariableModify",
          SourceAction: "modify_variable",
          VariableId: "bonus_shield",
          Operation: "Add",
          Value: { $type: "TFixedValue", Value: 1 }
        },
        projectionStatus: "exact"
      }
    ]);

    expect(
      parseStructuredEffectsFromTexts(["Your items have +1 Damage. When you sell a Small item, this gains 1 bonus"], tags)
    ).toMatchObject([
      {
        groupId: "g_bonus_damage",
        variableDeclarations: [{ id: "bonus_damage", attributeHint: "DamageAmount" }],
        action: {
          $type: "TActionCardModifyAttribute",
          AttributeType: "DamageAmount",
          Value: { $type: "TVariableValue", VariableId: "bonus_damage" }
        }
      },
      {
        groupId: "g_bonus_damage",
        action: { $type: "TActionVariableModify", VariableId: "bonus_damage" }
      }
    ]);

    expect(
      parseStructuredEffectsFromTexts(["Your items have +2 Crit% Crit Chance. When you start a fight, this gains +2% Crit Chance bonus"], tags)
    ).toMatchObject([
      {
        groupId: "g_bonus_crit_chance",
        variableDeclarations: [
          {
            id: "bonus_crit_chance",
            defaultValue: { $type: "TFixedValue", Value: 2 },
            attributeHint: "CritChance"
          }
        ],
        action: {
          $type: "TActionCardModifyAttribute",
          AttributeType: "CritChance",
          Value: { $type: "TVariableValue", VariableId: "bonus_crit_chance" }
        }
      },
      {
        groupId: "g_bonus_crit_chance",
        trigger: { $type: "TTriggerOnFightStarted", SourceEvent: "combat_start" },
        action: {
          $type: "TActionVariableModify",
          VariableId: "bonus_crit_chance",
          Value: { $type: "TFixedValue", Value: 2 }
        },
        projectionStatus: "exact"
      }
    ]);

    expect(parseStructuredEffectsFromTexts(["You are Enraged for 1 second longer"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionStatusDurationModify",
        SourceAction: "modify_status_duration",
        Operation: "Add",
        Value: { $type: "TFixedValue", Value: 1 },
        Target: { $type: "TTargetStatusApplication", Status: "Enraged" }
      },
      projectionStatus: "exact"
    });

    expect(parseStructuredEffectsFromTexts(["You are Enraged for 1 second shorter"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionStatusDurationModify",
        SourceAction: "modify_status_duration",
        Operation: "Subtract",
        Target: { $type: "TTargetStatusApplication", Status: "Enraged" }
      },
      projectionStatus: "exact"
    });

    expect(parseStructuredEffectsFromTexts(["You have joined the Cult"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionPlayerModifyState",
        SourceAction: "modify_player_state",
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" },
        StateType: "FactionMembership",
        StateValue: { $type: "TIdentifierValue", Value: "Cult" }
      },
      projectionStatus: "exact"
    });

    const rapidRelief = parseStructuredEffectsFromTexts(["While your enemy has more Health than you, your Heal and Regen items' Cooldowns are reduced by 5%"], tags);
    expect(rapidRelief).toHaveLength(1);
    expect(rapidRelief).toMatchObject([
      {
        kind: "aura",
        action: {
          $type: "TActionCardModifyAttribute",
          SourceAction: "reduce_cooldown",
          AttributeType: "CooldownMax",
          Operation: "Subtract",
          Value: { $type: "TFixedValue", Value: 5 },
          Target: {
            $type: "TTargetCardSection",
            TargetSection: "SelfHand",
            Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "AnyOf", Tags: ["heal", "regen"] } }]
          }
        }
      }
    ]);

    expect(
      parseStructuredEffectsFromTexts(
        ["While your enemy has more Health than you, your Shield items have their Cooldowns are reduced by 5%"],
        ["shieldreference", "cooldown"]
      )[0]
    ).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "reduce_cooldown",
        AttributeType: "CooldownMax",
        Target: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          Conditions: [{ $type: "TCardConditionalTag", Tags: ["shield"] }]
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Your Foods' Cooldowns are reduced by 5%"], ["food", "cooldown"])[0]).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        Target: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          Conditions: [{ $type: "TCardConditionalTag", Tags: ["food"] }]
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Your Toys' and Apparel Cooldowns are reduced by 5%"], ["toy", "apparel", "cooldown"])[0]).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        Target: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "AnyOf", Tags: ["toy", "apparel"] } }]
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Reduce the Cooldown of your other items by 8%"], ["cooldown"])[0]).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        Target: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          ExcludeSelf: true
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["All item Cooldowns are increased by 1 second"], ["cooldown"])[0]).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "reduce_cooldown",
        AttributeType: "CooldownMax",
        Operation: "Add",
        Value: { $type: "TFixedValue", Value: 1 },
        Target: { $type: "TTargetCardSection", TargetSection: "AllHands" }
      }
    });

    expect(parseStructuredEffectsFromTexts(["The first time you use this, this item's Cooldown is halved"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "reduce_cooldown",
        AttributeType: "CooldownMax",
        Operation: "Multiply",
        Value: { $type: "TFixedValue", Value: 0.5 },
        Target: { $type: "TTargetCardSelf" }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Destroy this and an enemy item with no Cooldown"], ["cooldown"])[0]).toMatchObject({
      action: {
        $type: "TActionCardDestroy",
        Target: {
          $type: "TTargetCardRandom",
          TargetSection: "OpponentBoard",
          Conditions: [
            {
              $type: "TCardConditionalAttribute",
              AttributeType: "CooldownMax",
              ComparisonOperator: "Equal",
              Value: { $type: "TFixedValue", Value: 0 }
            }
          ]
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Your items with no Cooldown have +25% Damage"], ["cooldown", "damage"])[0]).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        AttributeType: "DamageAmount",
        Value: { $type: "TFixedValue", Value: 25 },
        Target: {
          $type: "TTargetCardSection",
          Conditions: [{ $type: "TCardConditionalAttribute", AttributeType: "CooldownMax", ComparisonOperator: "Equal" }]
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["If this is your only item with a Cooldown, its Cooldown is reduced by 5 seconds"], ["cooldown"])[0]).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "reduce_cooldown",
        Target: { $type: "TTargetCardSelf" }
      },
      prerequisites: [{ $type: "TCardConditionalCount", ComparisonOperator: "Equal", Amount: 1 }]
    });
    expect(parseStructuredEffectsFromTexts(["If this is your only item with a Cooldown, its Cooldown is reduced by 5 seconds"], ["cooldown"])[0].action.Target).not.toMatchObject({
      Conditions: [{ $type: "TCardConditionalTag", Tags: ["cooldown"] }]
    });

    expect(
      parseStructuredEffectsFromTexts(["Your items with a Cooldown of 8 seconds or greater have +1 Multicast"], ["cooldown", "multicast"])[0]
    ).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        AttributeType: "Multicast",
        Value: { $type: "TFixedValue", Value: 1 },
        Target: {
          $type: "TTargetCardSection",
          Conditions: [
            {
              $type: "TCardConditionalAttribute",
              AttributeType: "CooldownMax",
              ComparisonOperator: "GreaterThanOrEqual",
              Value: { $type: "TFixedValue", Value: 8 }
            }
          ]
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["At the start of each fight, increase an enemy item's Cooldown by 3 seconds"], ["cooldown"])[0]).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "reduce_cooldown",
        AttributeType: "CooldownMax",
        Operation: "Add",
        Value: { $type: "TFixedValue", Value: 3 },
        Target: {
          $type: "TTargetCardRandom",
          TargetSection: "OpponentBoard"
        }
      }
    });
    expect(parseStructuredEffectsFromTexts(["At the start of each fight, increase an enemy item's Cooldown by 3 seconds"], ["cooldown"])[0].action.Target).not.toMatchObject({
      Conditions: [{ $type: "TCardConditionalTag", Tags: ["cooldown"] }]
    });

    expect(parseStructuredEffectsFromTexts(["At the start of each fight, the fastest enemy item has its cooldown increased by 1 second(s)"], ["cooldown"])[0]).toMatchObject({
      trigger: { $type: "TTriggerOnFightStarted", SourceEvent: "combat_start" },
      action: {
        $type: "TActionCardModifyAttribute",
        AttributeType: "CooldownMax",
        Operation: "Add",
        Target: { $type: "TTargetCardXMost", TargetMode: "LowestCooldownCard", TargetSection: "OpponentBoard" },
        Value: { $type: "TFixedValue", Value: 1 }
      },
      projectionStatus: "exact"
    });

    expect(parseStructuredEffectsFromTexts(["At the start of each fight, the slowest enemy item has its cooldown increased by 1 second(s)"], ["cooldown"])[0]).toMatchObject({
      action: {
        Target: { $type: "TTargetCardXMost", TargetMode: "HighestCooldownCard", TargetSection: "OpponentBoard" }
      }
    });

    expect(parseStructuredEffectsFromTexts(["When you use a Core, reduce an item's Cooldown by 5%"], ["core", "cooldown"])[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnItemUsed",
        Subject: { Conditions: [{ $type: "TCardConditionalTag", Tags: ["core"] }] }
      },
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "reduce_cooldown",
        Target: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand"
        }
      }
    });
    expect(parseStructuredEffectsFromTexts(["When you use a Core, reduce an item's Cooldown by 5%"], ["core", "cooldown"])[0].action.Target).not.toMatchObject({
      Conditions: [{ $type: "TCardConditionalTag", Tags: ["cooldown"] }]
    });

    expect(parseStructuredEffectsFromTexts(["While you are below 50% Max Health, adjacent items have their Cooldown reduced by half"], ["cooldown"])[0]).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "reduce_cooldown",
        Operation: "Multiply",
        Value: { $type: "TFixedValue", Value: 0.5 },
        Target: {
          $type: "TTargetCardPositional",
          TargetMode: "Neighbor"
        }
      }
    });
    expect(parseStructuredEffectsFromTexts(["While you are below 50% Max Health, adjacent items have their Cooldown reduced by half"], ["cooldown"])[0].action.Target).not.toMatchObject({
      Conditions: [{ $type: "TCardConditionalTag", Tags: ["cooldown"] }]
    });

    expect(parseStructuredEffectsFromTexts(["Reduce another Tool's Cooldown by 1 second"], ["tool", "cooldown"])[0]).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "reduce_cooldown",
        Target: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          ExcludeSelf: true,
          Conditions: [{ $type: "TCardConditionalTag", Tags: ["tool"] }]
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Non-Tech item Cooldowns are increased by 1 second(s)"], ["tech", "cooldown"])[0]).toMatchObject({
      kind: "aura",
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "reduce_cooldown",
        AttributeType: "CooldownMax",
        Operation: "Add",
        Value: { $type: "TFixedValue", Value: 1 },
        Target: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "NoneOf", Tags: ["tech"] } }]
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Your items with value over 10 have their cooldowns reduced by 5%"], ["cooldown", "value"])[0]).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "reduce_cooldown",
        Value: { $type: "TFixedValue", Value: 5 },
        Target: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          Conditions: [
            {
              $type: "TCardConditionalAttribute",
              AttributeType: "Value",
              ComparisonOperator: "GreaterThan",
              Value: { $type: "TFixedValue", Value: 10 }
            }
          ]
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["When you use an item with value over 10, Shield 10 Shield"], ["value"])[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnItemUsed",
        SourceEvent: "item_used",
        Subject: {
          $type: "TTargetCardSection",
          Conditions: [
            {
              $type: "TCardConditionalAttribute",
              AttributeType: "Value",
              ComparisonOperator: "GreaterThan",
              Value: { $type: "TFixedValue", Value: 10 }
            }
          ]
        }
      },
      action: {
        $type: "TActionPlayerShieldApply",
        Value: { $type: "TFixedValue", Value: 10 }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Charge adjacent Large items for half their Cooldown"], ["cooldown"])[0]).toMatchObject({
      action: {
        $type: "TActionCardCharge",
        SourceAction: "charge",
        AttributeType: "ChargeAmount",
        Value: {
          $type: "TReferenceValueCardAttribute",
          AttributeType: "CooldownMax",
          Modifier: { ModifyMode: "Multiply", Value: { $type: "TFixedValue", Value: 0.5 } }
        },
        Target: {
          $type: "TTargetCardPositional",
          TargetMode: "Neighbor",
          Conditions: [{ $type: "TCardConditionalSize", Sizes: [3] }]
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["All items have double Damage"], tags)[0]).toMatchObject({
      kind: "aura",
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "DamageAmount",
        Operation: "Multiply",
        Value: { $type: "TFixedValue", Value: 2 },
        Target: { $type: "TTargetCardSection", TargetSection: "SelfHand" }
      },
      projectionStatus: "exact"
    });

    expect(parseStructuredEffectsFromTexts(["This has double Shield"], tags)[0]).toMatchObject({
      kind: "aura",
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "Shield",
        Operation: "Multiply",
        Value: { $type: "TFixedValue", Value: 2 },
        Target: { $type: "TTargetCardSelf" }
      },
      projectionStatus: "exact"
    });

    expect(parseStructuredEffectsFromTexts(["This deals double Crit Damage"], tags)[0]).toMatchObject({
      kind: "aura",
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "CritDamage",
        Operation: "Multiply",
        Value: { $type: "TFixedValue", Value: 2 },
        Target: { $type: "TTargetCardSelf" }
      },
      projectionStatus: "exact"
    });

    expect(parseStructuredEffectsFromTexts(["Your Weapons deal double Crit Damage"], tags)[0]).toMatchObject({
      action: {
        AttributeType: "CritDamage",
        Operation: "Multiply",
        Target: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "weapon" } }]
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["When the Sandstorm starts, double your Max Health"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        EffectPredicate: { $type: "TEffectPredicateFamily", Family: "sandstorm" }
      },
      action: {
        $type: "TActionPlayerModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "HealthMax",
        Operation: "Multiply",
        Value: { $type: "TFixedValue", Value: 2 },
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" }
      },
      projectionStatus: "exact"
    });

    expect(parseStructuredEffectsFromTexts(["This has double Damage and Shield gain"], tags)).toMatchObject([
      {
        kind: "aura",
        action: {
          $type: "TActionCardModifyAttribute",
          AttributeType: "DamageAmount",
          Operation: "Multiply",
          Target: { $type: "TTargetCardSelf" }
        }
      },
      {
        kind: "aura",
        action: {
          $type: "TActionCardModifyAttribute",
          AttributeType: "Shield",
          Operation: "Multiply",
          Target: { $type: "TTargetCardSelf" }
        }
      }
    ]);

    expect(parseStructuredEffectsFromTexts(["Your leftmost Ammo Weapon has double damage and +1 Ammo Max Ammo"], tags)).toMatchObject([
      {
        action: {
          AttributeType: "DamageAmount",
          Operation: "Multiply",
          Target: {
            $type: "TTargetCardXMost",
            TargetMode: "LeftMostCard",
            Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "weapon" } }]
          }
        }
      },
      {
        action: {
          AttributeType: "AmmoMax",
          Operation: "Add",
          Target: {
            $type: "TTargetCardXMost",
            TargetMode: "LeftMostCard",
            Conditions: [{ $type: "TCardConditionalTag", Tags: ["weapon"] }]
          }
        }
      }
    ]);

    expect(parseStructuredEffectsFromTexts(["When you Enrage, this item can trigger an additional time this fight"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: { $type: "TTriggerOnEnrage", SourceEvent: "enrage" },
      action: {
        $type: "TActionEffectModify",
        SourceAction: "modify_effect",
        AttributeType: "EffectTrigger",
        Operation: "Add",
        Value: { $type: "TFixedValue", Value: 1 },
        Target: { $type: "TTargetEffect", Entity: "EffectInstance", Owner: "Self" }
      },
      projectionStatus: "exact"
    });

    expect(parseStructuredEffectsFromTexts(["Haste your other items for 1 Haste second(s)"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionCardHaste",
        Target: { $type: "TTargetCardSection", TargetSection: "SelfHand", ExcludeSelf: true }
      }
    });

    expect(parseStructuredEffectsFromTexts(["The first time you fall below half Health each fight, Freeze ALL other items for 4 Freeze seconds"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionCardFreeze",
        Target: { $type: "TTargetCardSection", TargetSection: "AllHands", ExcludeSelf: true }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Slow ANY other item 1 Slow second(s)"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionCardSlow",
        Target: { $type: "TTargetCardRandom", TargetSection: "AllHands", ExcludeSelf: true }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Freeze ANY other item 1 Freeze second(s)"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionCardFreeze",
        Target: { $type: "TTargetCardRandom", TargetSection: "AllHands", ExcludeSelf: true }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Heat your other Tools and Weapons for 3 seconds"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionStatusModify",
        SourceAction: "modify_status",
        Operation: "Add",
        Value: { $type: "TFixedValue", Value: 3 },
        Target: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          ExcludeSelf: true,
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "AnyOf", Tags: ["tool", "weapon"] } }]
        },
        Status: "heated"
      }
    });

    expect(parseStructuredEffectsFromTexts(["Haste your other Tools and Weapons for 3 Haste second(s)"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionCardHaste",
        SourceAction: "haste",
        Target: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          ExcludeSelf: true,
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "AnyOf", Tags: ["tool", "weapon"] } }]
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["When you Enrage, this Slows an additional item"], tags)[0]).toMatchObject({
      trigger: { $type: "TTriggerOnEnrage", SourceEvent: "enrage" },
      action: {
        $type: "TActionEffectModify",
        SourceAction: "modify_effect",
        AttributeType: "EffectMagnitude",
        Operation: "Add",
        Value: { $type: "TFixedValue", Value: 1 },
        Target: { $type: "TTargetEffect", Entity: "EffectTemplate", Owner: "Self", Predicate: { $type: "TEffectPredicateFamily", Family: "slow" } },
        EffectPredicate: { $type: "TEffectPredicateFamily", Family: "slow" }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Chilled: Charge your other Chilled items 1 Charge second(s)"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: { $type: "TTriggerOnCardFired", SourceEvent: "cooldown_ready" },
      prerequisites: [{ $type: "TCardConditionalStatus", Status: "chilled" }],
      action: {
        $type: "TActionCardCharge",
        SourceAction: "charge",
        AttributeType: "ChargeAmount",
        Value: { $type: "TFixedValue", Value: 1 },
        Target: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          Conditions: [{ $type: "TCardConditionalStatus", Status: "chilled" }]
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Heated: Burn 2 Burn"], tags)[0]).toMatchObject({
      prerequisites: [{ $type: "TCardConditionalStatus", Status: "heated" }],
      action: {
        $type: "TActionPlayerBurnApply",
        SourceAction: "burn",
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Opponent" }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Adjacent items are Chilled"], tags)[0]).toMatchObject({
      kind: "aura",
      action: {
        $type: "TActionStatusModify",
        SourceAction: "modify_status",
        Operation: "Add",
        Status: "chilled",
        Target: { $type: "TTargetCardPositional", TargetMode: "Neighbor" }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Chilled: Your Small Chilled items have +1 Multicast and adjacent items are Chilled"], tags)).toMatchObject([
      {
        prerequisites: [{ $type: "TCardConditionalStatus", Status: "chilled" }],
        action: {
          $type: "TActionCardModifyAttribute",
          SourceAction: "multicast",
          AttributeType: "Multicast",
          Target: {
            $type: "TTargetCardSection",
            Conditions: [
              { $type: "TCardConditionalStatus", Status: "chilled" },
              { $type: "TCardConditionalSize", Sizes: [1] }
            ]
          }
        }
      },
      {
        prerequisites: [{ $type: "TCardConditionalStatus", Status: "chilled" }],
        action: {
          $type: "TActionStatusModify",
          SourceAction: "modify_status",
          Status: "chilled",
          Target: { $type: "TTargetCardPositional", TargetMode: "Neighbor" }
        }
      }
    ]);

    const trappingPit = parseStructuredEffectsFromTexts(
      ["The first time an enemy uses an item of the same or lower tier as this, Destroy that item and deal 400 Damage Damage"],
      tags
    );
    expect(trappingPit).toMatchObject([
      {
        trigger: {
          $type: "TTriggerOnItemUsed",
          SourceEvent: "item_used",
          Subject: {
            $type: "TTargetCardSection",
            TargetSection: "OpponentBoard",
            Conditions: [{ $type: "TCardConditionalTierComparison", ComparisonOperator: "LessThanOrEqual" }]
          },
          Limit: { Mode: "First", Count: 1, Reset: "Never", Scope: "SourceEffectInstance" }
        },
        action: {
          $type: "TActionCardDestroy",
          SourceAction: "destroy",
          Target: { $type: "TTargetCardTriggerSource" }
        }
      },
      {
        trigger: {
          $type: "TTriggerOnItemUsed",
          SourceEvent: "item_used",
          Subject: {
            $type: "TTargetCardSection",
            TargetSection: "OpponentBoard",
            Conditions: [{ $type: "TCardConditionalTierComparison", ComparisonOperator: "LessThanOrEqual" }]
          },
          Limit: { Mode: "First", Count: 1, Reset: "Never", Scope: "SourceEffectInstance" }
        },
        action: {
          $type: "TActionPlayerDamage",
          SourceAction: "damage",
          Target: { $type: "TTargetPlayerRelative", TargetMode: "Opponent" },
          Value: { $type: "TFixedValue", Value: 400 }
        }
      }
    ]);
  });

  it("builds semantic search and explanation text for complex effects", () => {
    const rateLimiter = parseSemanticEffectDocumentFromTexts(["All Charge effects are reduced by half"], tags);
    expect(semanticSearchIndex(rateLimiter).text).toContain("effect_template");
    expect(semanticSearchIndex(rateLimiter).text).toContain("charge");
    expect(semanticSummary(rateLimiter)[0]).toContain("modify_effect");

    const stove = parseSemanticEffectDocumentFromTexts(["One of your slots becomes a Stove (The item here is Heated)"], tags);
    expect(semanticSearchIndex(stove).text).toContain("stove");
    expect(semanticSearchIndex(stove).text).toContain("heated");
    expect(semanticSummary(stove)[0]).toContain("modify_slot");
  });

  it("parses internal bonus variables and their companion aura", () => {
    const document = parseSemanticEffectDocumentFromTexts(
      ["Your items have +1 Damage. When you sell a Small item, this gains 1 bonus"],
      tags
    );

    expect(document.variables).toMatchObject([
      {
        id: "v_bonus",
        owner: "source_card",
        name: "bonus",
        defaultValue: { kind: "fixed", value: 1 },
        statHint: { domain: "card", id: "damageAmount" },
        evidence: [{ source: "parser_inference", text: "bonus stat inferred from companion aura" }],
        lifetime: "run"
      }
    ]);
    expect(document.clauses).toMatchObject([
      {
        id: "c_bonus_aura",
        kind: "aura",
        actions: [
          {
            node: "atomic",
            action: {
              type: "modify_stat",
              amount: { kind: "variable", ref: { variableId: "v_bonus" } }
            }
          }
        ]
      },
      {
        id: "c_bonus_sell",
        kind: "triggered",
        trigger: {
          event: "item_sold",
          subject: { predicates: { op: "atom", atom: { kind: "has_size", size: "small" } } }
        },
        actions: [
          {
            node: "atomic",
            action: {
              type: "modify_variable",
              variable: { variableId: "v_bonus" },
              op: "add",
              amount: { kind: "fixed", value: 1 }
            }
          }
        ]
      }
    ]);

    const fightStartDocument = parseSemanticEffectDocumentFromTexts(
      ["Your items have +2 Crit% Crit Chance. When you start a fight, this gains +2% Crit Chance bonus"],
      tags
    );
    expect(fightStartDocument.variables).toMatchObject([
      {
        id: "v_bonus",
        defaultValue: { kind: "fixed", value: 2 },
        statHint: { domain: "card", id: "critChance" }
      }
    ]);
    expect(fightStartDocument.clauses).toMatchObject([
      {
        id: "c_bonus_aura",
        kind: "aura",
        actions: [
          {
            node: "atomic",
            action: {
              type: "modify_stat",
              stat: { domain: "card", id: "critChance" },
              amount: { kind: "variable", ref: { variableId: "v_bonus" } }
            }
          }
        ]
      },
      {
        id: "c_bonus_fight_started",
        kind: "triggered",
        trigger: { event: "fight_started" },
        actions: [
          {
            node: "atomic",
            action: {
              type: "modify_variable",
              amount: { kind: "fixed", value: 2 }
            }
          }
        ]
      }
    ]);

    const projectedFightStart = projectSemanticDocumentToStructuredEffects(fightStartDocument);
    expect(projectedFightStart.structuredEffects).toMatchObject([
      {
        action: {
          $type: "TActionCardModifyAttribute",
          AttributeType: "CritChance",
          Value: { $type: "TVariableValue", VariableId: "v_bonus" }
        }
      },
      {
        trigger: { $type: "TTriggerOnFightStarted", SourceEvent: "combat_start" },
        action: {
          $type: "TActionVariableModify",
          SourceAction: "modify_variable",
          VariableId: "v_bonus",
          Value: { $type: "TFixedValue", Value: 2 }
        }
      }
    ]);
    expect(JSON.stringify(projectedFightStart.structuredEffects)).not.toContain("TTriggerOnCardSold");
  });

  it("parses nested if/when and replacement events semantically", () => {
    const customScope = parseSemanticEffectDocumentFromTexts(
      ["If you have exactly one Weapon, when you Crit with it Charge a non-Weapon item 1 Charge second(s)"],
      tags
    );

    expect(customScope.clauses[0]).toMatchObject({
      kind: "triggered",
      condition: {
        op: "atom",
        atom: {
          domain: "entity",
          predicate: {
            kind: "count_compare",
            cmp: "eq",
            value: { kind: "fixed", value: 1, unit: "count" }
          }
        }
      },
      trigger: {
        event: "crit",
        subject: {
          predicates: { op: "atom", atom: { kind: "has_item_type", type: "weapon" } },
          bindAs: "exact_item"
        }
      },
      actions: [
        {
          node: "atomic",
          action: {
            type: "apply_effect",
            mechanic: "charge",
            target: {
              predicates: { op: "not", expr: { op: "atom", atom: { kind: "has_item_type", type: "weapon" } } }
            }
          }
        }
      ]
    });

    const memento = parseSemanticEffectDocumentFromTexts(["The first time you would be defeated each fight, Heal 100 and take no damage for 5 seconds"], tags);
    expect(memento.clauses[0]).toMatchObject({
      kind: "replacement",
      trigger: { event: "would_be_defeated" },
      actions: [
        {
          node: "sequence",
          actions: [
            { node: "atomic", action: { type: "apply_effect", mechanic: "heal", amount: { kind: "fixed", value: 100 } } },
            { node: "atomic", action: { type: "prevent_damage", duration: { kind: "for_seconds", seconds: { kind: "fixed", value: 5, unit: "seconds" } } } }
          ]
        }
      ]
    });
    const projectedMemento = projectSemanticDocumentToStructuredEffects(memento);
    expect(projectedMemento.structuredEffects.map((effect) => effect.action.$type)).toEqual(["TActionPlayerHeal", "TActionPlayerPreventDamage"]);
    expect(projectedMemento.structuredEffects[1].action).toMatchObject({
      SourceAction: "prevent_damage",
      Value: { $type: "TFixedValue", Value: 5 }
    });
    expect(projectedMemento.structuredEffects[0].trigger).toMatchObject({
      $type: "TTriggerOnPlayerWouldBeDefeated",
      SourceEvent: "would_be_defeated",
      Limit: { Mode: "First", Reset: "Fight" }
    });

    expect(
      projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["When this is transformed, Enchant it with Toxic if able"], tags))
        .structuredEffects[0].trigger
    ).toMatchObject({ $type: "TTriggerOnCardTransformed", SourceEvent: "transformed" });

    expect(
      projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["When this is destroyed, Burn 100 Burn"], tags)).structuredEffects[0]
        .trigger
    ).toMatchObject({ $type: "TTriggerOnCardDestroyed", SourceEvent: "destroyed" });

    expect(
      projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["When this runs out of ammo, Poison both Players 100 Poison"], tags))
        .structuredEffects[0].trigger
    ).toMatchObject({ $type: "TTriggerOnCardAmmoEmpty", SourceEvent: "ammo_empty" });

    expect(
      projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["When you win a fight with this, your Properties permanently gain 5 value"], tags))
        .structuredEffects[0].trigger
    ).toMatchObject({ $type: "TTriggerOnCombatWon", SourceEvent: "win" });

    expect(
      projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["When you lose a fight with this, permanently destroy it"], tags))
        .structuredEffects[0].trigger
    ).toMatchObject({ $type: "TTriggerOnCombatLost", SourceEvent: "lose" });

    expect(
      projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["When you stop being Enraged, Cleanse half your Burn and Poison"], tags))
        .structuredEffects[0].trigger
    ).toMatchObject({ $type: "TTriggerOnStatusEnded", SourceEvent: "status_ended", Status: "enraged" });

    expect(parseStructuredEffectsFromTexts(["When this starts Flying, Shield 75 Shield"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        Subject: { $type: "TTargetCardSelf" },
        EffectPredicate: { $type: "TEffectPredicateFamily", Family: "flying" }
      },
      action: { $type: "TActionPlayerShieldApply", SourceAction: "shield", Value: { $type: "TFixedValue", Value: 75 } }
    });

    expect(parseStructuredEffectsFromTexts(["When this stops Flying, destroy it"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnStatusEnded",
        SourceEvent: "status_ended",
        Status: "flying",
        Subject: { $type: "TTargetCardSelf" }
      },
      action: { $type: "TActionCardDestroy", SourceAction: "destroy", Target: { $type: "TTargetCardTriggerSource" } }
    });

    const busterDestroyTargets = parseStructuredEffectsFromTexts(
      ["When this stops Flying, deal Damage equal to 20% of your enemy's Max Health, then destroy this and an enemy item"],
      tags
    );
    expect(busterDestroyTargets).toHaveLength(3);
    expect(busterDestroyTargets.map((effect) => effect.action)).toMatchObject([
      { $type: "TActionPlayerDamage" },
      { $type: "TActionCardDestroy", Target: { $type: "TTargetCardSelf" } },
      { $type: "TActionCardDestroy", Target: { $type: "TTargetCardRandom", TargetSection: "OpponentBoard" } }
    ]);

    const seekerProbeDestroyTargets = parseStructuredEffectsFromTexts(["When you Crit with this, destroy this and a Small enemy item"], tags);
    expect(seekerProbeDestroyTargets).toHaveLength(2);
    expect(seekerProbeDestroyTargets.map((effect) => effect.action)).toMatchObject([
      { $type: "TActionCardDestroy", Target: { $type: "TTargetCardSelf" } },
      {
        $type: "TActionCardDestroy",
        Target: { $type: "TTargetCardRandom", TargetSection: "OpponentBoard", Conditions: [{ $type: "TCardConditionalSize", Sizes: [1] }] }
      }
    ]);

    const vehicleOrDroneStartsFlying = parseStructuredEffectsFromTexts(["When your Vehicles or Drones start Flying, this starts Flying"], tags)[0];
    expect(vehicleOrDroneStartsFlying).toMatchObject({
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        Subject: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "AnyOf", Tags: ["vehicle", "drone"] } }]
        },
        EffectPredicate: { $type: "TEffectPredicateFamily", Family: "flying" }
      },
      action: {
        $type: "TActionStatusModify",
        SourceAction: "modify_status",
        Operation: "Add",
        Status: "flying",
        Target: { $type: "TTargetCardSelf" }
      }
    });
    expect(vehicleOrDroneStartsFlying.trigger?.Subject).not.toMatchObject({
      Conditions: [{ $type: "TCardConditionalTag", Tags: ["vehicle"] }]
    });
    expect(parseStructuredEffectsFromTexts(["This stops Flying"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionStatusModify",
        SourceAction: "modify_status",
        Operation: "Subtract",
        Status: "flying",
        Target: { $type: "TTargetCardSelf" }
      }
    });
    expect(parseStructuredEffectsFromTexts(["This starts or stops Flying"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionStatusModify",
        SourceAction: "modify_status",
        Operation: "Toggle",
        Status: "flying",
        Target: { $type: "TTargetCardSelf" }
      }
    });
    expect(parseStructuredEffectsFromTexts(["Adjacent items start or stop Flying"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionStatusModify",
        SourceAction: "modify_status",
        Operation: "Toggle",
        Status: "flying",
        Target: { $type: "TTargetCardPositional", TargetMode: "Neighbor" }
      }
    });
    expect(parseStructuredEffectsFromTexts(["Adjacent items start or stop Flying"], tags)[0].action.Target).not.toMatchObject({
      Conditions: [{ $type: "TCardConditionalTag", Tags: ["flying"] }]
    });
    expect(parseStructuredEffectsFromTexts(["When your items start or stop Flying, this gains 125 Damage"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnStatusChanged",
        SourceEvent: "status_changed",
        Status: "flying",
        Subject: { $type: "TTargetCardSection", TargetSection: "SelfHand" }
      },
      action: { $type: "TActionCardModifyAttribute", AttributeType: "DamageAmount", Value: { $type: "TFixedValue", Value: 125 } }
    });

    expect(parseStructuredEffectsFromTexts(["Haste the item to the right for 1 Haste second(s) and it starts Flying"], tags)).toMatchObject([
      {
        action: {
          $type: "TActionCardHaste",
          Target: { $type: "TTargetCardPositional", TargetMode: "RightCard" }
        }
      },
      {
        rawText: "it starts Flying",
        action: {
          $type: "TActionStatusModify",
          Operation: "Add",
          Status: "flying",
          Target: { $type: "TTargetCardPositional", TargetMode: "RightCard" }
        }
      }
    ]);

    expect(parseStructuredEffectsFromTexts(["When you use an adjacent item, deal 20 Damage Damage and it starts Flying"], tags)).toMatchObject([
      { action: { $type: "TActionPlayerDamage" } },
      {
        rawText: "When you use an adjacent item, it starts Flying",
        action: {
          $type: "TActionStatusModify",
          Operation: "Add",
          Status: "flying",
          Target: { $type: "TTargetCardTriggerSource" }
        }
      }
    ]);

    const compoundAdjacentToggle = parseStructuredEffectsFromTexts(["This and an adjacent item start or stop Flying"], tags);
    expect(compoundAdjacentToggle).toHaveLength(2);
    expect(compoundAdjacentToggle.map((effect) => effect.action.Operation)).toEqual(["Toggle", "Toggle"]);
    expect(compoundAdjacentToggle.map((effect) => effect.action.Target)).toMatchObject([
      { $type: "TTargetCardSelf" },
      { $type: "TTargetCardPositional", TargetMode: "Neighbor" }
    ]);

    const compoundItThis = parseStructuredEffectsFromTexts(["When you use an adjacent item, it and this start Flying"], tags);
    expect(compoundItThis).toHaveLength(2);
    expect(compoundItThis.map((effect) => effect.trigger)).toMatchObject([
      { $type: "TTriggerOnItemUsed", SourceEvent: "adjacent_item_used", Subject: { $type: "TTargetCardPositional", TargetMode: "Neighbor" } },
      { $type: "TTriggerOnItemUsed", SourceEvent: "adjacent_item_used", Subject: { $type: "TTargetCardPositional", TargetMode: "Neighbor" } }
    ]);
    expect(compoundItThis.map((effect) => effect.action.Target)).toMatchObject([
      { $type: "TTargetCardTriggerSource" },
      { $type: "TTargetCardSelf" }
    ]);

    const compoundThisIt = parseStructuredEffectsFromTexts(["When you use another Flying item, this and it stop Flying"], tags);
    expect(compoundThisIt).toHaveLength(2);
    expect(compoundThisIt.map((effect) => effect.action.Operation)).toEqual(["Subtract", "Subtract"]);
    expect(compoundThisIt.map((effect) => effect.action.Target)).toMatchObject([
      { $type: "TTargetCardSelf" },
      { $type: "TTargetCardTriggerSource" }
    ]);

    const compoundSelfRandom = parseStructuredEffectsFromTexts(["This and an item start Flying"], tags);
    expect(compoundSelfRandom.map((effect) => effect.action.Target)).toMatchObject([
      { $type: "TTargetCardSelf" },
      { $type: "TTargetCardRandom", TargetSection: "SelfHand" }
    ]);

    const compoundSelfAnother = parseStructuredEffectsFromTexts(["This and another item start Flying"], tags);
    expect(compoundSelfAnother.map((effect) => effect.action.Target)).toMatchObject([
      { $type: "TTargetCardSelf" },
      { $type: "TTargetCardRandom", TargetSection: "SelfHand", ExcludeSelf: true }
    ]);

    expect(parseStructuredEffectsFromTexts(["Another Small item starts Flying"], tags)[0].action.Target).toMatchObject({
      $type: "TTargetCardRandom",
      TargetSection: "SelfHand",
      ExcludeSelf: true,
      Conditions: [{ $type: "TCardConditionalSize", Sizes: [1] }]
    });
    expect(parseStructuredEffectsFromTexts(["A Small item starts Flying"], tags)[0].action.Target).toMatchObject({
      $type: "TTargetCardRandom",
      TargetSection: "SelfHand",
      Conditions: [{ $type: "TCardConditionalSize", Sizes: [1] }]
    });
    expect(parseStructuredEffectsFromTexts(["1 item starts Flying"], tags)[0].action.Target).toMatchObject({
      $type: "TTargetCardRandom",
      TargetSection: "SelfHand"
    });
    expect(parseStructuredEffectsFromTexts(["A Vehicle starts Flying"], tags)[0].action.Target).toMatchObject({
      $type: "TTargetCardRandom",
      TargetSection: "SelfHand",
      Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "vehicle" } }]
    });
    const twoVehiclesFlying = parseStructuredEffectsFromTexts(["2 Vehicles start Flying"], tags)[0];
    expect(twoVehiclesFlying.action.Target).toMatchObject({
      $type: "TTargetCardSection",
      TargetSection: "SelfHand",
      Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "vehicle" } }]
    });
    expect(twoVehiclesFlying.projectionStatus).toBe("partial");
    expect(twoVehiclesFlying.projectionWarnings?.[0]).toContain("does not preserve exact count");

    const deathFromAbove = parseStructuredEffectsFromTexts(
      ["When you Enrage, 1 of your items start Flying, then Charge your Flying items 1 Charge second"],
      tags
    );
    expect(deathFromAbove).toHaveLength(2);
    expect(deathFromAbove.map((effect) => effect.trigger)).toMatchObject([
      { $type: "TTriggerOnEnrage", SourceEvent: "enrage" },
      { $type: "TTriggerOnEnrage", SourceEvent: "enrage" }
    ]);
    expect(deathFromAbove.map((effect) => effect.action)).toMatchObject([
      {
        $type: "TActionStatusModify",
        SourceAction: "modify_status",
        Operation: "Add",
        Status: "flying",
        Target: { $type: "TTargetCardRandom", TargetSection: "SelfHand" }
      },
      {
        $type: "TActionCardCharge",
        SourceAction: "charge",
        Value: { $type: "TFixedValue", Value: 1 },
        Target: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          Conditions: [{ $type: "TCardConditionalStatus", Status: "flying" }]
        }
      }
    ]);
  });

  it("parses Infernal Greatsword active tooltip patterns without unknown fallbacks", () => {
    expect(parseEffectView("Deal 2 Damage Damage")).toMatchObject({
      trigger: { event: "cooldown_ready" },
      action: { type: "damage", value: 2 },
      target: { scope: "enemy" },
      rawText: "Deal 2 Damage Damage"
    });
    expect(parseEffectView("Burn equal to this item's Damage")).toMatchObject({
      trigger: { event: "cooldown_ready" },
      action: { type: "burn" },
      target: { scope: "enemy" },
      rawText: "Burn equal to this item's Damage"
    });
    expect(parseEffectView("This gains Damage equal to an enemy's Burn")).toEqual({
      trigger: { event: "cooldown_ready" },
      action: { type: "gain_stat", stat: "damage" },
      target: { scope: "self" },
      rawText: "This gains Damage equal to an enemy's Burn"
    });
  });

  it("parses common passive and utility tooltip patterns without unknown fallbacks", () => {
    expect(parseEffectView("Multicast: 2")).toMatchObject({
      trigger: { event: "always" },
      action: { type: "multicast", value: 2 },
      target: { scope: "self" }
    });
    expect(parseEffectView("Regen 3 Regen")).toMatchObject({
      trigger: { event: "always" },
      action: { type: "regen", value: 3 },
      target: { scope: "self" }
    });
    expect(parseEffectView("Lifesteal")).toMatchObject({
      trigger: { event: "always" },
      action: { type: "lifesteal" },
      target: { scope: "self" }
    });
    expect(parseEffectView("An adjacent item starts Flying")).toMatchObject({
      trigger: { event: "cooldown_ready" },
      action: { type: "modify_status" },
      target: { scope: "adjacent" }
    });
    expect(parseEffectView("At the start of each day, get a Catalyst")).toMatchObject({
      trigger: { event: "day_started" },
      action: { type: "gain_item" },
      target: { scope: "self" }
    });
    expect(parseEffectView("Reload adjacent items")).toMatchObject({
      trigger: { event: "cooldown_ready" },
      action: { type: "reload" },
      target: { scope: "adjacent" }
    });
    expect(parseEffectView("Sells for Gold")).toMatchObject({
      trigger: { event: "sell" },
      action: { type: "gain_gold" },
      target: { scope: "self" }
    });
    expect(parseEffectView("The first time you use this, this item's Cooldown is halved")).toMatchObject({
      trigger: { event: "item_used" },
      action: { type: "reduce_cooldown" },
      target: { scope: "self" }
    });
    expect(parseEffectView("The first time you fall below half Health each fight, use this")).toMatchObject({
      trigger: { event: "player_attribute_threshold" },
      action: { type: "use" },
      target: { scope: "self" }
    });
  });

  it("parses always-on type assignment effects without treating assigned tags as target filters", () => {
    expect(parseEffectView("Your leftmost item is a Relic")).toEqual({
      trigger: { event: "always" },
      action: { type: "buff_tag", tag: "relic" },
      target: { scope: "leftmost" },
      rawText: "Your leftmost item is a Relic"
    });
    expect(parseEffectView("Your rightmost item is a Vehicle")).toMatchObject({
      trigger: { event: "always" },
      action: { type: "buff_tag", tag: "vehicle" },
      target: { scope: "rightmost" }
    });
    expect(parseEffectView("Your Relics are Tech")).toMatchObject({
      trigger: { event: "always" },
      action: { type: "buff_tag", tag: "tech" },
      target: { scope: "allied_items", tag: "relic" }
    });
  });

  it("splits compound type assignment and cooldown aura text into explainable effects", () => {
    expect(parseEffectViews(["Your leftmost item is a Relic and has its cooldown reduced by 3%"])).toMatchObject([
      {
        trigger: { event: "always" },
        action: { type: "buff_tag", tag: "relic" },
        target: { scope: "leftmost" },
        rawText: "Your leftmost item is a Relic"
      },
      {
        trigger: { event: "always" },
        action: { type: "reduce_cooldown", value: 3 },
        target: { scope: "leftmost" },
        rawText: "Your leftmost item has its cooldown reduced by 3%"
      }
    ]);
  });

  it("parses first-N-times fight triggers into concrete trigger events", () => {
    expect(parseEffectView("The first 3 times you use a Relic each fight, Freeze an item for 1 Freeze second")).toMatchObject({
      trigger: { event: "tag_item_used", tag: "relic" },
      action: { type: "freeze", value: 1 },
      target: { scope: "enemy_items" }
    });
    expect(parseEffectView("The first 5 times you Crit each fight, Charge an item 1 Charge second(s)")).toMatchObject({
      trigger: { event: "crit" },
      action: { type: "charge", value: 1 },
      target: { scope: "allied_items" }
    });
  });

  it("projects no-damage duration effects as damage prevention, not shield", () => {
    expect(parseStructuredEffectsFromTexts(["The first 3 times you Crit each fight, you take no Damage for 1 second"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnCardCritted",
        SourceEvent: "crit",
        Limit: { Mode: "MaxTimes", Count: 3, Reset: "Fight", Scope: "SourceEffectInstance" }
      },
      action: {
        $type: "TActionPlayerPreventDamage",
        SourceAction: "prevent_damage",
        Value: { $type: "TFixedValue", Value: 1 },
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" }
      }
    });

    const wouldBeDefeated = parseStructuredEffectsFromTexts(
      ["The first time you would be defeated each fight, Heal 1 Heal and take no Damage for 1 second(s)"],
      tags
    );
    expect(wouldBeDefeated.map((effect) => effect.action.$type)).toEqual(["TActionPlayerHeal", "TActionPlayerPreventDamage"]);
    expect(wouldBeDefeated[1]).toMatchObject({
      trigger: {
        $type: "TTriggerOnPlayerWouldBeDefeated",
        SourceEvent: "would_be_defeated",
        Limit: { Mode: "First", Count: 1, Reset: "Fight", Scope: "SourceEffectInstance" }
      },
      action: {
        SourceAction: "prevent_damage",
        Value: { $type: "TFixedValue", Value: 1 },
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" }
      }
    });

    const enrageDestroyThenPrevent = parseStructuredEffectsFromTexts(
      ["When you become Enraged, destroy this and you take no damage for 2 seconds"],
      tags
    );
    expect(enrageDestroyThenPrevent.map((effect) => effect.action.$type)).toEqual(["TActionCardDestroy", "TActionPlayerPreventDamage"]);
    expect(enrageDestroyThenPrevent[1]).toMatchObject({
      trigger: { $type: "TTriggerOnEnrage", SourceEvent: "enrage" },
      action: {
        SourceAction: "prevent_damage",
        Value: { $type: "TFixedValue", Value: 2 }
      }
    });

    const halfHealthPreventAndRegen = parseStructuredEffectsFromTexts(
      ["The first time you fall below half Health each fight, you take no Damage for 1 second(s) and gain 25 Regen"],
      tags
    );
    expect(halfHealthPreventAndRegen.map((effect) => effect.action.$type)).toEqual(["TActionPlayerPreventDamage", "TActionCardModifyAttribute"]);
    expect(halfHealthPreventAndRegen[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnPlayerAttributeThresholdCrossed",
        SourceEvent: "player_attribute_threshold",
        Limit: { Mode: "First", Count: 1, Reset: "Fight", Scope: "SourceEffectInstance" }
      },
      action: { SourceAction: "prevent_damage", Value: { $type: "TFixedValue", Value: 1 } }
    });
  });

  it("projects damage reduction as incoming damage effect modifiers", () => {
    expect(parseStructuredEffectsFromTexts(["You take 30% less damage"], tags)[0]).toMatchObject({
      kind: "aura",
      action: {
        $type: "TActionEffectModify",
        SourceAction: "modify_effect",
        AttributeType: "EffectMagnitude",
        Operation: "Multiply",
        Value: { $type: "TFixedValue", Value: 0.7 },
        Target: {
          $type: "TTargetEffect",
          Entity: "EffectInstance",
          Owner: "Opponent",
          Recipient: { $type: "TTargetPlayerRelative", TargetMode: "Self" },
          Predicate: { $type: "TEffectPredicateFamily", Family: "damage" }
        }
      },
      projectionStatus: "exact"
    });

    expect(parseStructuredEffectsFromTexts(["When the Sandstorm starts you take 25% less Damage for the rest of the fight"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        EffectPredicate: { $type: "TEffectPredicateFamily", Family: "sandstorm" }
      },
      action: {
        $type: "TActionEffectModify",
        SourceAction: "modify_effect",
        Value: { $type: "TFixedValue", Value: 0.75 },
        Target: { Recipient: { $type: "TTargetPlayerRelative", TargetMode: "Self" } },
        ApplicationTiming: "Continuous"
      },
      projectionStatus: "exact"
    });

    expect(parseStructuredEffectsFromTexts(["You take 10% less damage for each non-Glider Flying item you have"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionEffectModify",
        SourceAction: "modify_effect",
        Value: {
          $type: "TExpressionValue",
          Operator: "Subtract",
          Values: [
            { $type: "TFixedValue", Value: 1 },
            {
              $type: "TExpressionValue",
              Operator: "Multiply",
              Values: [
                { $type: "TFixedValue", Value: 0.1 },
                {
                  $type: "TReferenceValueCardCount",
                  Target: {
                    $type: "TTargetCardSection",
                    Conditions: [
                      { $type: "TCardConditionalTagExpr", Expr: { $type: "NoneOf", Tags: ["glider"] } },
                      { $type: "TCardConditionalStatus", Status: "flying" }
                    ]
                  }
                }
              ]
            }
          ]
        }
      },
      projectionStatus: "exact"
    });
  });

  it("projects generic first-time each-fight limits and half-health thresholds in structured IR", () => {
    expect(parseStructuredEffectsFromTexts(["The first 3 times you use a Relic each fight, Freeze an item for 1 Freeze second"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnItemUsed",
        SourceEvent: "tag_item_used",
        Tag: "relic",
        Limit: { Mode: "MaxTimes", Count: 3, Reset: "Fight", Scope: "SourceEffectInstance" }
      },
      action: { $type: "TActionCardFreeze", SourceAction: "freeze", Value: { $type: "TFixedValue", Value: 1 } }
    });

    expect(parseStructuredEffectsFromTexts(["The first 4 times you use a Drone or Vehicle each fight, Burn 5 Burn"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnItemUsed",
        SourceEvent: "item_used",
        Subject: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "AnyOf", Tags: ["drone", "vehicle"] } }]
        },
        Limit: { Mode: "MaxTimes", Count: 4, Reset: "Fight", Scope: "SourceEffectInstance" }
      },
      action: { $type: "TActionPlayerBurnApply", SourceAction: "burn", Value: { $type: "TFixedValue", Value: 5 } }
    });

    expect(parseStructuredEffectsFromTexts(["The first time you use this, this item's Cooldown is halved"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnItemUsed",
        SourceEvent: "item_used",
        Limit: { Mode: "First", Count: 1, Reset: "Never", Scope: "SourceEffectInstance" }
      }
    });

    expect(parseStructuredEffectsFromTexts(["The first time you fall below half Health each fight, use this"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnPlayerAttributeThresholdCrossed",
        SourceEvent: "player_attribute_threshold",
        AttributeType: "Health",
        Crossing: "FromAtOrAboveToBelow",
        Threshold: {
          $type: "TExpressionValue",
          Operator: "Multiply",
          Values: [
            { $type: "TFixedValue", Value: 0.5 },
            { $type: "TReferenceValuePlayerAttribute", AttributeType: "HealthMax" }
          ]
        },
        Limit: { Mode: "First", Count: 1, Reset: "Fight", Scope: "SourceEffectInstance" }
      },
      action: { $type: "TActionCardForceUse", SourceAction: "use" }
    });

    expect(parseStructuredEffectsFromTexts(["The first time you fall below 50% Health each fight, Reload 1 item(s)"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnPlayerAttributeThresholdCrossed",
        SourceEvent: "player_attribute_threshold",
        AttributeType: "Health",
        Subject: { $type: "TTargetPlayerRelative", TargetMode: "Self" },
        Threshold: {
          $type: "TExpressionValue",
          Operator: "Multiply",
          Values: [
            { $type: "TFixedValue", Value: 0.5 },
            {
              $type: "TReferenceValuePlayerAttribute",
              Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" },
              AttributeType: "HealthMax"
            }
          ]
        },
        Crossing: "FromAtOrAboveToBelow",
        Limit: { Mode: "First", Count: 1, Reset: "Fight", Scope: "SourceEffectInstance" }
      },
      action: { $type: "TActionCardReload", SourceAction: "reload", Value: { $type: "TFixedValue", Value: 1 } }
    });

    expect(parseStructuredEffectsFromTexts(["The first time an enemy falls below half Health each fight, Burn 10 Burn"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnPlayerAttributeThresholdCrossed",
        SourceEvent: "player_attribute_threshold",
        AttributeType: "Health",
        Subject: { $type: "TTargetPlayerRelative", TargetMode: "Opponent" },
        Threshold: {
          $type: "TExpressionValue",
          Values: [
            { $type: "TFixedValue", Value: 0.5 },
            {
              $type: "TReferenceValuePlayerAttribute",
              Target: { $type: "TTargetPlayerRelative", TargetMode: "Opponent" },
              AttributeType: "HealthMax"
            }
          ]
        },
        Crossing: "FromAtOrAboveToBelow",
        Limit: { Mode: "First", Count: 1, Reset: "Fight", Scope: "SourceEffectInstance" }
      },
      action: { $type: "TActionPlayerBurnApply", SourceAction: "burn", Value: { $type: "TFixedValue", Value: 10 } }
    });

    expect(parseStructuredEffectsFromTexts(["The first time any item is used each fight, gain 30 Rage Rage"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnItemUsed",
        SourceEvent: "item_used",
        Limit: { Mode: "First", Count: 1, Reset: "Fight", Scope: "SourceEffectInstance" }
      },
      action: {
        $type: "TActionPlayerModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "Rage",
        Value: { $type: "TFixedValue", Value: 30 }
      }
    });

    expect(parseStructuredEffectsFromTexts(["The first time one of your items is Destroyed each fight, Charge all your items 3 Charge seconds"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnCardDestroyed",
        SourceEvent: "destroyed",
        Subject: { $type: "TTargetCardSection", TargetSection: "SelfHand" },
        Limit: { Mode: "First", Count: 1, Reset: "Fight", Scope: "SourceEffectInstance" }
      },
      action: {
        $type: "TActionCardCharge",
        SourceAction: "charge",
        Value: { $type: "TFixedValue", Value: 3 },
        Target: { $type: "TTargetCardSection", TargetSection: "SelfHand" }
      }
    });

    expect(parseStructuredEffectsFromTexts(["The first time you Haste each fight, Freeze an item for 2 Freeze second(s)"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        EffectPredicate: { $type: "TEffectPredicateFamily", Family: "haste" },
        Limit: { Mode: "First", Count: 1, Reset: "Fight", Scope: "SourceEffectInstance" }
      },
      action: { $type: "TActionCardFreeze", SourceAction: "freeze", Value: { $type: "TFixedValue", Value: 2 } }
    });

    expect(parseStructuredEffectsFromTexts(["The first time you Burn each fight, Freeze an item for 2 Freeze second(s)"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnCardPerformedBurn",
        SourceEvent: "apply_burn",
        Limit: { Mode: "First", Count: 1, Reset: "Fight", Scope: "SourceEffectInstance" }
      },
      action: { $type: "TActionCardFreeze", SourceAction: "freeze", Value: { $type: "TFixedValue", Value: 2 } }
    });

    expect(parseStructuredEffectsFromTexts(["The first time you Poison each fight, Freeze an item for 2 Freeze second(s)"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnCardPerformedPoison",
        SourceEvent: "apply_poison",
        Limit: { Mode: "First", Count: 1, Reset: "Fight", Scope: "SourceEffectInstance" }
      },
      action: { $type: "TActionCardFreeze", SourceAction: "freeze", Value: { $type: "TFixedValue", Value: 2 } }
    });

    expect(parseStructuredEffectsFromTexts(["The first time you Crit each fight, Freeze an item for 3 Freeze second(s)"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnCardCritted",
        SourceEvent: "crit",
        Limit: { Mode: "First", Count: 1, Reset: "Fight", Scope: "SourceEffectInstance" }
      },
      action: { $type: "TActionCardFreeze", SourceAction: "freeze", Value: { $type: "TFixedValue", Value: 3 } }
    });

    expect(parseStructuredEffectsFromTexts(["The first time you Over-Heal each fight, Haste your items for 1 Haste second(s)"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnCardPerformedHeal",
        SourceEvent: "heal",
        Limit: { Mode: "First", Count: 1, Reset: "Fight", Scope: "SourceEffectInstance" }
      },
      action: { $type: "TActionCardHaste", SourceAction: "haste", Value: { $type: "TFixedValue", Value: 1 } }
    });

    expect(parseStructuredEffectsFromTexts(["The first time you Freeze, Burn, Slow, Poison, and Haste each fight, Charge an item 1 Charge second(s)"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnEffectSequenceCompleted",
        SourceEvent: "effect_sequence_completed",
        EffectPredicate: {
          $type: "TEffectPredicateAnd",
          Predicates: [
            { $type: "TEffectPredicateFamily", Family: "freeze" },
            { $type: "TEffectPredicateFamily", Family: "burn" },
            { $type: "TEffectPredicateFamily", Family: "slow" },
            { $type: "TEffectPredicateFamily", Family: "poison" },
            { $type: "TEffectPredicateFamily", Family: "haste" }
          ]
        },
        Limit: { Mode: "First", Count: 1, Reset: "Fight", Scope: "SourceEffectInstance" }
      },
      action: { $type: "TActionCardCharge", SourceAction: "charge", Value: { $type: "TFixedValue", Value: 1 } }
    });

    expect(parseStructuredEffectsFromTexts(["The first 4 times you Slow each fight, Charge a Weapon 1 Charge second(s)"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        EffectPredicate: { $type: "TEffectPredicateFamily", Family: "slow" },
        Limit: { Mode: "MaxTimes", Count: 4, Reset: "Fight", Scope: "SourceEffectInstance" }
      },
      action: {
        $type: "TActionCardCharge",
        SourceAction: "charge",
        Target: { Conditions: [{ $type: "TCardConditionalTag", Tags: ["weapon"] }] }
      }
    });

    expect(parseStructuredEffectsFromTexts(["The first time you would be defeated each fight, Heal 200 Heal"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnPlayerWouldBeDefeated",
        SourceEvent: "would_be_defeated",
        Limit: { Mode: "First", Count: 1, Reset: "Fight", Scope: "SourceEffectInstance" }
      },
      action: { $type: "TActionPlayerHeal", SourceAction: "heal", Value: { $type: "TFixedValue", Value: 200 } }
    });

    const healToHalf = parseStructuredEffectsFromTexts(["If you have a Vehicle, the first time you would be defeated each fight, Heal to half health"], tags)[0];
    expect(healToHalf).toMatchObject({
      trigger: {
        $type: "TTriggerOnPlayerWouldBeDefeated",
        SourceEvent: "would_be_defeated",
        Limit: { Mode: "First", Count: 1, Reset: "Fight", Scope: "SourceEffectInstance" }
      },
      prerequisites: [{ $type: "TCardConditionalTag", Tags: ["vehicle"] }],
      action: {
        $type: "TActionPlayerModifyAttribute",
        SourceAction: "heal",
        AttributeType: "Health",
        Operation: "Set",
        Value: {
          $type: "TExpressionValue",
          Operator: "Multiply",
          Values: [
            { $type: "TFixedValue", Value: 0.5 },
            { $type: "TReferenceValuePlayerAttribute", AttributeType: "HealthMax" }
          ]
        },
        HealthSetMode: "HealToThreshold"
      },
      projectionStatus: "exact"
    });

    expect(parseStructuredEffectsFromTexts(["When you Slow, Burn 8 Burn"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        EffectPredicate: { $type: "TEffectPredicateFamily", Family: "slow" }
      },
      action: { $type: "TActionPlayerBurnApply", SourceAction: "burn", Value: { $type: "TFixedValue", Value: 8 } }
    });

    expect(parseStructuredEffectsFromTexts(["When you Freeze, Charge this 1 Charge second(s)"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        EffectPredicate: { $type: "TEffectPredicateFamily", Family: "freeze" }
      },
      action: { $type: "TActionCardCharge", SourceAction: "charge", Target: { $type: "TTargetCardSelf" } }
    });

    expect(parseStructuredEffectsFromTexts(["When you Haste, Charge this 2 Charge seconds"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        EffectPredicate: { $type: "TEffectPredicateFamily", Family: "haste" }
      },
      action: { $type: "TActionCardCharge", SourceAction: "charge", Value: { $type: "TFixedValue", Value: 2 } }
    });

    expect(parseStructuredEffectsFromTexts(["When you Regen, Charge this 2 Charge second(s)"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        EffectPredicate: { $type: "TEffectPredicateFamily", Family: "regen" }
      },
      action: { $type: "TActionCardCharge", SourceAction: "charge", Value: { $type: "TFixedValue", Value: 2 } }
    });

    const frozenOrSlowed = parseStructuredEffectsFromTexts(["When one of your items is Frozen or Slowed, Charge it 1 Charge second and Heal 25 Heal"], tags);
    expect(frozenOrSlowed.map((effect) => effect.action.$type)).toEqual(["TActionCardCharge", "TActionPlayerHeal"]);
    expect(frozenOrSlowed[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        EffectPredicate: {
          $type: "TEffectPredicateOr",
          Predicates: [
            { $type: "TEffectPredicateFamily", Family: "freeze" },
            { $type: "TEffectPredicateFamily", Family: "slow" }
          ]
        }
      },
      action: {
        SourceAction: "charge",
        Target: { $type: "TTargetCardTriggerSource" },
        Value: { $type: "TFixedValue", Value: 1 }
      }
    });
    expect(frozenOrSlowed[1]).toMatchObject({
      kind: "ability",
      trigger: { $type: "TTriggerOnEffectApplied", SourceEvent: "effect_applied" },
      action: { SourceAction: "heal", Value: { $type: "TFixedValue", Value: 25 } }
    });

    expect(parseStructuredEffectsFromTexts(["Heated: When you Slow, Burn 4 Burn"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        EffectPredicate: { $type: "TEffectPredicateFamily", Family: "slow" }
      },
      prerequisites: [{ $type: "TCardConditionalStatus", Status: "heated" }],
      action: { $type: "TActionPlayerBurnApply", SourceAction: "burn", Value: { $type: "TFixedValue", Value: 4 } }
    });

    expect(parseStructuredEffectsFromTexts(["When you Haste a Food, charge it 1 Charge second(s)"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        Subject: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          Conditions: [{ $type: "TCardConditionalTag", Tags: ["food"] }]
        },
        EffectPredicate: { $type: "TEffectPredicateFamily", Family: "haste" }
      },
      action: { $type: "TActionCardCharge", SourceAction: "charge", Target: { $type: "TTargetCardTriggerSource" } }
    });

    expect(parseStructuredEffectsFromTexts([
      "Haste adjacent items for 1 Haste second(s)",
      "When you Haste a Food, charge it 1 Charge second(s)"
    ], tags)[1]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        Subject: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          Conditions: [{ $type: "TCardConditionalTag", Tags: ["food"] }]
        },
        EffectPredicate: { $type: "TEffectPredicateFamily", Family: "haste" }
      },
      action: { $type: "TActionCardCharge", SourceAction: "charge", Target: { $type: "TTargetCardTriggerSource" } }
    });

    expect(parseStructuredEffectsFromTexts(["When you use an item, it gains 5 Crit% Crit Chance"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnItemUsed",
        SourceEvent: "item_used",
        Subject: { $type: "TTargetCardSection", TargetSection: "SelfHand" }
      },
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "CritChance",
        Target: { $type: "TTargetCardTriggerSource" }
      }
    });

    expect(parseStructuredEffectsFromTexts(["When any item is Frozen, Charge this 1 Charge second(s)"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        Subject: { $type: "TTargetCardSection", TargetSection: "AllHands" },
        EffectPredicate: { $type: "TEffectPredicateFamily", Family: "freeze" }
      },
      action: { $type: "TActionCardCharge", SourceAction: "charge", Target: { $type: "TTargetCardSelf" } }
    });

    expect(parseStructuredEffectsFromTexts(["When ANY item is Frozen, Shield 50 Shield"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        Subject: { $type: "TTargetCardSection", TargetSection: "AllHands" },
        EffectPredicate: { $type: "TEffectPredicateFamily", Family: "freeze" }
      },
      action: { $type: "TActionPlayerShieldApply", SourceAction: "shield", Value: { $type: "TFixedValue", Value: 50 } }
    });

    expect(parseStructuredEffectsFromTexts(["When one of your items is Slowed, Haste it for 1 Haste second(s)"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        Subject: { $type: "TTargetCardSection", TargetSection: "SelfHand" },
        EffectPredicate: { $type: "TEffectPredicateFamily", Family: "slow" }
      },
      action: { $type: "TActionCardHaste", SourceAction: "haste", Target: { $type: "TTargetCardTriggerSource" } }
    });

    expect(parseStructuredEffectsFromTexts(["When this item is Frozen, remove Freeze from it"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        Subject: { $type: "TTargetCardSelf" },
        EffectPredicate: { $type: "TEffectPredicateFamily", Family: "freeze" }
      },
      action: {
        $type: "TActionStatusModify",
        SourceAction: "modify_status",
        Operation: "Subtract",
        Target: { $type: "TTargetCardSelf" },
        Status: "freeze"
      }
    });

    expect(parseStructuredEffectsFromTexts(["When any non-Weapon is used, Charge this 1 Charge second(s)"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnItemUsed",
        SourceEvent: "item_used",
        Subject: {
          $type: "TTargetCardSection",
          TargetSection: "AllHands",
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "NoneOf", Tags: ["weapon"] } }]
        }
      },
      action: { $type: "TActionCardCharge", SourceAction: "charge", Target: { $type: "TTargetCardSelf" } }
    });

    expect(parseStructuredEffectsFromTexts(["When ANY Tech item is used, Poison 3 Poison"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnItemUsed",
        SourceEvent: "item_used",
        Subject: {
          $type: "TTargetCardSection",
          TargetSection: "AllHands",
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "tech" } }]
        }
      },
      action: { $type: "TActionPlayerPoisonApply", SourceAction: "poison", Value: { $type: "TFixedValue", Value: 3 } }
    });

    expect(parseStructuredEffectsFromTexts(["When any other item is used, Charge this 1 Charge second"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnItemUsed",
        SourceEvent: "item_used",
        Subject: { $type: "TTargetCardSection", TargetSection: "AllHands", ExcludeSelf: true }
      },
      action: { $type: "TActionCardCharge", SourceAction: "charge", Target: { $type: "TTargetCardSelf" } }
    });

    expect(parseStructuredEffectsFromTexts(["When any non-Weapon item is used, Slow it for 1 Slow second(s)"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnItemUsed",
        SourceEvent: "item_used",
        Subject: {
          $type: "TTargetCardSection",
          TargetSection: "AllHands",
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "NoneOf", Tags: ["weapon"] } }]
        }
      },
      action: { $type: "TActionCardSlow", SourceAction: "slow", Target: { $type: "TTargetCardTriggerSource" } }
    });

    expect(parseStructuredEffectsFromTexts(["The first time an enemy uses an item each fight, Slow their items for 1 Slow second(s)"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: { $type: "TTriggerOnItemUsed", SourceEvent: "item_used" },
      action: { $type: "TActionCardSlow", SourceAction: "slow", Target: { $type: "TTargetCardSection", TargetSection: "OpponentBoard" } }
    });

    const adjacentBurn = parseStructuredEffectsFromTexts(["When an adjacent item Burns, Charge this 1 Charge second(s)"], tags)[0];
    expect(adjacentBurn).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnCardPerformedBurn",
        SourceEvent: "apply_burn",
        Subject: { $type: "TTargetCardPositional", TargetMode: "Neighbor" }
      },
      action: { $type: "TActionCardCharge", SourceAction: "charge", Target: { $type: "TTargetCardSelf" } }
    });
    expect(adjacentBurn.trigger?.Subject).not.toHaveProperty("Conditions");

    const adjacentPoison = parseStructuredEffectsFromTexts(["When an adjacent item Poisons, Charge this 1 Charge second(s)"], tags)[0];
    expect(adjacentPoison).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnCardPerformedPoison",
        SourceEvent: "apply_poison",
        Subject: { $type: "TTargetCardPositional", TargetMode: "Neighbor" }
      },
      action: { $type: "TActionCardCharge", SourceAction: "charge", Target: { $type: "TTargetCardSelf" } }
    });
    expect(adjacentPoison.trigger?.Subject).not.toHaveProperty("Conditions");

    expect(parseStructuredEffectsFromTexts(["When an adjacent item Poisons or Burns, Charge this 1 Charge second(s)"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        Subject: { $type: "TTargetCardPositional", TargetMode: "Neighbor" },
        EffectPredicate: {
          $type: "TEffectPredicateOr",
          Predicates: [
            { $type: "TEffectPredicateFamily", Family: "poison" },
            { $type: "TEffectPredicateFamily", Family: "burn" }
          ]
        }
      },
      action: { $type: "TActionCardCharge", SourceAction: "charge", Target: { $type: "TTargetCardSelf" } }
    });

    expect(parseStructuredEffectsFromTexts(["When you Haste or Slow, Charge this 1 Charge second(s)"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        EffectPredicate: {
          $type: "TEffectPredicateOr",
          Predicates: [
            { $type: "TEffectPredicateFamily", Family: "haste" },
            { $type: "TEffectPredicateFamily", Family: "slow" }
          ]
        }
      },
      action: { $type: "TActionCardCharge", SourceAction: "charge", Target: { $type: "TTargetCardSelf" } }
    });

    expect(parseStructuredEffectsFromTexts(["When you Freeze or Slow, deal 25 Damage Damage"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        EffectPredicate: {
          $type: "TEffectPredicateOr",
          Predicates: [
            { $type: "TEffectPredicateFamily", Family: "freeze" },
            { $type: "TEffectPredicateFamily", Family: "slow" }
          ]
        }
      },
      action: { $type: "TActionPlayerDamage", SourceAction: "damage", Value: { $type: "TFixedValue", Value: 25 } }
    });

    expect(parseStructuredEffectsFromTexts(["When you Haste, Slow, Poison, Freeze, or Burn, Charge this 2 Charge seconds"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        EffectPredicate: {
          $type: "TEffectPredicateOr",
          Predicates: [
            { $type: "TEffectPredicateFamily", Family: "haste" },
            { $type: "TEffectPredicateFamily", Family: "slow" },
            { $type: "TEffectPredicateFamily", Family: "poison" },
            { $type: "TEffectPredicateFamily", Family: "freeze" },
            { $type: "TEffectPredicateFamily", Family: "burn" }
          ]
        }
      },
      action: { $type: "TActionCardCharge", SourceAction: "charge", Target: { $type: "TTargetCardSelf" } }
    });

    const primordial = parseStructuredEffectsFromTexts(
      ["When you Poison, Freeze, or Burn, Charge this 2 Charge second(s) and this gains 15 Damage"],
      tags
    );
    expect(primordial).toHaveLength(2);
    expect(primordial.map((effect) => effect.action.$type)).toEqual(["TActionCardCharge", "TActionCardModifyAttribute"]);
    expect(primordial[0].trigger).toMatchObject({
      $type: "TTriggerOnEffectApplied",
      SourceEvent: "effect_applied",
      EffectPredicate: {
        $type: "TEffectPredicateOr",
        Predicates: [
          { $type: "TEffectPredicateFamily", Family: "poison" },
          { $type: "TEffectPredicateFamily", Family: "freeze" },
          { $type: "TEffectPredicateFamily", Family: "burn" }
        ]
      }
    });
    expect(primordial[1].trigger).toMatchObject(primordial[0].trigger ?? {});

    expect(parseStructuredEffectsFromTexts(["When you Poison or Regen, your items gain 4 Damage"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        EffectPredicate: {
          $type: "TEffectPredicateOr",
          Predicates: [
            { $type: "TEffectPredicateFamily", Family: "poison" },
            { $type: "TEffectPredicateFamily", Family: "regen" }
          ]
        }
      },
      action: { $type: "TActionCardModifyAttribute", SourceAction: "gain_stat", Target: { $type: "TTargetCardSection", TargetSection: "SelfHand" } }
    });

    const adjacentHasteOrSlow = parseStructuredEffectsFromTexts(["When an adjacent item Hastes or Slows, Charge this 1 Charge second(s)"], tags)[0];
    expect(adjacentHasteOrSlow).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        Subject: { $type: "TTargetCardPositional", TargetMode: "Neighbor" },
        EffectPredicate: {
          $type: "TEffectPredicateOr",
          Predicates: [
            { $type: "TEffectPredicateFamily", Family: "haste" },
            { $type: "TEffectPredicateFamily", Family: "slow" }
          ]
        }
      },
      action: { $type: "TActionCardCharge", SourceAction: "charge", Target: { $type: "TTargetCardSelf" } }
    });
    expect(adjacentHasteOrSlow.trigger?.Subject).not.toHaveProperty("Conditions");

    expect(parseStructuredEffectsFromTexts(["When you Haste or Slow a Tool, it gains 5 Damage"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        Subject: { $type: "TTargetCardSection", TargetSection: "SelfHand", Conditions: [{ $type: "TCardConditionalTag", Tags: ["tool"] }] },
        EffectPredicate: {
          $type: "TEffectPredicateOr",
          Predicates: [
            { $type: "TEffectPredicateFamily", Family: "haste" },
            { $type: "TEffectPredicateFamily", Family: "slow" }
          ]
        }
      },
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "DamageAmount",
        Operation: "Add",
        Value: { $type: "TFixedValue", Value: 5 },
        Target: { $type: "TTargetCardTriggerSource", Conditions: [{ $type: "TCardConditionalTag", Tags: ["tool"] }] }
      }
    });

    expect(parseStructuredEffectsFromTexts(["When you Haste or Slow this, it gains 60 Damage"], tags)[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        Subject: { $type: "TTargetCardSelf" },
        EffectPredicate: {
          $type: "TEffectPredicateOr",
          Predicates: [
            { $type: "TEffectPredicateFamily", Family: "haste" },
            { $type: "TEffectPredicateFamily", Family: "slow" }
          ]
        }
      },
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "DamageAmount",
        Operation: "Add",
        Value: { $type: "TFixedValue", Value: 60 },
        Target: { $type: "TTargetCardTriggerSource" }
      }
    });

    expect(parseStructuredEffectsFromTexts(["If you have a Vehicle, the first time you would be defeated each fight, destroy one of your Vehicles"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnPlayerWouldBeDefeated",
        SourceEvent: "would_be_defeated",
        Limit: { Mode: "First", Count: 1, Reset: "Fight", Scope: "SourceEffectInstance" }
      },
      prerequisites: [{ $type: "TCardConditionalTag", Tags: ["vehicle"] }],
      action: {
        $type: "TActionCardDestroy",
        SourceAction: "destroy",
        Target: {
          $type: "TTargetCardSection",
          Conditions: [{ $type: "TCardConditionalTag", Tags: ["vehicle"] }]
        }
      }
    });

    const ejectEffects = parseStructuredEffectsFromTexts(["If you have a Vehicle, the first time you would be defeated each fight, Heal to half health and destroy one of your Vehicles"], tags);
    expect(ejectEffects.map((effect) => effect.action.$type)).toEqual(["TActionPlayerModifyAttribute", "TActionCardDestroy"]);
    expect(ejectEffects[0].action).toMatchObject({
      SourceAction: "heal",
      AttributeType: "Health",
      Operation: "Set",
      Value: {
        $type: "TExpressionValue",
        Operator: "Multiply",
        Values: [
          { $type: "TFixedValue", Value: 0.5 },
          { $type: "TReferenceValuePlayerAttribute", AttributeType: "HealthMax" }
        ]
      }
    });
    expect(ejectEffects[1].action).toMatchObject({
      SourceAction: "destroy",
      Target: { Conditions: [{ $type: "TCardConditionalTag", Tags: ["vehicle"] }] }
    });
  });

  it("does not manufacture unknown effects for empty tooltip text", () => {
    expect(parseStructuredEffectsFromTexts([], tags)).toEqual([]);
    expect(parseStructuredEffectsFromTexts([""], tags)).toEqual([]);
    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts([], tags))).toMatchObject({
      status: "exact",
      structuredEffects: []
    });
  });

  it("exports parser audit versions and clause text through stable constants", () => {
    expect(EFFECT_CORPUS_SCHEMA_VERSION).toBe("effect-rawtext-corpus/v2");
    expect(EFFECT_PARSER_VERSION).toBe("effect-parser/v2");
    expect(SEMANTIC_IR_SCHEMA_VERSION).toBe("semantic-ir/v1");

    const document = parseSemanticEffectDocumentFromTexts(["Adjacent items have +{aura.e1}% Crit Chance"], tags);
    expect(document.schemaVersion).toBe(SEMANTIC_IR_SCHEMA_VERSION);
    expect(document.clauses[0]).toMatchObject({
      sourceText: "Adjacent items have +{aura.e1}% Crit Chance",
      normalizedText: "Adjacent items have +{aura.e1}% Crit Chance"
    });
  });

  it("preserves template placeholders as identifier values in structured projection", () => {
    expect(parseStructuredEffectsFromTexts(["Adjacent items have +{aura.e1}% Crit Chance"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        AttributeType: "CritChance",
        Value: { $type: "TIdentifierValue", Value: "aura.e1" }
      }
    });

    expect(parseStructuredEffectsFromTexts(["When you use a Drone, Burn {ability.e1}"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionPlayerBurnApply",
        Value: { $type: "TIdentifierValue", Value: "ability.e1" }
      }
    });

    expect(parseStructuredEffectsFromTexts(
      ["When you Shield, items to the left of this gain {ability.e1}"],
      tags,
      { placeholderKeywords: { "{ability.e1}": "Burn" } }
    )[0]).toMatchObject({
      trigger: { $type: "TTriggerOnCardPerformedShield", SourceEvent: "gain_shield" },
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "Burn",
        Value: { $type: "TIdentifierValue", Value: "ability.e1" },
        Target: { $type: "TTargetCardPositional", TargetMode: "LeftCard" }
      }
    });

    expect(parseStructuredEffectsFromTexts(
      ["When you Damage, items to the right of this gain {ability.e1}"],
      tags,
      { placeholderKeywords: { "{ability.e1}": "Regen" } }
    )[0]).toMatchObject({
      trigger: { $type: "TTriggerOnCardPerformedDamage", SourceEvent: "deal_damage" },
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "RegenApplyAmount",
        Value: { $type: "TIdentifierValue", Value: "ability.e1" },
        Target: { $type: "TTargetCardPositional", TargetMode: "RightCard" }
      }
    });
  });

  it("separates exact semantic projections from partial and lossy audit results", () => {
    const exactProjection = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["An item starts Flying"], tags));
    expect(exactProjection.status).toBe("exact");
    expect(projectionAudit(exactProjection.structuredEffects).status).toBe("exact");

    const partialProjection = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["When you Enrage, double this"], tags));
    expect(partialProjection.status).toBe("partial");
    expect(projectionAudit(partialProjection.structuredEffects).reasons).toContain("partial projection");

    const anchoredIncrease = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts([
      "Your items have +10 Damage and 10 Shield",
      "When you use a Flying item, Vehicle or Drone, increase this by 8"
    ], tags));
    expect(anchoredIncrease.status).toBe("exact");
    expect(anchoredIncrease.structuredEffects.at(-1)).toMatchObject({
      action: {
        $type: "TActionEffectModify",
        Operation: "Add",
        Value: { $type: "TFixedValue", Value: 8 },
        Target: { $type: "TTargetEffect", Anchor: "PreviousSemanticAction" }
      },
      projectionStatus: "exact"
    });

    const anchoredDouble = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts([
      "Your items have +5 Shield",
      "If they are Flying, double this"
    ], tags));
    expect(anchoredDouble.status).toBe("exact");
    expect(anchoredDouble.structuredEffects.at(-1)).toMatchObject({
      action: {
        $type: "TActionEffectModify",
        Operation: "Multiply",
        Value: { $type: "TFixedValue", Value: 2 },
        Target: { $type: "TTargetEffect", Anchor: "PreviousSemanticAction" }
      },
      projectionStatus: "exact"
    });

    const bonusReset = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts([
      "Poison 4 Poison",
      "When you win a fight with this, this gains +2 Multicast. If it already has 2 of this bonus, reset it instead"
    ], tags));
    expect(bonusReset.status).toBe("exact");
    expect(bonusReset.structuredEffects.at(-1)).toMatchObject({
      prerequisites: [
        {
          $type: "TVariableConditionalValue",
          VariableId: "this_bonus",
          ComparisonOperator: "GreaterThanOrEqual",
          Value: { $type: "TFixedValue", Value: 2 }
        }
      ],
      action: {
        $type: "TActionVariableModify",
        SourceAction: "modify_variable",
        VariableId: "this_bonus",
        Operation: "Set",
        Value: { $type: "TFixedValue", Value: 0 }
      },
      projectionStatus: "exact"
    });

    const roundedProjection = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["All Charge effects are reduced by half"], tags));
    expect(roundedProjection.status).toBe("exact");
    expect(projectionAudit(roundedProjection.structuredEffects, parseSemanticEffectDocumentFromTexts(["All Charge effects are reduced by half"], tags))).toMatchObject({
      status: "exact",
      warningCodes: ["ROUNDING_UNKNOWN"]
    });
  });

  it("counts structured unknown tokens beyond full unknown effects", () => {
    expect(structuredUnknownTokenCount(parseStructuredEffectsFromTexts(["When you Shield, items to the left of this gain {ability.e1}"], tags))).toBeGreaterThan(0);
    expect(structuredUnknownTokenCount(parseStructuredEffectsFromTexts(
      ["When you Shield, items to the left of this gain {ability.e1}"],
      tags,
      { placeholderKeywords: { "{ability.e1}": "Burn" } }
    ))).toBe(0);
    expect(structuredUnknownTokenCount(parseStructuredEffectsFromTexts(["One of your slots becomes a Stove (The item here is Heated)"], tags))).toBe(0);
  });

  it("parses Shiny enchantment replacement clauses as partial structured IR", () => {
    const triggerReplacement = parseStructuredEffectsFromTexts(
      ["This triggers the first two times an enemy uses an item"],
      tags
    )[0];
    expect(triggerReplacement).toMatchObject({
      kind: "aura",
      action: {
        $type: "TActionEffectModify",
        SourceAction: "modify_effect",
        AttributeType: "EffectTrigger",
        Operation: "Set",
        Value: { $type: "TFixedValue", Value: 2 },
        Target: { $type: "TTargetEffect", Entity: "EffectTemplate", Owner: "Self" },
        ReplacementTrigger: {
          $type: "TTriggerOnItemUsed",
          SourceEvent: "item_used",
          Subject: { $type: "TTargetCardSection", TargetSection: "OpponentBoard" },
          Limit: { Mode: "MaxTimes", Count: 2, Reset: "Fight", Scope: "SourceEffectInstance" }
        }
      },
      projectionStatus: "partial"
    });
    expect(triggerReplacement.projectionWarnings?.[0]).toContain("replaces this card's trigger");

    const multicastInstead = parseStructuredEffectsFromTexts(["All your Drones have Multicast instead"], tags)[0];
    expect(multicastInstead).toMatchObject({
      kind: "aura",
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "multicast",
        AttributeType: "Multicast",
        Operation: "Set",
        Value: { $type: "TFixedValue", Value: 1 },
        Target: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "drone" } }]
        }
      },
      projectionStatus: "partial"
    });
    expect(multicastInstead.projectionWarnings?.[0]).toContain("instead");

    const destroyedInstead = parseStructuredEffectsFromTexts(["When an enemy would destroy your items, this is destroyed instead"], tags)[0];
    expect(destroyedInstead).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnCardDestroyed",
        SourceEvent: "destroyed",
        Subject: { $type: "TTargetCardSection", TargetSection: "SelfHand" }
      },
      action: {
        $type: "TActionCardRedirect",
        SourceAction: "redirect",
        Target: { $type: "TTargetCardSelf" },
        OriginalTarget: { $type: "TTargetCardSection", TargetSection: "SelfHand" },
        ReplacementTrigger: {
          $type: "TTriggerOnCardDestroyed",
          SourceEvent: "destroyed",
          Subject: { $type: "TTargetCardSection", TargetSection: "SelfHand" }
        },
        ReplacementTiming: "InsteadOfOriginalResolution",
        Value: { $type: "TIdentifierValue", Value: "destroyed_instead" }
      },
      projectionStatus: "exact"
    });
    expect(destroyedInstead.action.$type).not.toBe("TActionCardDestroy");
    expect(destroyedInstead.projectionWarnings).toBeUndefined();
  });

  it("parses high-frequency semantic utility actions without unknown fallbacks", () => {
    expect(parseSemanticEffectDocumentFromTexts(["Multicast: 2"], tags).clauses[0].actions[0]).toMatchObject({
      node: "atomic",
      action: {
        type: "modify_stat",
        stat: { domain: "card", id: "multicast" },
        op: "set",
        amount: { kind: "fixed", value: 2 }
      }
    });

    expect(parseSemanticEffectDocumentFromTexts(["Lifesteal"], tags).clauses[0].actions[0]).toMatchObject({
      node: "atomic",
      action: { type: "modify_status", status: "lifesteal_enabled", target: { quantifier: "self" } }
    });

    expect(parseSemanticEffectDocumentFromTexts(["An item starts Flying"], tags).clauses[0].actions[0]).toMatchObject({
      node: "atomic",
      action: { type: "modify_status", status: "flying", op: "add", target: { entity: "item", quantifier: "one" } }
    });

    expect(parseSemanticEffectDocumentFromTexts(["Destroy an enemy item"], tags).clauses[0].actions[0]).toMatchObject({
      node: "atomic",
      action: { type: "destroy_item", target: { owner: "enemy" } }
    });

    expect(parseSemanticEffectDocumentFromTexts(["Reload adjacent items"], tags).clauses[0].actions[0]).toMatchObject({
      node: "atomic",
      action: { type: "apply_effect", mechanic: "reload", target: { position: "adjacent" } }
    });

    expect(parseSemanticEffectDocumentFromTexts(["Your items have +1 Ammo Max Ammo"], tags).clauses[0].actions[0]).toMatchObject({
      node: "atomic",
      action: {
        type: "modify_stat",
        stat: { domain: "card", id: "ammo" },
        amount: { kind: "fixed", value: 1 }
      }
    });

    const projected = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["An item starts Flying"], tags));
    expect(projected.structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionStatusModify",
        SourceAction: "modify_status",
        Status: "flying",
        Target: { $type: "TTargetCardRandom" }
      },
      projectionStatus: "exact"
    });
    expect(projected.structuredEffects[0].action.Target).not.toMatchObject({
      Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "flying" } }]
    });

    const stopFlying = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["Adjacent items stop Flying"], tags));
    expect(stopFlying.structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionStatusModify",
        Operation: "Subtract",
        Status: "flying",
        Target: {
          $type: "TTargetCardPositional",
          TargetMode: "Neighbor",
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "AnyOf", Tags: ["flying"] } }]
        }
      }
    });

    const semanticStartFlying = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["When this starts Flying, Burn 15 Burn"], tags));
    expect(semanticStartFlying.structuredEffects[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        Subject: { $type: "TTargetCardSelf" },
        EffectPredicate: { $type: "TEffectPredicateFamily", Family: "flying" }
      },
      action: { $type: "TActionPlayerBurnApply", SourceAction: "burn", Value: { $type: "TFixedValue", Value: 15 } }
    });

    const semanticStopFlying = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["When this stops Flying, deal 800 Damage Damage"], tags));
    expect(semanticStopFlying.structuredEffects[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnStatusEnded",
        SourceEvent: "status_ended",
        Status: "flying",
        Subject: { $type: "TTargetCardSelf" }
      },
      action: { $type: "TActionPlayerDamage", SourceAction: "damage", Value: { $type: "TFixedValue", Value: 800 } }
    });

    const semanticThisOrAdjacentSlows = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["When this or an adjacent item Slows, Haste the item to the left for 1 Haste second(s)"], tags)
    );
    expect(semanticThisOrAdjacentSlows.structuredEffects[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        Subject: { $type: "TTargetCardPositional", TargetMode: "Neighbor", IncludeOrigin: true },
        EffectPredicate: { $type: "TEffectPredicateFamily", Family: "slow" }
      },
      action: {
        $type: "TActionCardHaste",
        SourceAction: "haste",
        Target: { $type: "TTargetCardPositional", TargetMode: "LeftCard" },
        Value: { $type: "TFixedValue", Value: 1 }
      },
      projectionStatus: "exact"
    });

    const semanticAdjacentPoisonsOrBurns = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["When an adjacent item Poisons or Burns, Charge this 1 Charge second(s)"], tags)
    );
    expect(semanticAdjacentPoisonsOrBurns.structuredEffects[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        Subject: { $type: "TTargetCardPositional", TargetMode: "Neighbor" },
        EffectPredicate: {
          $type: "TEffectPredicateOr",
          Predicates: [
            { $type: "TEffectPredicateFamily", Family: "poison" },
            { $type: "TEffectPredicateFamily", Family: "burn" }
          ]
        }
      },
      action: { $type: "TActionCardCharge", SourceAction: "charge", Target: { $type: "TTargetCardSelf" } },
      projectionStatus: "exact"
    });

    const semanticTargetContinuation = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["Haste the item to the left for 2 Haste second(s) and it gains 3 Crit% Crit Chance"], tags)
    );
    expect(semanticTargetContinuation.structuredEffects.map((effect) => effect.action)).toMatchObject([
      {
        $type: "TActionCardHaste",
        SourceAction: "haste",
        Target: { $type: "TTargetCardPositional", TargetMode: "LeftCard" },
        Value: { $type: "TFixedValue", Value: 2 }
      },
      {
        $type: "TActionCardModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "CritChance",
        Target: { $type: "TTargetCardPositional", TargetMode: "LeftCard" },
        Value: { $type: "TFixedValue", Value: 3 }
      }
    ]);

    const semanticToggleFlying = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["This starts or stops Flying"], tags));
    expect(semanticToggleFlying.structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionStatusModify",
        SourceAction: "modify_status",
        Operation: "Toggle",
        Status: "flying",
        Target: { $type: "TTargetCardSelf" }
      }
    });
    expect(semanticToggleFlying.structuredEffects[0].action.Target).not.toMatchObject({
      Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "flying" } }]
    });

    const semanticStatusChanged = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["When your items start or stop Flying, this gains 125 Damage"], tags)
    );
    expect(semanticStatusChanged.structuredEffects[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnStatusChanged",
        SourceEvent: "status_changed",
        Status: "flying",
        Subject: { $type: "TTargetCardSection", TargetSection: "SelfHand" }
      },
      action: { $type: "TActionCardModifyAttribute", AttributeType: "DamageAmount", Value: { $type: "TFixedValue", Value: 125 } }
    });

    const semanticCompoundTargets = parseSemanticEffectDocumentFromTexts(["When you use an adjacent item, it and this start Flying"], tags);
    expect(semanticCompoundTargets.clauses[0].trigger?.subject).toMatchObject({ position: "adjacent" });
    expect(semanticCompoundTargets.clauses[0].actions[0]).toMatchObject({
      node: "parallel",
      actions: [
        { node: "atomic", action: { type: "modify_status", status: "flying", op: "add", target: { bindAs: "trigger_source" } } },
        { node: "atomic", action: { type: "modify_status", status: "flying", op: "add", target: { quantifier: "self" } } }
      ]
    });

    const projectedSemanticCompound = projectSemanticDocumentToStructuredEffects(semanticCompoundTargets);
    expect(projectedSemanticCompound.structuredEffects).toHaveLength(2);
    expect(projectedSemanticCompound.structuredEffects.map((effect) => effect.trigger)).toMatchObject([
      { $type: "TTriggerOnItemUsed", SourceEvent: "item_used", Subject: { $type: "TTargetCardPositional", TargetMode: "Neighbor" } },
      { $type: "TTriggerOnItemUsed", SourceEvent: "item_used", Subject: { $type: "TTargetCardPositional", TargetMode: "Neighbor" } }
    ]);
    expect(projectedSemanticCompound.structuredEffects.map((effect) => effect.action.Target)).toMatchObject([
      { $type: "TTargetCardTriggerSource" },
      { $type: "TTargetCardSelf" }
    ]);
    expect(projectedSemanticCompound.structuredEffects.map((effect) => effect.projectionStatus)).toEqual(["exact", "exact"]);

    const projectedSemanticToggle = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["This and an adjacent item start or stop Flying"], tags)
    );
    expect(projectedSemanticToggle.structuredEffects.map((effect) => effect.action)).toMatchObject([
      { $type: "TActionStatusModify", Operation: "Toggle", Target: { $type: "TTargetCardSelf" } },
      { $type: "TActionStatusModify", Operation: "Toggle", Target: { $type: "TTargetCardPositional", TargetMode: "Neighbor" } }
    ]);

    const projectedSemanticThisItStop = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["When you use another Flying item, this and it stop Flying"], tags)
    );
    expect(projectedSemanticThisItStop.structuredEffects.map((effect) => effect.action)).toMatchObject([
      { $type: "TActionStatusModify", Operation: "Subtract", Target: { $type: "TTargetCardSelf" } },
      { $type: "TActionStatusModify", Operation: "Subtract", Target: { $type: "TTargetCardTriggerSource" } }
    ]);

    const semanticDeathFromAbove = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["When you Enrage, 1 of your items start Flying, then Charge your Flying items 1 Charge second"], tags)
    );
    expect(semanticDeathFromAbove.structuredEffects).toHaveLength(2);
    expect(semanticDeathFromAbove.structuredEffects.map((effect) => effect.trigger)).toMatchObject([
      { $type: "TTriggerOnEnrage", SourceEvent: "enrage" },
      { $type: "TTriggerOnEnrage", SourceEvent: "enrage" }
    ]);
    expect(semanticDeathFromAbove.structuredEffects.map((effect) => effect.action)).toMatchObject([
      {
        $type: "TActionStatusModify",
        SourceAction: "modify_status",
        Operation: "Add",
        Status: "flying",
        Target: { $type: "TTargetCardRandom", TargetSection: "SelfHand" }
      },
      {
        $type: "TActionCardCharge",
        SourceAction: "charge",
        Value: { $type: "TFixedValue", Value: 1 },
        Target: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          Conditions: [{ $type: "TCardConditionalStatus", Status: "flying" }]
        }
      }
    ]);
    expect(semanticDeathFromAbove.structuredEffects.map((effect) => effect.projectionStatus)).toEqual(["exact", "exact"]);
    expect(semanticDeathFromAbove.structuredEffects.map((effect) => effect.actionGraph)).toMatchObject([
      { RootNode: "Sequence", NodePath: [0], NodeIndex: 0, NodeCount: 2 },
      { RootNode: "Sequence", NodePath: [1], NodeIndex: 1, NodeCount: 2 }
    ]);

    const semanticSponsoredApparel = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["When you use an item, it gains +1 value then Shield equal to that item's value"], tags)
    );
    expect(semanticSponsoredApparel.structuredEffects).toHaveLength(2);
    expect(semanticSponsoredApparel.structuredEffects.map((effect) => effect.action)).toMatchObject([
      {
        $type: "TActionCardModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "Value",
        Operation: "Add",
        Value: { $type: "TFixedValue", Value: 1 },
        Target: { $type: "TTargetCardTriggerSource" }
      },
      {
        $type: "TActionCardModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "Shield",
        Operation: "Add",
        Value: {
          $type: "TReferenceValueCardAttribute",
          Target: { $type: "TTargetCardTriggerSource" },
          AttributeType: "Value"
        },
        Target: { $type: "TTargetCardTriggerSource" }
      }
    ]);
    expect(semanticSponsoredApparel.structuredEffects.map((effect) => effect.projectionStatus)).toEqual(["exact", "exact"]);
    expect(semanticSponsoredApparel.structuredEffects.map((effect) => effect.actionGraph)).toMatchObject([
      { RootNode: "Sequence", NodePath: [0], NodeIndex: 0, NodeCount: 2 },
      { RootNode: "Sequence", NodePath: [1], NodeIndex: 1, NodeCount: 2 }
    ]);
  });

  it("keeps lifecycle and trigger-source semantic clauses as triggered effects", () => {
    const enrageWeaponBuff = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["When you Enrage, adjacent Weapons gain 30 Damage"], tags)
    ).structuredEffects[0];
    expect(enrageWeaponBuff).toMatchObject({
      kind: "ability",
      trigger: { $type: "TTriggerOnEnrage", SourceEvent: "enrage" },
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "DamageAmount",
        Target: {
          $type: "TTargetCardPositional",
          TargetMode: "Neighbor",
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "weapon" } }]
        },
        Value: { $type: "TFixedValue", Value: 30 }
      },
      projectionStatus: "exact"
    });

    const boughtPotion = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["When you buy a Potion, permanently increase this item's Regen by +2 Regen"], tags)
    ).structuredEffects[0];
    expect(boughtPotion).toMatchObject({
      trigger: {
        $type: "TTriggerOnCardPurchased",
        SourceEvent: "buy",
        Subject: {
          $type: "TTargetCardSection",
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "potion" } }]
        }
      },
      action: {
        $type: "TActionCardModifyAttribute",
        AttributeType: "RegenApplyAmount",
        Target: { $type: "TTargetCardSelf" },
        Value: { $type: "TFixedValue", Value: 2 }
      },
      projectionStatus: "exact"
    });

    const fightEndDestroy = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["At the end of each fight, if this has no Ammo, permanently destroy it"], tags)
    ).structuredEffects[0];
    expect(fightEndDestroy).toMatchObject({
      trigger: { $type: "TTriggerOnFightEnded", SourceEvent: "fight_end" },
      prerequisites: [
        {
          $type: "TCardConditionalAttribute",
          AttributeType: "Ammo",
          ComparisonOperator: "Equal",
          Value: { $type: "TFixedValue", Value: 0 }
        }
      ],
      action: { $type: "TActionCardDestroy", Target: { $type: "TTargetCardSelf" } },
      projectionStatus: "exact"
    });

    const dailyUpgrade = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["At the start of each day, if you have 3 or more Tools, upgrade a lower tier Vehicle or Drone"], tags)
    ).structuredEffects[0];
    expect(dailyUpgrade).toMatchObject({
      trigger: { $type: "TTriggerOnDayStarted", SourceEvent: "day_started" },
      prerequisites: [{ $type: "TCardConditionalCount", ComparisonOperator: "GreaterThanOrEqual", Amount: 3, Tags: ["tool"] }],
      action: {
        $type: "TActionCardUpgrade",
        Target: {
          Conditions: [
            { $type: "TCardConditionalTagExpr", Expr: { $type: "AnyOf", Tags: ["vehicle", "drone"] } },
            { $type: "TCardConditionalTierComparison", ComparisonOperator: "LessThan", Reference: { $type: "TTargetCardSelf" } }
          ]
        }
      },
      projectionStatus: "exact"
    });

    const anyPlayerPoison = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["When ANY Player uses a Weapon, Poison that Player 2 Poison"], tags)
    ).structuredEffects[0];
    expect(anyPlayerPoison).toMatchObject({
      trigger: {
        $type: "TTriggerOnItemUsed",
        SourceEvent: "item_used",
        Subject: {
          $type: "TTargetCardSection",
          TargetSection: "AllBoards",
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "weapon" } }]
        }
      },
      action: {
        $type: "TActionPlayerPoisonApply",
        Target: { $type: "TTargetPlayerTriggerSource" },
        Value: { $type: "TFixedValue", Value: 2 }
      },
      projectionStatus: "exact",
      projectionWarnings: undefined
    });

    const ammoEmptyChargeAdjacent = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["When one of your items runs out of ammo, Charge items adjacent to it 1 Charge second(s)"], tags)
    ).structuredEffects[0];
    expect(ammoEmptyChargeAdjacent).toMatchObject({
      trigger: {
        $type: "TTriggerOnCardAmmoEmpty",
        SourceEvent: "ammo_empty",
        Subject: { $type: "TTargetCardRandom" }
      },
      action: {
        $type: "TActionCardCharge",
        Target: {
          $type: "TTargetCardPositional",
          TargetMode: "Neighbor",
          Anchor: { $type: "TTargetCardTriggerSource" }
        }
      },
      projectionStatus: "exact",
      projectionWarnings: undefined
    });
  });

  it("parses semantic economy and item lifecycle actions without unknown fallbacks", () => {
    expect(parseSemanticEffectDocumentFromTexts(["Sells for Gold"], tags).clauses[0].actions[0]).toMatchObject({
      node: "atomic",
      action: { type: "modify_stat", stat: { domain: "player", id: "gold" }, amount: { kind: "identifier", value: "sell_price" } }
    });

    expect(parseSemanticEffectDocumentFromTexts(["At the start of each day, get a Catalyst"], tags).clauses[0]).toMatchObject({
      kind: "triggered",
      trigger: { event: "day_started" },
      actions: [{ node: "atomic", action: { type: "gain_item", description: "a Catalyst" } }]
    });

    expect(parseSemanticEffectDocumentFromTexts(["When you buy this, get a Small Reagent"], tags).clauses[0]).toMatchObject({
      kind: "triggered",
      trigger: { event: "item_bought" },
      actions: [{ node: "atomic", action: { type: "gain_item", item: { predicates: { op: "and" } } } }]
    });

    expect(parseSemanticEffectDocumentFromTexts(["Transform into a copy of another Small, non-Legendary item you have"], tags).clauses[0].actions[0]).toMatchObject({
      node: "atomic",
      action: { type: "transform_item", description: "a copy of another Small, non-Legendary item you have" }
    });

    expect(parseSemanticEffectDocumentFromTexts(["When this is transformed, Enchant it with Toxic if able"], tags).clauses[0]).toMatchObject({
      kind: "triggered",
      actions: [{ node: "atomic", action: { type: "enchant_item", enchantment: "Toxic" } }]
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["When you Enrage, Enchant 1 non-enchanted item(s)"], tags)).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionCardEnchant",
        EnchantmentSelection: "Unspecified"
      },
      projectionStatus: "exact",
      projectionWarnings: undefined
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["When this is transformed, Enchant it with Toxic if able"], tags)).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionCardEnchant",
        EnchantmentSelection: "Specified",
        Value: { $type: "TIdentifierValue", Value: "Toxic" }
      },
      projectionStatus: "exact",
      projectionWarnings: undefined
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["When you buy this, get a Small Tech item from any Hero"], tags)).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionGameSpawnCards",
        Target: {
          Conditions: [
            { $type: "TCardConditionalSize", Sizes: [1] },
            { $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "tech" } }
          ]
        },
        GeneratedCards: [
          {
            RawDescription: "a Small Tech item from any Hero",
            CardKind: "Item",
            SourcePool: "AnyHero",
            Selector: {
              Conditions: [
                { $type: "TCardConditionalSize", Sizes: [1] },
                { $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "tech" } }
              ]
            },
            SelectionMode: "OneMatching"
          }
        ]
      },
      projectionStatus: "exact"
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["When you buy this, get a Small or Medium Food from any Hero"], tags)).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionGameSpawnCards",
        Target: {
          Conditions: [
            { $type: "TCardConditionalSize", Sizes: [1, 2] },
            { $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "food" } }
          ]
        },
        GeneratedCards: [
          {
            RawDescription: "a Small or Medium Food from any Hero",
            SourcePool: "AnyHero",
            Selector: {
              Conditions: [
                { $type: "TCardConditionalSize", Sizes: [1, 2] },
                { $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "food" } }
              ]
            }
          }
        ]
      },
      projectionStatus: "exact"
    });

    const merchantTransform = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["When you visit a Merchant, transform the Small item to the left into a Potion"], tags)
    ).structuredEffects[0];
    expect(merchantTransform).toMatchObject({
      trigger: { $type: "TTriggerOnMerchantVisited", SourceEvent: "merchant" },
      action: {
        $type: "TActionCardTransform",
        Target: {
          $type: "TTargetCardPositional",
          TargetMode: "LeftCard",
          Conditions: [{ $type: "TCardConditionalSize", Sizes: [1] }]
        },
        Value: { $type: "TIdentifierValue", Value: "a Potion" },
        TransformInto: {
          RawDescription: "a Potion",
          CardKind: "Item",
          Selector: { Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "potion" } }] },
          SelectionMode: "OneMatching"
        }
      },
      projectionStatus: "exact"
    });

    const monsterReward = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["When you defeat a Gold-tier or higher Monster, get a Loot item"], tags)
    ).structuredEffects[0];
    expect(monsterReward).toMatchObject({
      trigger: {
        $type: "TTriggerOnCombatWon",
        SourceEvent: "win",
        Subject: {
          $type: "TTargetCardSection",
          TargetSection: "OpponentBoard",
          Conditions: [{ $type: "TCardConditionalRarity", Rarity: "Gold", ComparisonOperator: "GreaterThanOrEqual" }]
        }
      },
      action: {
        $type: "TActionGameSpawnCards",
        Target: { Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "loot" } }] },
        GeneratedCards: [
          {
            RawDescription: "a Loot item",
            CardKind: "Item",
            Selector: { Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "loot" } }] },
            SelectionMode: "OneMatching"
          }
        ]
      },
      projectionStatus: "exact"
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["When you buy this, gain +1 Income"], tags)).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionPlayerModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "Income",
        Value: { $type: "TFixedValue", Value: 1 },
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" }
      },
      projectionStatus: "exact"
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["When you Poison yourself, your Weapons gain + Damage equal to the amount Poisoned"], tags)).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "DamageAmount",
        Target: {
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "weapon" } }]
        },
        Value: {
          $type: "TReferenceValuePlayerAttributeChange",
          AttributeType: "PoisonApplyAmount",
          ChangeDirection: "Gained"
        }
      },
      projectionStatus: "exact"
    });

    const spendForValue = parseSemanticEffectDocumentFromTexts(["At the start of each hour, spend 2 Gold to permanently gain 1 value"], tags);
    expect(spendForValue.clauses[0]).toMatchObject({
      kind: "triggered",
      trigger: { event: "day_started" },
      actions: [
        {
          node: "sequence",
          actions: [
            {
              node: "atomic",
              action: {
                type: "modify_stat",
                target: { entity: "player", owner: "self" },
                stat: { domain: "player", id: "gold" },
                op: "subtract",
                amount: { kind: "fixed", value: 2, unit: "gold" }
              }
            },
            {
              node: "atomic",
              action: {
                type: "modify_stat",
                target: { entity: "item", owner: "self", quantifier: "self" },
                stat: { domain: "card", id: "value" },
                op: "add",
                amount: { kind: "fixed", value: 1 },
                duration: { kind: "permanent" }
              }
            }
          ]
        }
      ]
    });
    expect(projectSemanticDocumentToStructuredEffects(spendForValue).structuredEffects).toMatchObject([
      {
        action: {
          $type: "TActionPlayerModifyAttribute",
          AttributeType: "Gold",
          Operation: "Subtract",
          Value: { $type: "TFixedValue", Value: 2 },
          Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" }
        },
        actionGraph: { RootNode: "Sequence", NodePath: [0], NodeIndex: 0, NodeCount: 2 },
        projectionStatus: "exact",
        projectionWarnings: undefined
      },
      {
        action: {
          $type: "TActionCardModifyAttribute",
          AttributeType: "Value",
          Operation: "Add",
          Value: { $type: "TFixedValue", Value: 1 },
          Target: { $type: "TTargetCardSelf" }
        },
        actionGraph: { RootNode: "Sequence", NodePath: [1], NodeIndex: 1, NodeCount: 2 },
        projectionStatus: "exact",
        projectionWarnings: undefined
      }
    ]);

    const spendAndBuff = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(
        ["At the start of each fight with Dragon Tooth, spend 3 Gold and your Weapons permanently gain 5 Damage Damage"],
        tags
      )
    );
    expect(spendAndBuff.structuredEffects).toMatchObject([
      {
        trigger: { $type: "TTriggerOnFightStarted", SourceEvent: "combat_start" },
        action: {
          $type: "TActionPlayerModifyAttribute",
          SourceAction: "gain_stat",
          AttributeType: "Gold",
          Operation: "Subtract",
          Value: { $type: "TFixedValue", Value: 3 }
        },
        actionGraph: { RootNode: "Sequence", NodePath: [0], NodeIndex: 0, NodeCount: 2 },
        projectionStatus: "exact"
      },
      {
        trigger: { $type: "TTriggerOnFightStarted", SourceEvent: "combat_start" },
        action: {
          $type: "TActionCardModifyAttribute",
          AttributeType: "DamageAmount",
          Target: {
            Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "weapon" } }]
          },
          Value: { $type: "TFixedValue", Value: 5 }
        },
        actionGraph: { RootNode: "Sequence", NodePath: [1], NodeIndex: 1, NodeCount: 2 },
        projectionStatus: "exact"
      }
    ]);

    expect(parseSemanticEffectDocumentFromTexts(["When you sell this, upgrade your leftmost item"], tags).clauses[0]).toMatchObject({
      kind: "triggered",
      trigger: { event: "item_sold" },
      actions: [{ node: "atomic", action: { type: "upgrade_item" } }]
    });

    expect(parseSemanticEffectDocumentFromTexts(["When you sell this, permanently gain 2 Heal Regen"], tags).clauses[0]).toMatchObject({
      kind: "triggered",
      trigger: { event: "item_sold" },
      actions: [
        {
          node: "atomic",
          action: {
            type: "modify_stat",
            target: { entity: "item", owner: "self", quantifier: "self" },
            stat: { domain: "card", id: "regenAmount" },
            amount: { kind: "fixed", value: 2 },
            duration: { kind: "permanent" }
          }
        }
      ]
    });

    const semanticHealRegenAura = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["You have +10 Heal Regen"], tags));
    expect(semanticHealRegenAura.structuredEffects).toMatchObject([
      {
        kind: "aura",
        action: {
          $type: "TActionCardModifyAttribute",
          SourceAction: "gain_stat",
          AttributeType: "RegenApplyAmount",
          Operation: "Add",
          Value: { $type: "TFixedValue", Value: 10 },
          Target: { $type: "TTargetCardSelf" }
        },
        projectionStatus: "exact"
      }
    ]);

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["Haste this for 2 Haste seconds"], tags)).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionCardHaste",
        SourceAction: "haste",
        AttributeType: "HasteAmount",
        Value: { $type: "TFixedValue", Value: 2 },
        Target: { $type: "TTargetCardSelf" }
      },
      projectionStatus: "exact"
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["Poison 4 Poison, Burn 4 Burn"], tags)).structuredEffects.map((effect) => effect.action)).toMatchObject([
      {
        $type: "TActionPlayerPoisonApply",
        SourceAction: "poison",
        AttributeType: "PoisonApplyAmount",
        Value: { $type: "TFixedValue", Value: 4 }
      },
      {
        $type: "TActionPlayerBurnApply",
        SourceAction: "burn",
        AttributeType: "BurnApplyAmount",
        Value: { $type: "TFixedValue", Value: 4 }
      }
    ]);

    const projected = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["At the start of each day, get a Catalyst"], tags));
    expect(projected.structuredEffects[0]).toMatchObject({
      trigger: { $type: "TTriggerOnDayStarted", SourceEvent: "day_started" },
      action: {
        $type: "TActionGameSpawnCards",
        SourceAction: "gain_item",
        GeneratedCards: [
          {
            RawDescription: "a Catalyst",
            CardKind: "Item",
            NameHints: ["Catalyst"],
            SelectionMode: "OneMatching"
          }
        ]
      },
      projectionStatus: "exact"
    });

    const levelUpReward = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["When you Level Up, get a small item from another Hero"], tags));
    expect(levelUpReward.structuredEffects[0]).toMatchObject({
      trigger: { $type: "TTriggerOnCardUpgraded", SourceEvent: "level_up" },
      action: {
        $type: "TActionGameSpawnCards",
        GeneratedCards: [
          {
            RawDescription: "a small item from another Hero",
            SourcePool: "AnotherHero",
            Selector: { Conditions: [{ $type: "TCardConditionalSize", Sizes: [1] }] }
          }
        ]
      },
      projectionStatus: "exact"
    });

    const buyAndDayReward = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["When you buy this and at the start of each day, get a Premium Piggle"], tags)
    );
    expect(buyAndDayReward.structuredEffects).toMatchObject([
      {
        trigger: { $type: "TTriggerOnCardPurchased", SourceEvent: "buy" },
        action: { $type: "TActionGameSpawnCards", GeneratedCards: [{ NameHints: ["Premium Piggle"] }] },
        projectionStatus: "exact"
      },
      {
        trigger: { $type: "TTriggerOnDayStarted", SourceEvent: "day_started" },
        action: { $type: "TActionGameSpawnCards", GeneratedCards: [{ NameHints: ["Premium Piggle"] }] },
        projectionStatus: "exact"
      }
    ]);

    const levelAndDayReward = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["When you Level Up and at the start of each day, get a Spare Change"], tags)
    );
    expect(levelAndDayReward.structuredEffects.map((effect) => effect.trigger?.SourceEvent)).toEqual(["level_up", "day_started"]);
  });

  it("parses dynamic stat, cost, and type-copy semantic clauses", () => {
    expect(parseSemanticEffectDocumentFromTexts(["gain Max Health equal to 3 times that Food's Value"], tags).clauses[0].actions[0]).toMatchObject({
      node: "atomic",
      action: {
        type: "modify_stat",
        stat: { domain: "player", id: "maxHealth" },
        amount: { kind: "scale", factor: 3, value: { kind: "stat", stat: { id: "value" } } }
      }
    });

    expect(
      parseSemanticEffectDocumentFromTexts(["When you gain Gold, permanently gain Max Health equal to 1 times the amount of Gold gained"], tags).clauses[0]
    ).toMatchObject({
      kind: "triggered",
      actions: [
        {
          node: "atomic",
          action: {
            type: "modify_stat",
            stat: { domain: "player", id: "maxHealth" },
            duration: { kind: "permanent" },
            amount: { kind: "scale", factor: 1, value: { kind: "stat_change", stat: { domain: "player", id: "gold" } } }
          }
        }
      ]
    });

    expect(parseSemanticEffectDocumentFromTexts(["Gain 25 Heal Max Health"], tags).clauses[0].actions[0]).toMatchObject({
      node: "atomic",
      action: {
        type: "modify_stat",
        target: { entity: "player", owner: "self" },
        stat: { domain: "player", id: "maxHealth" },
        amount: { kind: "fixed", value: 25 }
      }
    });

    expect(parseSemanticEffectDocumentFromTexts(["When you use a Tool, gain 20 Heal Max Health"], tags).clauses[0]).toMatchObject({
      kind: "triggered",
      actions: [
        {
          node: "atomic",
          action: {
            type: "modify_stat",
            target: { entity: "player", owner: "self" },
            stat: { domain: "player", id: "maxHealth" },
            amount: { kind: "fixed", value: 20 }
          }
        }
      ]
    });

    const projectedHealMaxHealth = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["Gain 25 Heal Max Health"], tags));
    expect(projectedHealMaxHealth.structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionPlayerModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "HealthMax",
        Operation: "Add",
        Value: { $type: "TFixedValue", Value: 25 },
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" }
      },
      projectionStatus: "exact"
    });

    const projectedTriggeredHealMaxHealth = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["The first 4 times you use a Heal or Regen item each fight, gain 50 Heal Max Health"], tags)
    );
    expect(projectedTriggeredHealMaxHealth.structuredEffects[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnItemUsed",
        Limit: { Mode: "MaxTimes", Count: 4, Reset: "Fight", Scope: "SourceEffectInstance" },
        Subject: {
          Conditions: [
            { $type: "TCardConditionalTagExpr", Expr: { $type: "AnyOf", Tags: ["heal", "regen"] } }
          ]
        }
      },
      action: {
        $type: "TActionPlayerModifyAttribute",
        AttributeType: "HealthMax",
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" },
        Value: { $type: "TFixedValue", Value: 50 }
      },
      projectionStatus: "exact"
    });

    const projectedDynamicHealMaxHealth = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["You have +50 Heal Max Health for each Tool you have"], tags)
    );
    expect(projectedDynamicHealMaxHealth.structuredEffects[0]).toMatchObject({
      kind: "aura",
      action: {
        $type: "TActionPlayerModifyAttribute",
        AttributeType: "HealthMax",
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" },
        Value: {
          $type: "TExpressionValue",
          Operator: "Multiply",
          Values: [
            { $type: "TFixedValue", Value: 50 },
            {
              $type: "TReferenceValueCardCount",
              Target: {
                Conditions: [
                  { $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "tool" } }
                ]
              }
            }
          ]
        }
      },
      projectionStatus: "exact"
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["Heal equal to 10% of your Max Health"], tags)).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionPlayerHeal",
        AttributeType: "HealAmount",
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" },
        Value: {
          $type: "TExpressionValue",
          Operator: "Multiply",
          Values: [
            { $type: "TFixedValue", Value: 0.1 },
            { $type: "TReferenceValuePlayerAttribute", AttributeType: "HealthMax" }
          ]
        }
      }
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["Gain 20 Rage Rage"], tags)).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionPlayerModifyAttribute",
        AttributeType: "Rage",
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" },
        Value: { $type: "TFixedValue", Value: 20 }
      },
      projectionStatus: "exact"
    });

    const projectedForEachRage = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["The first time any item is used each fight, for each Property you have, gain 15 Rage Rage"], tags)
    );
    expect(projectedForEachRage.structuredEffects[0]).toMatchObject({
      trigger: {
        Limit: { Mode: "First", Count: 1, Reset: "Fight", Scope: "SourceEffectInstance" }
      },
      action: {
        $type: "TActionPlayerModifyAttribute",
        AttributeType: "Rage",
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" },
        Value: {
          $type: "TExpressionValue",
          Operator: "Multiply",
          Values: [
            { $type: "TFixedValue", Value: 15 },
            {
              $type: "TReferenceValueCardCount",
              Target: {
                Conditions: [
                  { $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "property" } }
                ]
              }
            }
          ]
        }
      },
      projectionStatus: "exact"
    });

    expect(parseSemanticEffectDocumentFromTexts(["Your rerolls cost 1 less Gold for each Apparel you have"], tags).clauses[0].actions[0]).toMatchObject({
      node: "atomic",
      action: {
        type: "modify_stat",
        stat: { domain: "player", id: "rerollCost" },
        op: "subtract",
        amount: { kind: "scale", factor: 1, value: { kind: "count" } }
      }
    });

    const typeCopy = parseSemanticEffectDocumentFromTexts(["This has the Types of items you have in your Stash"], tags);
    expect(typeCopy.clauses[0].actions[0]).toMatchObject({
      node: "atomic",
      action: {
        type: "modify_tags",
        op: "copy_from",
        source: { entity: "item", zone: "stash" }
      }
    });
    expect(projectSemanticDocumentToStructuredEffects(typeCopy).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionCardAddTagsList",
        SourceAction: "buff_tag",
        Tags: ["copied_types"],
        TagMutation: {
          Mode: "CopyFrom",
          TagDomain: "ItemType",
          Source: { $type: "TTargetCardSection", TargetSection: "SelfStash" },
          RawDescription: "This has the Types of items you have in your Stash"
        }
      },
      projectionStatus: "exact"
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["When you sell this, your leftmost item gains 1 random type(s)"], tags)).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionCardAddTagsList",
        SourceAction: "buff_tag",
        Tags: ["random_type"],
        TagMutation: {
          Mode: "AddRandom",
          TagDomain: "ItemType",
          Count: { $type: "TFixedValue", Value: 1 }
        }
      },
      projectionStatus: "exact"
    });

    expect(parseSemanticEffectDocumentFromTexts(["Burn equal to 10% of this item's Damage"], tags).clauses[0].actions[0]).toMatchObject({
      node: "atomic",
      action: {
        type: "apply_effect",
        mechanic: "burn",
        amount: {
          kind: "scale",
          factor: 0.1,
          value: { kind: "stat", stat: { domain: "card", id: "damageAmount" } }
        }
      }
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["Burn equal to this item's Damage"], tags)).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionPlayerBurnApply",
        Value: {
          $type: "TReferenceValueCardAttribute",
          AttributeType: "DamageAmount",
          Target: { $type: "TTargetCardSelf" }
        }
      }
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["Regen equal to this item's Damage"], tags)).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionPlayerRegenApply",
        Value: {
          $type: "TReferenceValueCardAttribute",
          AttributeType: "DamageAmount",
          Target: { $type: "TTargetCardSelf" }
        }
      }
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["Deal Damage equal to your Shield"], tags)).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionPlayerDamage",
        Value: {
          $type: "TReferenceValuePlayerAttribute",
          AttributeType: "Shield",
          Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" }
        }
      }
    });

    const doubleBurn = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["When you Enrage, double this item's Burn"], tags));
    expect(doubleBurn.structuredEffects[0]).toMatchObject({
      trigger: { $type: "TTriggerOnEnrage", SourceEvent: "enrage" },
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "Burn",
        Operation: "Multiply",
        Value: { $type: "TFixedValue", Value: 2 },
        Target: { $type: "TTargetCardSelf" }
      },
      projectionStatus: "exact"
    });

    const doubleDamage = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["When you Crit, double this item's Damage"], tags));
    expect(doubleDamage.structuredEffects[0]).toMatchObject({
      trigger: { $type: "TTriggerOnCardCritted", SourceEvent: "crit" },
      action: {
        $type: "TActionCardModifyAttribute",
        AttributeType: "DamageAmount",
        Operation: "Multiply",
        Target: { $type: "TTargetCardSelf" }
      }
    });

    const sandstormMaxHealth = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["When the Sandstorm starts, double your Max Health"], tags));
    expect(sandstormMaxHealth.structuredEffects[0]).toMatchObject({
      kind: "ability",
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        EffectPredicate: { $type: "TEffectPredicateFamily", Family: "sandstorm" }
      },
      action: {
        $type: "TActionPlayerModifyAttribute",
        AttributeType: "HealthMax",
        Operation: "Multiply",
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" }
      },
      projectionStatus: "exact"
    });

    const doubleCritDamage = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["This deals double Crit Damage"], tags));
    expect(doubleCritDamage.structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionCardModifyAttribute",
        AttributeType: "CritDamage",
        Operation: "Multiply",
        Value: { $type: "TFixedValue", Value: 2 },
        Target: { $type: "TTargetCardSelf" }
      },
      projectionStatus: "exact"
    });

    const compoundDouble = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["This has double Damage and Shield gain"], tags));
    expect(compoundDouble.structuredEffects.map((effect) => effect.action.AttributeType)).toEqual(["DamageAmount", "Shield"]);
    expect(compoundDouble.structuredEffects.every((effect) => effect.action.Operation === "Multiply")).toBe(true);

    const damageAndDestroy = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["Deal Damage equal to 30% of an enemy's Max Health and destroy this"], tags)
    );
    expect(damageAndDestroy.structuredEffects.map((effect) => effect.action.$type)).toEqual(["TActionPlayerDamage", "TActionCardDestroy"]);

    const destroyTrigger = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["When you destroy an item, use this"], tags));
    expect(destroyTrigger.structuredEffects[0]).toMatchObject({
      trigger: { $type: "TTriggerOnCardDestroyed", SourceEvent: "destroyed", Subject: { $type: "TTargetCardRandom", TargetSection: "SelfHand" } }
    });
    expect(JSON.stringify(destroyTrigger.structuredEffects[0].trigger)).not.toContain("\"Tag\":\"destroy\"");

    const semanticBusterDestroyTargets = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["When this stops Flying, deal Damage equal to 20% of your enemy's Max Health, then destroy this and an enemy item"], tags)
    );
    expect(semanticBusterDestroyTargets.structuredEffects).toHaveLength(3);
    expect(semanticBusterDestroyTargets.structuredEffects.map((effect) => effect.action)).toMatchObject([
      { $type: "TActionPlayerDamage" },
      { $type: "TActionCardDestroy", Target: { $type: "TTargetCardSelf" } },
      { $type: "TActionCardDestroy", Target: { $type: "TTargetCardRandom", TargetSection: "OpponentBoard" } }
    ]);
    expect(JSON.stringify(semanticBusterDestroyTargets.structuredEffects)).not.toContain("\"Tag\":\"destroy\"");

    const semanticSeekerProbeDestroyTargets = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["When you Crit with this, destroy this and a Small enemy item"], tags)
    );
    expect(semanticSeekerProbeDestroyTargets.structuredEffects).toHaveLength(2);
    expect(semanticSeekerProbeDestroyTargets.structuredEffects.map((effect) => effect.action)).toMatchObject([
      { $type: "TActionCardDestroy", Target: { $type: "TTargetCardSelf" } },
      {
        $type: "TActionCardDestroy",
        Target: { $type: "TTargetCardRandom", TargetSection: "OpponentBoard", Conditions: [{ $type: "TCardConditionalSize", Sizes: [1] }] }
      }
    ]);
    expect(JSON.stringify(semanticSeekerProbeDestroyTargets.structuredEffects)).not.toContain("\"Tag\":\"destroy\"");

    const semanticEnrageDestroyThenPrevent = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["When you become Enraged, destroy this and you take no damage for 2 seconds"], tags)
    );
    expect(semanticEnrageDestroyThenPrevent.structuredEffects.map((effect) => effect.action.$type)).toEqual([
      "TActionCardDestroy",
      "TActionPlayerPreventDamage"
    ]);
    expect(semanticEnrageDestroyThenPrevent.structuredEffects[1].action).toMatchObject({
      SourceAction: "prevent_damage",
      Value: { $type: "TFixedValue", Value: 2 }
    });

    const semanticHalfHealthPreventAndRegen = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(
        ["The first time you fall below half Health each fight, you take no Damage for 1 second(s) and gain 25 Regen"],
        tags
      )
    );
    expect(semanticHalfHealthPreventAndRegen.structuredEffects.map((effect) => effect.action.$type)).toEqual([
      "TActionPlayerPreventDamage",
      "TActionCardModifyAttribute"
    ]);
    expect(semanticHalfHealthPreventAndRegen.structuredEffects[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnPlayerAttributeThresholdCrossed",
        SourceEvent: "player_attribute_threshold",
        Limit: { Mode: "First", Count: 1, Reset: "Fight" }
      },
      action: {
        SourceAction: "prevent_damage",
        Value: { $type: "TFixedValue", Value: 1 }
      }
    });
    expect(semanticHalfHealthPreventAndRegen.structuredEffects[1].action).toMatchObject({
      SourceAction: "gain_stat",
      AttributeType: "RegenApplyAmount",
      Value: { $type: "TFixedValue", Value: 25 }
    });

    const semanticDamageReduction = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["You take 30% less damage"], tags));
    expect(semanticDamageReduction.structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionEffectModify",
        SourceAction: "modify_effect",
        AttributeType: "EffectMagnitude",
        Operation: "Multiply",
        Value: { $type: "TFixedValue", Value: 0.7 },
        Target: {
          $type: "TTargetEffect",
          Entity: "EffectInstance",
          Owner: "Opponent",
          Recipient: { $type: "TTargetPlayerRelative", TargetMode: "Self" },
          Predicate: { $type: "TEffectPredicateFamily", Family: "damage" }
        }
      },
      projectionStatus: "exact"
    });

    const semanticDynamicReduction = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["You take 10% less damage for each non-Glider Flying item you have"], tags)
    );
    expect(semanticDynamicReduction.structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionEffectModify",
        SourceAction: "modify_effect",
        Value: {
          $type: "TExpressionValue",
          Operator: "Subtract",
          Values: [
            { $type: "TFixedValue", Value: 1 },
            {
              $type: "TExpressionValue",
              Operator: "Multiply",
              Values: [
                { $type: "TFixedValue", Value: 0.1 },
                {
                  $type: "TReferenceValueCardCount",
                  Target: {
                    $type: "TTargetCardSection",
                    Conditions: [
                      { $type: "TCardConditionalStatus", Status: "flying" },
                      { $type: "TCardConditionalTagExpr", Expr: { $type: "NoneOf", Tags: ["glider"] } }
                    ]
                  }
                }
              ]
            }
          ]
        }
      },
      projectionStatus: "exact"
    });

    const semanticPoisonThresholdScale = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["For every 20 Poison on an enemy, this has +1 Multicast"], tags)
    );
    expect(semanticPoisonThresholdScale.structuredEffects[0]).toMatchObject({
      kind: "aura",
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "Multicast",
        Operation: "Add",
        Target: { $type: "TTargetCardSelf" },
        Value: {
          $type: "TExpressionValue",
          Operator: "Multiply",
          Values: [
            { $type: "TFixedValue", Value: 1 },
            {
              $type: "TExpressionValue",
              Operator: "Divide",
              Rounding: "Floor",
              Values: [
                {
                  $type: "TReferenceValuePlayerAttribute",
                  Target: { $type: "TTargetPlayerRelative", TargetMode: "Opponent" },
                  AttributeType: "Poison"
                },
                { $type: "TFixedValue", Value: 20 }
              ]
            }
          ]
        }
      },
      projectionStatus: "exact",
      projectionWarnings: undefined
    });

    const semanticCardStatThresholdScale = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["This item's Cooldown is reduced by 1% for every 2 Damage it has"], tags)
    );
    expect(semanticCardStatThresholdScale.structuredEffects[0]).toMatchObject({
      kind: "aura",
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "reduce_cooldown",
        AttributeType: "CooldownMax",
        Operation: "Subtract",
        Target: { $type: "TTargetCardSelf" },
        Value: {
          $type: "TExpressionValue",
          Operator: "Multiply",
          Values: [
            { $type: "TFixedValue", Value: 1 },
            {
              $type: "TExpressionValue",
              Operator: "Divide",
              Rounding: "Floor",
              Values: [
                {
                  $type: "TReferenceValueCardAttribute",
                  Target: { $type: "TTargetCardSelf" },
                  AttributeType: "DamageAmount"
                },
                { $type: "TFixedValue", Value: 2 }
              ]
            }
          ]
        }
      },
      projectionStatus: "exact",
      projectionWarnings: undefined
    });

    const semanticSandstormReduction = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["When the Sandstorm starts you take 25% less Damage for the rest of the fight"], tags)
    );
    expect(semanticSandstormReduction.structuredEffects[0]).toMatchObject({
      trigger: { $type: "TTriggerOnEffectApplied", SourceEvent: "effect_applied" },
      action: {
        $type: "TActionEffectModify",
        SourceAction: "modify_effect",
        Value: { $type: "TFixedValue", Value: 0.75 },
        Target: { Recipient: { $type: "TTargetPlayerRelative", TargetMode: "Self" } }
      },
      projectionStatus: "exact"
    });

    const elementalDepthCharge = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["Poison 4 Poison, Burn 4 Burn, and Freeze an item for 1 Freeze second(s)"], tags)
    );
    expect(elementalDepthCharge.structuredEffects.map((effect) => effect.action.$type)).toEqual([
      "TActionPlayerPoisonApply",
      "TActionPlayerBurnApply",
      "TActionCardFreeze"
    ]);
    expect(elementalDepthCharge.structuredEffects.map((effect) => effect.action.Value)).toEqual([
      { $type: "TFixedValue", Value: 4 },
      { $type: "TFixedValue", Value: 4 },
      { $type: "TFixedValue", Value: 1 }
    ]);

    const rainbowStaff = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(
        [
          "Burn 6 Burn\n \nPoison 6 Poison",
          "Freeze an item for 1 Freeze second(s)\n \nSlow an item for 2 Slow second(s)"
        ],
        tags
      )
    );
    expect(rainbowStaff.structuredEffects.map((effect) => effect.action.$type)).toEqual([
      "TActionPlayerBurnApply",
      "TActionPlayerPoisonApply",
      "TActionCardFreeze",
      "TActionCardSlow"
    ]);
    expect(rainbowStaff.structuredEffects.map((effect) => effect.action.Value)).toEqual([
      { $type: "TFixedValue", Value: 6 },
      { $type: "TFixedValue", Value: 6 },
      { $type: "TFixedValue", Value: 1 },
      { $type: "TFixedValue", Value: 2 }
    ]);

    const favoriteToy = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["Your leftmost Toy has +20 Damage, Shield and Heal"], tags)
    );
    expect(favoriteToy.structuredEffects.map((effect) => effect.action.$type)).toEqual([
      "TActionCardModifyAttribute",
      "TActionCardModifyAttribute",
      "TActionCardModifyAttribute"
    ]);
    expect(favoriteToy.structuredEffects.map((effect) => effect.action.AttributeType)).toEqual(["DamageAmount", "Shield", "HealAmount"]);
    expect(favoriteToy.structuredEffects.map((effect) => effect.action.Value)).toEqual([
      { $type: "TFixedValue", Value: 20 },
      { $type: "TFixedValue", Value: 20 },
      { $type: "TFixedValue", Value: 20 }
    ]);
    expect(favoriteToy.structuredEffects[0].action.Target).toMatchObject({
      $type: "TTargetCardXMost",
      TargetMode: "LeftMostCard",
      Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "toy" } }]
    });

    const passiveEnergy = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["Your items with no Cooldown have +25% Damage, Burn, Poison, Shield, Heal, and Regen"], tags)
    );
    expect(passiveEnergy.structuredEffects.map((effect) => effect.action.AttributeType)).toEqual([
      "DamageAmount",
      "Burn",
      "Poison",
      "Shield",
      "HealAmount",
      "RegenApplyAmount"
    ]);
    expect(passiveEnergy.structuredEffects.every((effect) => effect.action.Value?.$type === "TFixedValue")).toBe(true);
    expect(passiveEnergy.structuredEffects[0].action.Target).toMatchObject({
      $type: "TTargetCardSection",
      Conditions: [
        {
          $type: "TCardConditionalAttribute",
          AttributeType: "CooldownMax",
          ComparisonOperator: "Equal",
          Value: { $type: "TFixedValue", Value: 0 }
        }
      ]
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["Poison both Players 2 Poison"], tags)).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionPlayerPoisonApply",
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Both" }
      }
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["At the start of each fight, Poison yourself 2 Poison"], tags)).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionPlayerPoisonApply",
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" }
      }
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["At the start of each fight, Burn yourself 2 Burn"], tags)).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionPlayerBurnApply",
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" }
      }
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["Freeze an item for 1 Freeze second"], tags)).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionCardFreeze",
        Target: { $type: "TTargetCardRandom", TargetSection: "OpponentBoard" }
      }
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["Slow an item for 1 Slow second"], tags)).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionCardSlow",
        Target: { $type: "TTargetCardRandom", TargetSection: "OpponentBoard" }
      }
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["Charge this 1 Charge second"], tags)).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionCardCharge",
        Target: { $type: "TTargetCardSelf" }
      }
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(
      ["When you Enrage, this item can trigger an additional time this fight"],
      tags
    )).structuredEffects[0]).toMatchObject({
      trigger: { $type: "TTriggerOnEnrage", SourceEvent: "enrage" },
      action: {
        $type: "TActionEffectModify",
        SourceAction: "modify_effect",
        AttributeType: "EffectTrigger",
        Operation: "Add",
        Value: { $type: "TFixedValue", Value: 1 },
        Target: { $type: "TTargetEffect", Entity: "EffectInstance", Owner: "Self" }
      },
      projectionStatus: "exact"
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(
      ["Haste your other items for 1 Haste second(s)"],
      tags
    )).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionCardHaste",
        Target: { $type: "TTargetCardSection", TargetSection: "SelfHand", ExcludeSelf: true }
      }
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(
      ["The first time you fall below half Health each fight, Freeze ALL other items for 4 Freeze seconds"],
      tags
    )).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionCardFreeze",
        Target: { $type: "TTargetCardSection", TargetSection: "AllBoards", ExcludeSelf: true }
      }
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(
      ["Slow ANY other item 1 Slow second(s)"],
      tags
    )).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionCardSlow",
        Target: { $type: "TTargetCardRandom", TargetSection: "AllBoards", ExcludeSelf: true }
      }
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(
      ["Freeze ANY other item 1 Freeze second(s)"],
      tags
    )).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionCardFreeze",
        Target: { $type: "TTargetCardRandom", TargetSection: "AllBoards", ExcludeSelf: true }
      }
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(
      ["Heat your other Tools and Weapons for 3 seconds"],
      tags
    )).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionStatusModify",
        Target: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          ExcludeSelf: true,
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "AnyOf", Tags: ["weapon", "tool"] } }]
        },
        Status: "heated"
      }
    });

    const semanticPassiveItemUsed = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(
      ["When any other item is used, Charge this 1 Charge second"],
      tags
    )).structuredEffects[0];
    expect(semanticPassiveItemUsed).toMatchObject({
      trigger: {
        $type: "TTriggerOnItemUsed",
        SourceEvent: "item_used",
        Subject: { $type: "TTargetCardSection", TargetSection: "AllBoards", ExcludeSelf: true }
      },
      action: { $type: "TActionCardCharge", SourceAction: "charge", Target: { $type: "TTargetCardSelf" } }
    });
    expect(semanticPassiveItemUsed.trigger).not.toMatchObject({ EffectPredicate: expect.anything() });
    expect(semanticPassiveItemUsed.trigger?.Subject).not.toMatchObject({
      Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "any" } }]
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(
      ["Haste your other Tools and Weapons for 3 Haste second(s)"],
      tags
    )).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionCardHaste",
        Target: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          ExcludeSelf: true,
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "AnyOf", Tags: ["tool", "weapon"] } }]
        }
      }
    });

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(
      ["When you Enrage, this Slows an additional item"],
      tags
    )).structuredEffects[0]).toMatchObject({
      trigger: { $type: "TTriggerOnEnrage", SourceEvent: "enrage" },
      action: {
        $type: "TActionEffectModify",
        SourceAction: "modify_effect",
        AttributeType: "EffectMagnitude",
        Operation: "Add",
        Target: { $type: "TTargetEffect", Entity: "EffectTemplate", Owner: "Self", Predicate: { $type: "TEffectPredicateFamily", Family: "slow" } }
      }
    });

    const cleanse = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["The first time you fall below half Health each fight, Cleanse half your Burn and Poison"], tags)
    );
    expect(cleanse.structuredEffects.map((effect) => effect.action.$type)).toEqual(["TActionStatusModify", "TActionStatusModify"]);
    expect(cleanse.structuredEffects.map((effect) => effect.action.Status)).toEqual(["burn", "poison"]);

    const healAndCleanse = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["The first time you fall below half Health each fight, Heal equal to 30% of your Max Health and Cleanse half your Burn and Poison"], tags)
    );
    expect(healAndCleanse.structuredEffects.map((effect) => effect.action.$type)).toEqual([
      "TActionPlayerHeal",
      "TActionStatusModify",
      "TActionStatusModify"
    ]);

    const semanticEject = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["If you have a Vehicle, the first time you would be defeated each fight, Heal to half health and destroy one of your Vehicles"], tags)
    );
    expect(semanticEject.structuredEffects.map((effect) => effect.action.$type)).toEqual([
      "TActionPlayerPreventDamage",
      "TActionPlayerModifyAttribute",
      "TActionCardDestroy"
    ]);
    expect(semanticEject.structuredEffects[1]).toMatchObject({
      trigger: {
        $type: "TTriggerOnPlayerWouldBeDefeated",
        SourceEvent: "would_be_defeated",
        Limit: { Mode: "First", Count: 1, Reset: "Fight", Scope: "SourceEffectInstance" }
      },
      prerequisites: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "vehicle" } }],
      action: {
        SourceAction: "heal",
        AttributeType: "Health",
        Operation: "Set",
        Value: {
          $type: "TExpressionValue",
          Operator: "Multiply",
          Values: [
            { $type: "TFixedValue", Value: 0.5 },
            { $type: "TReferenceValuePlayerAttribute", AttributeType: "HealthMax" }
          ]
        },
        HealthSetMode: "HealToThreshold"
      },
      actionGraph: { RootNode: "Sequence", NodePath: [1], NodeIndex: 1, NodeCount: 3 },
      projectionStatus: "exact"
    });

    const semanticFrozenOrSlowed = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["When one of your items is Frozen or Slowed, Charge it 1 Charge second and Heal 25 Heal"], tags)
    );
    expect(semanticFrozenOrSlowed.structuredEffects.map((effect) => effect.action.$type)).toEqual([
      "TActionCardCharge",
      "TActionPlayerHeal"
    ]);
    expect(semanticFrozenOrSlowed.structuredEffects[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnEffectApplied",
        SourceEvent: "effect_applied",
        EffectPredicate: {
          $type: "TEffectPredicateOr",
          Predicates: [
            { $type: "TEffectPredicateFamily", Family: "freeze" },
            { $type: "TEffectPredicateFamily", Family: "slow" }
          ]
        }
      },
      action: {
        SourceAction: "charge",
        Target: { $type: "TTargetCardTriggerSource" }
      }
    });

    const removeAndCleanse = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["The first time you fall below half Health each fight, remove Freeze and Slow from your items and Cleanse half your Burn and Poison"], tags)
    );
    expect(removeAndCleanse.structuredEffects.map((effect) => effect.action.$type)).toEqual([
      "TActionStatusModify",
      "TActionStatusModify",
      "TActionStatusModify",
      "TActionStatusModify"
    ]);
    expect(removeAndCleanse.structuredEffects.map((effect) => effect.action.Status)).toEqual(["freeze", "slow", "burn", "poison"]);
    expect(removeAndCleanse.structuredEffects.every((effect) => effect.action.Operation === "Subtract")).toBe(true);

    const adjacentFreezeSlow = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["Adjacent items are affected by Freeze and Slow for half as long"], tags)
    );
    expect(adjacentFreezeSlow.structuredEffects.map((effect) => effect.action.$type)).toEqual([
      "TActionStatusDurationModify",
      "TActionStatusDurationModify"
    ]);
    expect(adjacentFreezeSlow.structuredEffects.map((effect) => effect.action.Target?.$type)).toEqual([
      "TTargetStatusApplication",
      "TTargetStatusApplication"
    ]);
    expect(adjacentFreezeSlow.structuredEffects.map((effect) =>
      effect.action.Target?.$type === "TTargetStatusApplication" ? effect.action.Target.Status : undefined
    )).toEqual(["freeze", "slow"]);
    expect(adjacentFreezeSlow.structuredEffects[0]).toMatchObject({
      action: {
        SourceAction: "modify_status_duration",
        AttributeType: "EffectDuration",
        Operation: "Multiply",
        Value: { $type: "TFixedValue", Value: 0.5 },
        Target: { Target: { $type: "TTargetCardPositional", TargetMode: "Neighbor" } }
      }
    });

    const flyingFreezeSlow = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["Your Flying items are affected by Freeze and Slow for half as long"], tags)
    );
    expect(flyingFreezeSlow.structuredEffects.map((effect) => effect.action.$type)).toEqual([
      "TActionStatusDurationModify",
      "TActionStatusDurationModify"
    ]);
    expect(flyingFreezeSlow.structuredEffects[0]).toMatchObject({
      action: {
        Target: {
          $type: "TTargetStatusApplication",
          Target: {
            $type: "TTargetCardSection",
            TargetSection: "SelfHand",
            Conditions: [{ $type: "TCardConditionalStatus", Status: "flying" }]
          }
        }
      }
    });

    const conditionalSlowDuration = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["If you have only one Weapon, it has Lifesteal and is affected by Slow for half as long"], tags)
    );
    expect(conditionalSlowDuration.structuredEffects.map((effect) => effect.action.$type)).toEqual([
      "TActionStatusModify",
      "TActionStatusDurationModify"
    ]);
    expect(conditionalSlowDuration.structuredEffects[1]).toMatchObject({
      action: {
        SourceAction: "modify_status_duration",
        Operation: "Multiply",
        Target: { $type: "TTargetStatusApplication", Status: "slow", Target: { $type: "TTargetCardSelf" } }
      }
    });

    const stopEnragedCleanse = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["When you stop being Enraged, Cleanse half your Burn and Poison"], tags)
    );
    expect(stopEnragedCleanse.structuredEffects.map((effect) => effect.action.Status)).toEqual(["burn", "poison"]);
    expect(stopEnragedCleanse.structuredEffects.every((effect) => effect.action.$type === "TActionStatusModify")).toBe(true);

    const cultCondition = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["If you are a Cult Member, reduce this item's cooldown by 1 second"], tags)
    );
    expect(cultCondition.structuredEffects[0]).toMatchObject({
      prerequisites: [
        {
          $type: "TPlayerConditionalState",
          Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" },
          StateType: "FactionMembership",
          StateValue: { $type: "TIdentifierValue", Value: "Cult" }
        }
      ],
      action: { $type: "TActionCardModifyAttribute", AttributeType: "CooldownMax" }
    });

    const fastestCooldown = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["At the start of each fight, the fastest enemy item has its cooldown increased by 1 second(s)"], tags)
    );
    expect(fastestCooldown.structuredEffects[0]).toMatchObject({
      trigger: { $type: "TTriggerOnFightStarted", SourceEvent: "combat_start" },
      action: {
        $type: "TActionCardModifyAttribute",
        AttributeType: "CooldownMax",
        Operation: "Add",
        Target: { $type: "TTargetCardXMost", TargetMode: "LowestCooldownCard", TargetSection: "OpponentBoard" },
        Value: { $type: "TFixedValue", Value: 1 }
      }
    });

    const slowestCooldown = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["At the start of each fight, the slowest enemy item has its cooldown increased by 1 second(s)"], tags)
    );
    expect(slowestCooldown.structuredEffects[0].action.Target).toMatchObject({
      $type: "TTargetCardXMost",
      TargetMode: "HighestCooldownCard",
      TargetSection: "OpponentBoard"
    });

    const enragedCondition = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["While you are Enraged, your items have +20 Damage"], tags)
    );
    expect(enragedCondition.structuredEffects[0]).toMatchObject({
      prerequisites: [
        {
          $type: "TPlayerConditionalState",
          Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" },
          StateType: "PlayerStatus",
          StateValue: { $type: "TIdentifierValue", Value: "enraged" }
        }
      ]
    });

    const tagUnion = parseSemanticEffectDocumentFromTexts(
      ["The first time you use a non-Burn or non-Poison item each fight, Charge your Burn and Poison items 1 Charge second(s)"],
      tags
    );
    expect(tagUnion.clauses[0].actions[0]).toMatchObject({
      node: "atomic",
      action: { type: "apply_effect", mechanic: "charge" }
    });

    const effectSequence = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(
        ["The first time you Freeze, Burn, Slow, Poison, and Haste each fight, Charge an item 1 Charge second(s)"],
        tags
      )
    );
    expect(effectSequence.structuredEffects[0].trigger).toMatchObject({
      $type: "TTriggerOnEffectSequenceCompleted",
      SourceEvent: "effect_sequence_completed",
      EffectPredicate: { $type: "TEffectPredicateAnd" },
      Limit: { Mode: "First", Count: 1, Reset: "Fight" }
    });

    expect(parseSemanticEffectDocumentFromTexts(["Adjacent items have +{aura.e1}% Crit Chance"], tags).clauses[0].actions[0]).toMatchObject({
      node: "atomic",
      action: {
        type: "modify_stat",
        stat: { domain: "card", id: "critChance" },
        amount: { kind: "identifier", value: "aura.e1" }
      }
    });

    const shieldTrigger = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(
        ["When you Shield, items to the left of this gain {ability.e1}"],
        tags,
        { placeholderKeywords: { "{ability.e1}": "Burn" } }
      )
    );
    expect(shieldTrigger.structuredEffects[0]).toMatchObject({
      trigger: { $type: "TTriggerOnCardPerformedShield", SourceEvent: "gain_shield" },
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "Burn",
        Value: { $type: "TIdentifierValue", Value: "ability.e1" },
        Target: { $type: "TTargetCardPositional", TargetMode: "LeftCard" }
      }
    });

    const unknownPlaceholderTrigger = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["When you Shield, items to the left of this gain {ability.e1}"], tags)
    );
    expect(unknownPlaceholderTrigger.structuredEffects[0]).toMatchObject({
      trigger: { $type: "TTriggerOnCardPerformedShield", SourceEvent: "gain_shield" },
      action: { $type: "TActionUnknown", SourceAction: "unknown" },
      projectionStatus: "unsupported"
    });

    const damageTrigger = projectSemanticDocumentToStructuredEffects(
      parseSemanticEffectDocumentFromTexts(["When you Damage, items to the right of this gain 10 Shield"], tags)
    );
    expect(damageTrigger.structuredEffects[0]).toMatchObject({
      trigger: { $type: "TTriggerOnCardPerformedDamage", SourceEvent: "deal_damage" },
      action: {
        $type: "TActionCardModifyAttribute",
        AttributeType: "Shield",
        Value: { $type: "TFixedValue", Value: 10 },
        Target: { $type: "TTargetCardPositional", TargetMode: "RightCard" }
      }
    });
  });

  it("parses exactly-one conditional skill continuations as conditional stat buffs", () => {
    const effects = parseEffectViews(
      [
        "If you have exactly one Weapon, it has +5 Ammo Max Ammo",
        "...if it is also Aquatic, it has +25 Damage"
      ]
    );

    expect(effects[0]).toMatchObject({
      trigger: { event: "condition_active" },
      action: { type: "gain_stat", value: 5, stat: "ammo" },
      target: { scope: "allied_items", tag: "weapon" },
      conditions: [{ type: "exactly_one", tag: "weapon" }]
    });
    expect(effects[1]).toMatchObject({
      trigger: { event: "condition_active" },
      action: { type: "gain_stat", value: 25, stat: "damage" },
      target: { scope: "allied_items", tag: "weapon" },
      conditions: [
        { type: "exactly_one", tag: "weapon" },
        { type: "target_has_tag", tag: "aquatic" }
      ]
    });
  });

  it("parses positional target filters", () => {
    expect(parseEffectView("Charge adjacent Small items 1 second").target).toMatchObject({
      scope: "adjacent",
      size: 1
    });
    expect(parseEffectView("If the item to the right is a Tool, Haste it").target).toMatchObject({
      scope: "right",
      tag: "tool"
    });
    expect(parseEffectView("Haste your leftmost item for 1 second").target?.scope).toBe("leftmost");
    expect(parseEffectView("Charge your rightmost item for 1 second").target?.scope).toBe("rightmost");
  });

  it("separates trigger-source position from action target position", () => {
    expect(parseEffectView("When you use any item to the right, Poison 3 Poison")).toMatchObject({
      trigger: { event: "item_used" },
      action: { type: "poison", value: 3 },
      target: { scope: "enemy" },
      triggerTarget: { scope: "right" }
    });
    expect(parseEffectView("If the item to the right is a Tool, Haste it")).toMatchObject({
      trigger: { event: "always" },
      action: { type: "haste" },
      target: { scope: "right", tag: "tool" }
    });
    expect(parseEffectView("When you use a Food, Slow it for 1 Slow second")).toMatchObject({
      trigger: { event: "tag_item_used", tag: "food" },
      action: { type: "slow", value: 1 },
      target: { scope: "trigger_source", tag: "food" },
      triggerTarget: { scope: "allied_items", tag: "food" }
    });
    expect(parseStructuredEffectsFromTexts(["When you use a Tool or Drone item, Burn 6 Burn"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnItemUsed",
        SourceEvent: "item_used",
        Subject: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "AnyOf", Tags: ["tool", "drone"] } }]
        }
      },
      action: { $type: "TActionPlayerBurnApply", SourceAction: "burn" }
    });
    expect(parseStructuredEffectsFromTexts(["When you use another non-Weapon item, Charge this 1 Charge second(s)"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnItemUsed",
        SourceEvent: "item_used",
        Subject: {
          $type: "TTargetCardSection",
          TargetSection: "SelfHand",
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "NoneOf", Tags: ["weapon"] } }]
        }
      },
      action: { $type: "TActionCardCharge", SourceAction: "charge", Target: { $type: "TTargetCardSelf" } }
    });
    expect(parseStructuredEffectsFromTexts(["When an enemy uses a Weapon or Burn item, Charge this 1 Charge second"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnItemUsed",
        SourceEvent: "item_used",
        Subject: {
          $type: "TTargetCardSection",
          TargetSection: "OpponentBoard",
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "AnyOf", Tags: ["weapon", "burn"] } }]
        }
      }
    });
    expect(parseEffectViews([
      "Haste adjacent items for 1 Haste second(s)",
      "When you Haste a Food, charge it 1 Charge second(s)"
    ])[1]).toMatchObject({
      trigger: { event: "effect_applied" },
      action: { type: "charge", value: 1 },
      target: { scope: "trigger_source", tag: "food" },
      triggerTarget: { scope: "allied_items", tag: "food" }
    });
    expect(parseEffectView("When you use an item, it gains 5 Crit% Crit Chance")).toMatchObject({
      trigger: { event: "item_used" },
      action: { type: "gain_stat", value: 5, stat: "crit" },
      target: { scope: "trigger_source" },
      triggerTarget: { scope: "allied_items" }
    });
    expect(parseEffectViews(["Slow adjacent items 1 second(s) and Charge them 1 second"])).toEqual([
      {
        trigger: { event: "cooldown_ready" },
        action: { type: "slow", value: 1, stat: "slow" },
        target: { scope: "adjacent" },
        rawText: "Slow adjacent items 1 second(s)"
      },
      {
        trigger: { event: "cooldown_ready" },
        action: { type: "charge", value: 1 },
        target: { scope: "adjacent" },
        rawText: "Charge them 1 second"
      }
    ]);
  });

  it("parses numeric stat gains as stat gains rather than tag assignment", () => {
    expect(parseEffectView("Your items gain 15 Shield")).toMatchObject({
      action: { type: "gain_stat", value: 15, stat: "shield" },
      target: { scope: "allied_items" }
    });
    expect(parseEffectView("A Food gains +4 Crit% Crit Chance")).toMatchObject({
      action: { type: "gain_stat", value: 4, stat: "crit" },
      target: { scope: "allied_items", tag: "food" }
    });
  });

  it("uses duration values for tempo and control actions instead of target counts", () => {
    expect(parseEffectView("Slow 2 items for 3 Slow second(s)")).toMatchObject({
      action: { type: "slow", value: 3 },
      target: { scope: "enemy_items" }
    });
    expect(parseEffectView("Charge 1 other item(s) 2 Charge seconds")).toMatchObject({
      action: { type: "charge", value: 2 },
      target: { scope: "allied_items" }
    });
  });

  it("splits compound action text into separate explainable effects", () => {
    expect(parseEffectViews(["When you use an adjacent Tool, Charge this 1 Charge second and your items gain 5 Damage"])).toEqual([
      {
        trigger: { event: "tag_item_used", tag: "tool" },
        action: { type: "charge", value: 1 },
        target: { scope: "self" },
        triggerTarget: { scope: "adjacent", tag: "tool" },
        rawText: "When you use an adjacent Tool, Charge this 1 Charge second"
      },
      {
        trigger: { event: "tag_item_used", tag: "tool" },
        action: { type: "gain_stat", value: 5, stat: "damage" },
        target: { scope: "allied_items" },
        triggerTarget: { scope: "adjacent", tag: "tool" },
        rawText: "When you use an adjacent Tool, your items gain 5 Damage"
      }
    ]);
    expect(parseEffectViews(["Adjacent items gain 20 Damage and 3 Burn"])).toEqual([
      {
        trigger: { event: "cooldown_ready" },
        action: { type: "gain_stat", value: 20, stat: "damage" },
        target: { scope: "adjacent" },
        rawText: "Adjacent items gain 20 Damage"
      },
      {
        trigger: { event: "cooldown_ready" },
        action: { type: "gain_stat", value: 3, stat: "burn" },
        target: { scope: "adjacent" },
        rawText: "Adjacent items gain 3 Burn"
      }
    ]);
  });

  it("parses sandstorm, redirect, prestige, and enrage utility text", () => {
    expect(parseEffectView("The Sandstorm Begins!")).toMatchObject({
      trigger: { event: "cooldown_ready" },
      action: { type: "start_sandstorm" },
      target: { scope: "self" }
    });
    expect(parseEffectView("When an enemy Freezes or Slows your items, this is targeted instead")).toMatchObject({
      trigger: { event: "always" },
      action: { type: "redirect" },
      target: { scope: "self" }
    });
    expect(parseEffectView("When you sell this, recover 5 Prestige")).toMatchObject({
      trigger: { event: "sell" },
      action: { type: "gain_stat", value: 5, stat: "prestige" },
      target: { scope: "self" }
    });
    expect(parseStructuredEffectsFromTexts(["Your Enrage lasts half as long"], tags)[0]).toMatchObject({
      kind: "aura",
      action: {
        $type: "TActionStatusDurationModify",
        SourceAction: "modify_status_duration",
        AttributeType: "EffectDuration",
        Operation: "Multiply",
        Value: { $type: "TFixedValue", Value: 0.5 },
        Target: {
          $type: "TTargetStatusApplication",
          Status: "Enraged",
          Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" }
        }
      },
      projectionStatus: "exact",
      rawText: "Your Enrage lasts half as long"
    });
  });

  it("projects remaining explicit legacy unknown token patterns without unsafe placeholders", () => {
    expect(parseStructuredEffectsFromTexts(["When you sell this, gain 1 XP"], tags)[0]).toMatchObject({
      trigger: { $type: "TTriggerOnCardSold", SourceEvent: "sell" },
      action: {
        $type: "TActionPlayerModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "Experience",
        Operation: "Add",
        Value: { $type: "TFixedValue", Value: 1 },
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" }
      }
    });

    expect(parseStructuredEffectsFromTexts(["When you Enrage, increase this item's Charge by 1 Charge second"], tags)[0]).toMatchObject({
      trigger: { $type: "TTriggerOnEnrage", SourceEvent: "enrage" },
      action: {
        $type: "TActionCardModifyAttribute",
        SourceAction: "gain_stat",
        AttributeType: "ChargeAmount",
        Operation: "Add",
        Value: { $type: "TFixedValue", Value: 1 },
        Target: { $type: "TTargetCardSelf" }
      },
      projectionStatus: "exact"
    });

    expect(parseStructuredEffectsFromTexts(["Your items are affected by Freeze for half as long"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionStatusDurationModify",
        SourceAction: "modify_status_duration",
        AttributeType: "EffectDuration",
        Operation: "Multiply",
        Value: { $type: "TFixedValue", Value: 0.5 },
        Target: {
          $type: "TTargetStatusApplication",
          Status: "Freeze",
          Target: { $type: "TTargetCardSection", TargetSection: "SelfHand" }
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["You need twice as much Rage to Enrage"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionPlayerModifyAttribute",
        SourceAction: "modify_stat",
        AttributeType: "RageRequirement",
        Operation: "Multiply",
        Value: { $type: "TFixedValue", Value: 2 },
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" }
      }
    });

    expect(parseStructuredEffectsFromTexts(["If you have another item with Burn, Poison, Slow, or Freeze, this has +1 Multicast for each"], tags)[0]).toMatchObject({
      prerequisites: [
        {
          $type: "TCardConditionalTagExpr",
          Expr: { $type: "AnyOf", Tags: ["burn", "poison", "slow", "freeze"] }
        }
      ],
      action: { $type: "TActionCardModifyAttribute", AttributeType: "Multicast" }
    });

    expect(parseStructuredEffectsFromTexts(["When you sell this, gain 2 Icicles"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionGameSpawnCards",
        SourceAction: "gain_item",
        Value: { $type: "TFixedValue", Value: 2 },
        Target: {
          $type: "TTargetCardRandom",
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "HasTag", Tag: "icicle" } }]
        }
      },
      projectionStatus: "partial"
    });

    expect(parseStructuredEffectsFromTexts(["When you use a Flying item, Vehicle or Drone, increase this by 8"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnItemUsed",
        Subject: {
          Conditions: [
            {
              $type: "TCardConditionalTagExpr",
              Expr: { $type: "AnyOf", Tags: ["flying", "vehicle", "drone"] }
            }
          ]
        }
      },
      action: {
        $type: "TActionEffectModify",
        SourceAction: "modify_effect",
        AttributeType: "EffectValue",
        Operation: "Add",
        Value: { $type: "TFixedValue", Value: 8 },
        Target: { $type: "TTargetEffect", Entity: "EffectInstance", Owner: "Self", Anchor: "PreviousSemanticAction" }
      },
      projectionStatus: "exact"
    });

    expect(parseStructuredEffectsFromTexts(["When you use a Small item, Haste a Burn, Poison or Freeze item for 1 Haste second"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnItemUsed",
        SourceEvent: "item_used",
        Subject: {
          Conditions: [{ $type: "TCardConditionalSize", Sizes: [1] }]
        }
      },
      action: {
        $type: "TActionCardHaste",
        SourceAction: "haste",
        AttributeType: "HasteAmount",
        Value: { $type: "TFixedValue", Value: 1 },
        Target: {
          $type: "TTargetCardRandom",
          Conditions: [{ $type: "TCardConditionalTagExpr", Expr: { $type: "AnyOf", Tags: ["burn", "poison", "freeze"] } }]
        }
      }
    });

    expect(parseStructuredEffectsFromTexts(["Poison both Players 2 Poison"], tags)[0]).toMatchObject({
      action: {
        $type: "TActionPlayerPoisonApply",
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Both" }
      }
    });

    expect(parseStructuredEffectsFromTexts(["When you stop being Enraged, Cleanse half your Burn and Poison"], tags)).toMatchObject([
      {
        trigger: { $type: "TTriggerOnStatusEnded", SourceEvent: "status_ended", Status: "enraged" },
        action: {
          $type: "TActionStatusModify",
          SourceAction: "modify_status",
          Operation: "Subtract",
          Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" },
          Status: "burn"
        }
      },
      {
        trigger: { $type: "TTriggerOnStatusEnded", SourceEvent: "status_ended", Status: "enraged" },
        action: { $type: "TActionStatusModify", Status: "poison" }
      }
    ]);

    const legacyRemoveAndCleanse = parseStructuredEffectsFromTexts(
      ["The first time you fall below half Health each fight, remove Freeze and Slow from your items and Cleanse half your Burn and Poison"],
      tags
    );
    expect(legacyRemoveAndCleanse.map((effect) => effect.action.Status)).toEqual(["freeze", "slow", "burn", "poison"]);
    expect(legacyRemoveAndCleanse.map((effect) => effect.action.Target?.$type)).toEqual([
      "TTargetCardSection",
      "TTargetCardSection",
      "TTargetPlayerRelative",
      "TTargetPlayerRelative"
    ]);

    expect(parseStructuredEffectsFromTexts(["If you are a Cult Member, reduce this item's cooldown by 1 second"], tags)[0]).toMatchObject({
      prerequisites: [
        {
          $type: "TPlayerConditionalState",
          Target: { $type: "TTargetPlayerRelative", TargetMode: "Self" },
          StateType: "FactionMembership",
          StateValue: { $type: "TIdentifierValue", Value: "Cult" }
        }
      ],
      action: { $type: "TActionCardModifyAttribute", AttributeType: "CooldownMax" }
    });

    expect(structuredUnknownTokenCount(parseStructuredEffectsFromTexts(["When you Shield, items to the left of this gain {ability.e1}"], tags))).toBeGreaterThan(0);
  });

  it("detects valid placements and invalid overlaps", () => {
    const first = item({ id: "wide", name: "Wide", size: 2 });
    const placements = placeItem([], first, 0);

    expect(isValidPlacement(placements, 1, 2, 10)).toBe(true);
    expect(isValidPlacement(placements, 1, 1, 10)).toBe(false);
    expect(isValidPlacement(placements, 2, 9, 10)).toBe(false);
  });

  it("detects left, right, and adjacent neighbors", () => {
    const left = item({ id: "left", name: "Left", size: 2 });
    const middle = item({ id: "middle", name: "Middle", size: 1 });
    const right = item({ id: "right", name: "Right", size: 1 });
    const placements = placeItem(placeItem(placeItem([], left, 0), middle, 2), right, 3);
    const leftPlacement = placements.find((placement) => placement.itemId === "left")!;
    const middlePlacement = placements.find((placement) => placement.itemId === "middle")!;
    const rightPlacement = placements.find((placement) => placement.itemId === "right")!;

    expect(isLeftOf(leftPlacement, middlePlacement)).toBe(true);
    expect(isRightOf(rightPlacement, middlePlacement)).toBe(true);
    expect(isAdjacent(leftPlacement, middlePlacement)).toBe(true);
    expect(getLeftNeighbor(middlePlacement, placements)?.itemId).toBe("left");
    expect(getRightNeighbor(middlePlacement, placements)?.itemId).toBe("right");
    expect(getAdjacentNeighbors(middlePlacement, placements).map((placement) => placement.itemId)).toEqual(["left", "right"]);
  });

  it("scores adjacent buffs when an adjacent payoff matches", () => {
    const buffer = item({
      id: "buffer",
      name: "Buffer",
      effectTexts: ["Haste adjacent Weapons for 1 second"]
    });
    const weapon = item({
      id: "weapon",
      name: "Weapon",
      tags: ["weapon"],
      cooldownMs: 8000,
      effectTexts: ["Deal 50 Damage"]
    });
    const placements = placeItem(placeItem([], buffer, 0), weapon, 1);

    const scored = scoreLayout({ items: [buffer, weapon], skills: [], placements, slotLimit: 10 });
    expect(scored.score).toBeGreaterThan(0);
    expect(scored.reasons.some((reason) => reason.includes("Buffer"))).toBe(true);
  });

  it("scores left-only effects only with a left neighbor", () => {
    const target = item({ id: "target", name: "Target", cooldownMs: 8000, effectTexts: ["Deal 50 Damage"] });
    const buffer = item({
      id: "buffer",
      name: "Buffer",
      effectTexts: ["Haste the item to the left for 1 second"]
    });
    const good = scoreLayout({ items: [target, buffer], skills: [], placements: placeItem(placeItem([], target, 0), buffer, 1), slotLimit: 10 });
    const bad = scoreLayout({ items: [target, buffer], skills: [], placements: placeItem(placeItem([], buffer, 0), target, 1), slotLimit: 10 });

    expect(good.score).toBeGreaterThan(bad.score);
    expect(bad.warnings.some((warning) => warning.includes("左侧"))).toBe(true);
  });

  it("scores right-only effects only with a right neighbor", () => {
    const buffer = item({
      id: "buffer",
      name: "Buffer",
      effectTexts: ["Charge the item to the right for 1 second"]
    });
    const target = item({ id: "target", name: "Target", cooldownMs: 8000, effectTexts: ["Deal 50 Damage"] });
    const good = scoreLayout({ items: [buffer, target], skills: [], placements: placeItem(placeItem([], buffer, 0), target, 1), slotLimit: 10 });
    const bad = scoreLayout({ items: [buffer, target], skills: [], placements: placeItem(placeItem([], target, 0), buffer, 1), slotLimit: 10 });

    expect(good.score).toBeGreaterThan(bad.score);
    expect(bad.warnings.some((warning) => warning.includes("右侧"))).toBe(true);
  });

  it("optimizes adjacent payoff next to an adjacent buffer", () => {
    const buffer = item({
      id: "buffer",
      name: "Buffer",
      effectTexts: ["Haste adjacent Weapons for 1 second"]
    });
    const weapon = item({
      id: "weapon",
      name: "Weapon",
      tags: ["weapon"],
      cooldownMs: 9000,
      effectTexts: ["Deal 50 Damage"]
    });
    const filler = item({ id: "filler", name: "Filler", effectTexts: ["Gain 10 Shield"] });
    const layoutResult = optimizeLayoutForBuild({ items: [weapon, filler, buffer], skills: [], beamWidth: 20 });
    const bufferPlacement = layoutResult.placements.find((placement) => placement.itemId === "buffer")!;
    const adjacentIds = getAdjacentNeighbors(bufferPlacement, layoutResult.placements).map((placement) => placement.itemId);

    expect(adjacentIds).toContain("weapon");
    expect(layoutResult.usedSlots).toBeLessThanOrEqual(10);
  });

  it("optimizer rejects item sets above the 10-slot limit", () => {
    const layoutResult = optimizeLayoutForBuild({
      items: [
        item({ id: "a", name: "A", size: 3 }),
        item({ id: "b", name: "B", size: 3 }),
        item({ id: "c", name: "C", size: 3 }),
        item({ id: "d", name: "D", size: 2 })
      ],
      skills: []
    });

    expect(layoutResult.placements).toHaveLength(0);
    expect(layoutResult.warnings.some((warning) => warning.includes("超过 10 格"))).toBe(true);
  });

  it("scores shield trigger synergy", () => {
    const producer = item({
      id: "shield",
      name: "Shield Producer",
      effectTexts: ["Gain 50 Shield"]
    });
    const reactor = skill({
      id: "reactor",
      name: "Shield Reactor",
      effectTexts: ["When you gain Shield, deal 50 Damage"]
    });

    const score = scoreEntityPair(producer, reactor);
    expect(score.score).toBeGreaterThan(0);
    expect(score.reasons.length).toBeGreaterThan(0);
  });

  it("scores effects into mechanic buckets", () => {
    expect(scoreEffectMechanics(parseEffectView("Burn 5"))).toMatchObject({ burn: 18, damage: 8 });
    expect(scoreEffectMechanics(parseEffectView("Freeze an enemy item"))).toMatchObject({ freeze: 16, control: 14 });
    expect(scoreEffectMechanics(parseEffectView("Charge an item 1 second"))).toMatchObject({ charge: 18, tempo: 16 });
  });

  it("scores item and skill mechanics", () => {
    const weapon = item({
      id: "weapon-mechanic",
      name: "Weapon Mechanic",
      tags: ["weapon"],
      effectTexts: ["Deal 50 Damage"]
    });
    const freezingSkill = skill({
      id: "freeze-skill",
      name: "Freeze Skill",
      effectTexts: ["Freeze an enemy item"]
    });

    expect(scoreItemMechanics(weapon).weapon_damage).toBeGreaterThan(20);
    expect(scoreSkillMechanics(freezingSkill)).toMatchObject({ freeze: 16, control: 14 });
  });

  it("uses semantic mechanics for complex effects that legacy structured parsing cannot represent", () => {
    const rateLimiterScores = scoreSemanticMechanics(parseSemanticEffectDocumentFromTexts(["All Charge effects are reduced by half"], tags));
    expect(rateLimiterScores.charge).toBeGreaterThan(0);
    expect(rateLimiterScores.tempo).toBeGreaterThan(0);

    const stoveScores = scoreSemanticMechanics(parseSemanticEffectDocumentFromTexts(["One of your slots becomes a Stove (The item here is Heated)"], tags));
    expect(stoveScores.burn).toBeGreaterThan(0);
    expect(stoveScores.scaling).toBeGreaterThan(0);
  });

  it("detects shield scaling and crit mechanics", () => {
    const shieldScaling = scoreEffectMechanics({
      trigger: { event: "gain_shield" },
      action: { type: "damage", value: 20 },
      target: { scope: "enemy" },
      rawText: "When you gain Shield, deal 20 Damage"
    });
    const critScaling = scoreEffectMechanics({
      trigger: { event: "cooldown_ready" },
      action: { type: "gain_stat", stat: "critChance", value: 10 },
      target: { scope: "self" },
      rawText: "Gain 10 Crit Chance"
    });

    expect(shieldScaling.shield_scaling).toBeGreaterThan(0);
    expect(critScaling.crit).toBeGreaterThan(0);
    expect(critScaling.scaling).toBeGreaterThan(0);
  });

  it("does not make bare tempo the primary mechanic without payoff", () => {
    const speedOnly = item({
      id: "speed-only",
      name: "Speed Only",
      effectTexts: ["Haste an item for 1 second"]
    });

    const result = buildMechanicProfile({ items: [speedOnly], skills: [] });

    expect(result.primary).not.toBe("haste");
    expect(result.roles.winCondition).not.toContain("haste");
    expect(result.scores.haste).toBeLessThan(25);
  });

  it("raises realized tempo when adjacent haste hits a payoff", () => {
    const buffer = item({
      id: "tempo-buffer",
      name: "Tempo Buffer",
      effectTexts: ["Haste adjacent Weapons for 1 second"]
    });
    const weapon = item({
      id: "tempo-weapon",
      name: "Tempo Weapon",
      tags: ["weapon"],
      cooldownMs: 8000,
      effectTexts: ["Deal 50 Damage"]
    });
    const filler = item({
      id: "tempo-filler",
      name: "Tempo Filler",
      effectTexts: ["Gain 10 Shield"]
    });

    const activeLayout = layout({
      placements: placeItem(placeItem(placeItem([], buffer, 0), weapon, 1), filler, 2)
    });
    const inactiveLayout = layout({
      placements: placeItem(placeItem(placeItem([], buffer, 0), filler, 1), weapon, 2)
    });
    const active = buildMechanicProfile({ items: [buffer, weapon, filler], skills: [], layout: activeLayout });
    const inactive = buildMechanicProfile({ items: [buffer, weapon, filler], skills: [], layout: inactiveLayout });

    expect(active.scores.haste).toBeGreaterThan(inactive.scores.haste);
    expect(active.scores.tempo).toBeGreaterThan(inactive.scores.tempo);
  });

  it("scores conditional skill mechanics only when the item condition is satisfied", () => {
    const depthCharge = skill({
      id: "depth-charge",
      name: "Depth Charge",
      effectTexts: [
        "If you have exactly one Weapon, it has +5 Ammo Max Ammo",
        "...if it is also Aquatic, it has +25 Damage"
      ]
    });
    const aquaticWeapon = item({
      id: "aquatic-weapon",
      name: "Aquatic Weapon",
      tags: ["weapon", "aquatic"],
      effectTexts: ["Deal 10 Damage"]
    });
    const plainWeapon = item({
      id: "plain-weapon",
      name: "Plain Weapon",
      tags: ["weapon"],
      effectTexts: ["Deal 10 Damage"]
    });
    const extraWeapon = item({
      id: "extra-weapon",
      name: "Extra Weapon",
      tags: ["weapon"],
      effectTexts: ["Deal 10 Damage"]
    });

    const aquatic = buildMechanicProfile({ items: [aquaticWeapon], skills: [depthCharge] });
    const nonAquatic = buildMechanicProfile({ items: [plainWeapon], skills: [depthCharge] });
    const twoWeapons = buildMechanicProfile({ items: [aquaticWeapon, extraWeapon], skills: [depthCharge] });

    expect(aquatic.scores.damage).toBeGreaterThan(nonAquatic.scores.damage);
    expect(nonAquatic.scores.scaling).toBeGreaterThan(twoWeapons.scores.scaling);
  });

  it("infers primary and secondary mechanics from a build profile", () => {
    const weapon = item({
      id: "crit-weapon",
      name: "Crit Weapon",
      tags: ["weapon"],
      effectTexts: ["Deal 50 Damage"]
    });
    const critSkill = skill({
      id: "crit-skill",
      name: "Crit Skill",
      effectTexts: [
        "When combat starts, your items gain 20 Crit Chance",
        "When you deal Damage, gain 5 Crit Chance"
      ]
    });

    const result = buildMechanicProfile({ items: [weapon], skills: [critSkill] });

    expect(result.primary).toBe("weapon_damage");
    expect(result.secondary).toContain("crit");
    expect(result.labels).toContain("Crit Weapon Damage");
  });

  it("prefers a specific damage-over-time primary over generic damage when both are high", () => {
    const burner = item({
      id: "burner",
      name: "Burner",
      effectTexts: ["Burn 5", "When you Burn, Burn 5", "Deal 50 Damage"]
    });

    const result = buildMechanicProfile({ items: [burner], skills: [] });

    expect(result.scores.damage).toBeGreaterThanOrEqual(result.scores.burn);
    expect(result.primary).toBe("burn");
  });

  it("generates deduplicated builds within the slot limit", () => {
    const hero: HeroDef = { id: "common", name: "Common", slug: "common", imageUrl: null };
    const items = [
      item({ id: "a", name: "A", size: 3, effectTexts: ["Deal 10 Damage"] }),
      item({ id: "b", name: "B", size: 3, effectTexts: ["Gain 10 Shield"] }),
      item({ id: "c", name: "C", size: 2, effectTexts: ["Burn 5"] }),
      item({ id: "d", name: "D", size: 1, effectTexts: ["Poison 5"] }),
      item({ id: "e", name: "E", size: 1, effectTexts: ["Haste an item for 1 second"] }),
      item({ id: "e", name: "E Duplicate", size: 1, effectTexts: ["Haste an item for 1 second"] })
    ];

    const builds = generateBuilds(
      { heroes: [hero], items, skills: [] },
      { boardSlotLimit: 10, maxItems: 5, maxSkills: 0, beamWidth: 20, topBuildsPerHero: 20 }
    );
    const keys = new Set(builds.map((build) => [...build.itemIds].sort().join("|")));

    expect(builds.length).toBeGreaterThan(0);
    expect(keys.size).toBe(builds.length);
    expect(builds.every((build) => build.usedSlots <= 10)).toBe(true);
    expect(builds.every((build) => build.layout.slotLimit === 10)).toBe(true);
    expect(builds.every((build) => build.layout.placements.length === build.itemIds.length)).toBe(true);
    expect(builds.every((build) => build.mechanicProfile.primary)).toBe(true);
  });

  it("searches exact and similar generated builds", () => {
    const builds: GeneratedBuild[] = [
      generatedBuild({
        id: "one",
        hero: "vanessa",
        itemIds: ["a", "b"],
        itemNames: ["A", "B"],
        skillIds: ["s"],
        skillNames: ["S"],
        layout: layout({ usedSlots: 4, layoutScore: 10 }),
        layoutScore: 10,
        powerScore: 90,
        mechanicProfile: profile("weapon_damage", { crit: 80, haste: 60, tempo: 65 })
      }),
      generatedBuild({
        id: "two",
        hero: "vanessa",
        itemIds: ["a", "c"],
        itemNames: ["A", "C"],
        layout: layout({ usedSlots: 4, layoutScore: 80 }),
        layoutScore: 80,
        powerScore: 70,
        mechanicProfile: profile("poison", { poison: 80, slow: 35, control: 35 })
      })
    ];

    expect(searchGeneratedBuilds(builds, { hero: "vanessa", itemIds: ["a", "b"], mode: "exact" })).toHaveLength(1);
    expect(searchGeneratedBuilds(builds, { hero: "vanessa", itemIds: ["b", "c"], mode: "similar" })).toHaveLength(2);
    expect(searchGeneratedBuilds(builds, { hero: "vanessa", itemIds: ["a"], mode: "similar" })[0].layout.layoutScore).toBeGreaterThan(0);
    expect(calculateMechanicMatchScore(builds[0].mechanicProfile, { coreOutputs: ["crit"], tempoMechanics: ["haste"] })).toBe(70);
    expect(searchGeneratedBuilds(builds, { hero: "vanessa", coreOutputs: ["crit"], tempoMechanics: ["haste"], mode: "mechanic" })[0].id).toBe("one");

    const recs = recommendNextItems(builds, { hero: "vanessa", itemIds: ["a"] });
    expect(recs.map((rec) => rec.itemId)).toContain("b");
    expect(recs.map((rec) => rec.itemId)).toContain("c");

    const mechanicRecs = recommendNextItems(
      builds,
      { hero: "vanessa", coreOutputs: ["crit"], tempoMechanics: ["haste"] },
      10,
      [
        item({
          id: "a",
          name: "A",
          effectTexts: ["When combat starts, gain 10 Crit Chance"]
        }),
        item({
          id: "b",
          name: "B",
          effectTexts: ["Haste an item for 1 second"]
        }),
        item({
          id: "c",
          name: "C",
          effectTexts: ["Poison 5"]
        })
      ]
    );
    expect(mechanicRecs[0].itemId).toBe("a");
    expect(mechanicRecs[0].reasons?.[0]).toContain("Crit");
    expect(mechanicRecs.map((rec) => rec.itemId)).not.toContain("c");
  });

  it("does not recommend zero-burn items for a pure burn mechanic filter", () => {
    const builds: GeneratedBuild[] = [
      generatedBuild({
        id: "burn-build",
        hero: "vanessa",
        itemIds: ["burn-payoff", "knife"],
        itemNames: ["Burn Payoff", "Spring Knife"],
        layout: layout({ usedSlots: 3, layoutScore: 70 }),
        layoutScore: 70,
        powerScore: 95,
        mechanicProfile: profile("burn", { burn: 90, damage: 100 })
      })
    ];

    const recs = recommendNextItems(
      builds,
      { hero: "vanessa", coreOutputs: ["burn"] },
      10,
      [
        item({
          id: "burn-payoff",
          name: "Burn Payoff",
          effectTexts: ["Burn 5"]
        }),
        item({
          id: "knife",
          name: "Spring Knife",
          tags: ["weapon", "damage"],
          effectTexts: ["Deal 4 Damage"]
        })
      ]
    );

    expect(recs.map((rec) => rec.itemId)).toEqual(["burn-payoff"]);
  });
});
