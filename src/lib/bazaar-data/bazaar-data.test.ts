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
  hidden_tags: ["Shield", "Damage", "Haste", "Freeze", "Tech", "Ammo", "Burn", "Poison", "Regen", "Charge", "PoisonReference"],
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
      projection: { structuredEffectIds: ["0"], status: "lossy" }
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
      projection: { status: "lossy" }
    });
  });

  it("projects semantic documents conservatively back to legacy structured effects", () => {
    const simple = parseSemanticEffectDocumentFromTexts(["When you use a Tool item, Charge an adjacent item 1 second"], tags);
    const simpleProjection = projectSemanticDocumentToStructuredEffects(simple);
    expect(simpleProjection).toMatchObject({
      status: "partial",
      structuredEffects: [
        {
          action: {
            $type: "TActionCardCharge",
            SourceAction: "charge",
            Value: { $type: "TFixedValue", Value: 1 }
          },
          semanticSourceIds: ["c_0_when_item_used"],
          projectionStatus: "partial"
        }
      ]
    });

    const rateLimiter = parseSemanticEffectDocumentFromTexts(["All Charge effects are reduced by half"], tags);
    expect(projectSemanticDocumentToStructuredEffects(rateLimiter)).toMatchObject({
      status: "lossy",
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
            Rounding: "Unknown"
          },
          semanticSourceIds: ["c_0_charge_effect_modifier"],
          projectionStatus: "lossy"
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
        Rounding: "Unknown"
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
            Conditions: [{ $type: "TCardConditionalStatus", Status: "chilled" }]
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
        ],
        warnings: [{ code: "ATTRIBUTE_INFERRED_FROM_TAG" }]
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
            { node: "atomic", action: { type: "prevent_damage" } },
            { node: "atomic", action: { type: "apply_effect", mechanic: "heal" } }
          ]
        }
      ]
    });
    expect(projectSemanticDocumentToStructuredEffects(memento).structuredEffects[0].trigger).toMatchObject({
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
      action: { type: "flying" },
      target: { scope: "adjacent" }
    });
    expect(parseEffectView("At the start of each day, get a Catalyst")).toMatchObject({
      trigger: { event: "level_up" },
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

    expect(parseStructuredEffectsFromTexts(["The first time you would be defeated each fight, Heal 200 Heal"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnConditionMet",
        SourceEvent: "condition_active",
        Limit: { Mode: "First", Count: 1, Reset: "Fight", Scope: "SourceEffectInstance" }
      },
      action: { $type: "TActionPlayerHeal", SourceAction: "heal", Value: { $type: "TFixedValue", Value: 200 } }
    });

    expect(parseStructuredEffectsFromTexts(["If you have a Vehicle, the first time you would be defeated each fight, destroy one of your Vehicles"], tags)[0]).toMatchObject({
      trigger: {
        $type: "TTriggerOnConditionMet",
        SourceEvent: "condition_active",
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

  it("separates exact semantic projections from partial and lossy audit results", () => {
    const exactProjection = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["An item starts Flying"], tags));
    expect(exactProjection.status).toBe("exact");
    expect(projectionAudit(exactProjection.structuredEffects).status).toBe("exact");

    const partialProjection = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["At the start of each day, get a Catalyst"], tags));
    expect(partialProjection.status).toBe("partial");
    expect(projectionAudit(partialProjection.structuredEffects).reasons).toContain("partial projection");

    const lossyProjection = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["All Charge effects are reduced by half"], tags));
    expect(lossyProjection.status).toBe("lossy");
    expect(projectionAudit(lossyProjection.structuredEffects, parseSemanticEffectDocumentFromTexts(["All Charge effects are reduced by half"], tags))).toMatchObject({
      status: "lossy",
      warningCodes: ["ROUNDING_UNKNOWN"]
    });
  });

  it("counts structured unknown tokens beyond full unknown effects", () => {
    expect(structuredUnknownTokenCount(parseStructuredEffectsFromTexts(["When you Shield, items to the left of this gain {ability.e1}"], tags))).toBeGreaterThan(0);
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
      actions: [{ node: "atomic", action: { type: "gain_item", item: { predicates: { op: "or" } } } }]
    });

    expect(parseSemanticEffectDocumentFromTexts(["Transform into a copy of another Small, non-Legendary item you have"], tags).clauses[0].actions[0]).toMatchObject({
      node: "atomic",
      action: { type: "transform_item", description: "a copy of another Small, non-Legendary item you have" }
    });

    expect(parseSemanticEffectDocumentFromTexts(["When this is transformed, Enchant it with Toxic if able"], tags).clauses[0]).toMatchObject({
      kind: "triggered",
      actions: [{ node: "atomic", action: { type: "enchant_item", enchantment: "Toxic" } }]
    });

    expect(parseSemanticEffectDocumentFromTexts(["When you sell this, upgrade your leftmost item"], tags).clauses[0]).toMatchObject({
      kind: "triggered",
      trigger: { event: "item_sold" },
      actions: [{ node: "atomic", action: { type: "upgrade_item" } }]
    });

    const projected = projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["At the start of each day, get a Catalyst"], tags));
    expect(projected.structuredEffects[0]).toMatchObject({
      trigger: { $type: "TTriggerOnCardUpgraded", SourceEvent: "level_up" },
      action: { $type: "TActionGameSpawnCards", SourceAction: "gain_item" },
      projectionStatus: "partial"
    });
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
      action: { $type: "TActionCardAddTagsList", SourceAction: "buff_tag", Tags: ["copied_types"] },
      projectionStatus: "partial"
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

    expect(projectSemanticDocumentToStructuredEffects(parseSemanticEffectDocumentFromTexts(["Poison both Players 2 Poison"], tags)).structuredEffects[0]).toMatchObject({
      action: {
        $type: "TActionPlayerPoisonApply",
        Target: { $type: "TTargetPlayerRelative", TargetMode: "Both" }
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

    expect(parseSemanticEffectDocumentFromTexts(["Adjacent items have +{aura.e1}% Crit Chance"], tags).clauses[0].actions[0]).toMatchObject({
      node: "atomic",
      action: {
        type: "modify_stat",
        stat: { domain: "card", id: "critChance" },
        amount: { kind: "identifier", value: "aura.e1" }
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
      trigger: { $type: "TTriggerOnItemUsed" },
      action: {
        $type: "TActionEffectModify",
        SourceAction: "modify_effect",
        AttributeType: "EffectValue",
        Operation: "Add",
        Value: { $type: "TFixedValue", Value: 8 },
        Target: { $type: "TTargetEffect", Entity: "EffectInstance", Owner: "Self" }
      },
      projectionStatus: "partial"
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
