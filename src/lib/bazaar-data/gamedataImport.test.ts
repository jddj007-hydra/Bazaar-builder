import { describe, expect, it } from "vitest";
import {
  attributesWithPrices,
  baseTierKey,
  buildHeroes,
  buildImageManifest,
  buildRawCard,
  buildTags,
  classifyCombatRelevance,
  deriveMerchants,
  derivePrice,
  deriveSources,
  effectiveTierAttributes,
  insertKeyword,
  isDebugCard,
  resolveActionTargets,
  resolveActionValue,
  resolveToken,
  resolveValueExpression,
  stripBracketAnnotations
} from "./gamedataImport";

const noTranslation = (key: string | null, english: string) => key ?? english;

const standardPrices = {
  ItemBuyPrices: { Small: { Bronze: 2, Silver: 4 }, Medium: { Bronze: 3, Silver: 6 } },
  ItemSellPrices: { Small: { Bronze: 1, Silver: 2 }, Medium: { Bronze: 1, Silver: 3 } },
  SkillBuyPrices: { Medium: { Bronze: 4, Silver: 8 } },
  SkillSellPrices: { Medium: { Bronze: 2, Silver: 4 } }
};

function card(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    Id: "card-1",
    Type: "Item",
    Size: "Small",
    StartingTier: "Bronze",
    SpawningEligibility: "Always",
    Heroes: ["Common"],
    Tags: ["Item", "Small", "Common"],
    HiddenTags: [],
    Localization: { Title: { Text: "Test Card", Key: "title-key" } },
    Tiers: {
      Bronze: { Attributes: { DamageAmount: 5 }, AbilityIds: ["0"], TooltipIds: [0] },
      Silver: { Attributes: { DamageAmount: 10 } }
    },
    Abilities: {
      "0": { Action: { $type: "TActionPlayerDamage", Value: { $type: "TFixedValue", Value: 5 } } }
    },
    Auras: {},
    Enchantments: {},
    ...overrides
  };
}

describe("gamedata importer", () => {
  describe("card filtering", () => {
    it("drops debug and template records", () => {
      expect(isDebugCard(card({ Localization: { Title: { Text: "[DEBUG] Sword" } } }))).toBe(true);
      expect(isDebugCard(card({ InternalName: "SkillCard - Internal" }))).toBe(true);
      expect(isDebugCard(card({ Localization: { Title: { Text: "Unused Card" } } }))).toBe(true);
      expect(isDebugCard(card({ Localization: { Title: { Text: "Katana" }, }, InternalName: "katana" }))).toBe(false);
      expect(isDebugCard(card({ Localization: { Title: { Text: "[Community Team] Katana" } } }))).toBe(false);
    });
  });

  describe("tier inheritance", () => {
    it("starts at StartingTier", () => {
      expect(baseTierKey(card({ StartingTier: "Silver" }))).toBe("Silver");
    });

    it("falls back to the highest shipped tier below a missing starting tier", () => {
      const legendary = card({
        StartingTier: "Legendary",
        Tiers: { Diamond: { Attributes: { DamageAmount: 20 } } }
      });
      expect(baseTierKey(legendary)).toBe("Diamond");
    });

    it("inherits attributes forward from lower tiers", () => {
      const value = card({
        Tiers: {
          Bronze: { Attributes: { DamageAmount: 5, HealthMax: 3 } },
          Silver: { Attributes: { DamageAmount: 10 } },
          Gold: { Attributes: { DamageAmount: 15 } }
        }
      });
      expect(effectiveTierAttributes(value, "Silver")).toEqual({ DamageAmount: 10, HealthMax: 3 });
      expect(effectiveTierAttributes(value, "Bronze")).toEqual({ DamageAmount: 5, HealthMax: 3 });
    });
  });

  describe("prices", () => {
    it("derives standard prices from size and tier", () => {
      expect(derivePrice(standardPrices, "Item", "Small", "Silver", "buy")).toBe(4);
      expect(derivePrice(standardPrices, "Item", "Medium", "Bronze", "sell")).toBe(1);
      expect(derivePrice(standardPrices, "Skill", "Small", "Bronze", "buy")).toBe(4);
    });

    it("does not override explicit prices", () => {
      const attributes = attributesWithPrices(
        { BuyPrice: 99, DamageAmount: 4 },
        standardPrices,
        "Item",
        "Small",
        "Bronze"
      );
      expect(attributes.BuyPrice).toBe(99);
      expect(attributes.SellPrice).toBe(1);
    });
  });

  describe("value expressions", () => {
    it("resolves fixed and referenced values", () => {
      expect(resolveValueExpression({ $type: "TFixedValue", Value: 7 }, {}).value).toBe(7);
      expect(
        resolveValueExpression(
          { $type: "TReferenceValueCardAttribute", AttributeType: "DamageAmount" },
          { DamageAmount: 12 }
        ).value
      ).toBe(12);
    });

    it("converts millisecond attributes to seconds", () => {
      const resolved = resolveValueExpression(
        { $type: "TReferenceValueCardAttribute", AttributeType: "HasteAmount" },
        { HasteAmount: 2000 }
      );
      expect(resolved.value).toBe(2);
      expect(resolved.timeScaled).toBe(true);
    });

    it("applies value modifiers", () => {
      const resolved = resolveValueExpression(
        {
          $type: "TReferenceValueCardAttribute",
          AttributeType: "DamageAmount",
          Modifier: { Value: { $type: "TFixedValue", Value: 2 }, ModifyMode: "Multiply", ShouldRound: true }
        },
        { DamageAmount: 5 }
      );
      expect(resolved.value).toBe(10);
    });

    it("reads action values, targets and modifier chains", () => {
      expect(
        resolveActionValue(
          { $type: "TActionCardHaste", Value: { $type: "TReferenceValueCardAttribute", AttributeType: "HasteAmount" } },
          { HasteAmount: 3000 }
        )
      ).toBe(3);
      expect(
        resolveActionTargets({ $type: "TActionPlayerDamage", TargetCount: { $type: "TFixedValue", Value: 3 } }, {})
      ).toBe(3);
      expect(
        resolveToken(
          "{ability.0.mod}",
          {
            Abilities: {
              "0": {
                Action: {
                  $type: "TActionPlayerDamage",
                  Value: {
                    $type: "TFixedValue",
                    Value: 1,
                    Modifier: { Value: { $type: "TFixedValue", Value: 4 }, ModifyMode: "Multiply" }
                  }
                }
              }
            }
          },
          {}
        )
      ).toBe(4);
    });

    it("resolves custom and fallback tokens", () => {
      expect(resolveToken("{custom_0}", {}, { Custom_0: 9 })).toBe(9);
      expect(resolveToken("{TempoCost}", {}, { TempoCost: 2 })).toBe(2);
      expect(resolveToken("{custom_0 ?? custom_1}", {}, { Custom_1: 3 })).toBe(3);
      expect(resolveToken("{unknown}", {}, {})).toBeUndefined();
    });

    it("reads spawn counts from SpawnContext.Limit", () => {
      const action = {
        $type: "TActionGameSpawnCards",
        SpawnContext: { Limit: { $type: "TFixedValue", Value: 3 } }
      };
      expect(resolveActionValue(action, {})).toBe(3);
    });

    it("falls back to the other node kind and to DefaultValue", () => {
      expect(
        resolveToken(
          "{ability.0}",
          { Abilities: {}, Auras: { "0": { Action: { $type: "TActionPlayerPoisonApply", AttributeType: "PoisonApplyAmount" } } } },
          { PoisonApplyAmount: 4 }
        )
      ).toBe(4);

      expect(
        resolveValueExpression(
          { $type: "TReferenceValueCardAttribute", AttributeType: "Custom_7", DefaultValue: 0 },
          {}
        ).value
      ).toBe(0);

      expect(
        resolveValueExpression(
          { $type: "TReferenceValueCardAttributeAggregate", AttributeType: "SellPrice", DefaultValue: 0 },
          {}
        ).value
      ).toBe(0);
    });
  });

  describe("keyword insertion", () => {
    it("inserts a missing keyword after the value", () => {
      expect(insertKeyword("Deal {ability.0}.", "{ability.0}", "Damage", "en-US")).toBe("Deal {ability.0} Damage.");
      expect(insertKeyword("造成 {ability.0}。", "{ability.0}", "Damage", "zh-CN")).toBe("造成 {ability.0}伤害。");
    });

    it("does not duplicate an existing keyword or unit", () => {
      expect(insertKeyword("Deal {ability.0} Damage.", "{ability.0}", "Damage", "en-US")).toBe(
        "Deal {ability.0} Damage."
      );
      expect(insertKeyword("Haste for {ability.0} seconds.", "{ability.0}", "Haste", "en-US")).toBe(
        "Haste for {ability.0} seconds."
      );
      expect(insertKeyword("获得 {ability.0} 秒加速。", "{ability.0}", "Haste", "zh-CN")).toBe(
        "获得 {ability.0} 秒加速。"
      );
    });

    it("drops runtime bracket annotations", () => {
      expect(stripBracketAnnotations("Your items have +{aura.0.mod} for each Food you have [{aura.0}]")).toBe(
        "Your items have +{aura.0.mod} for each Food you have"
      );
      expect(stripBracketAnnotations("Shield equal to {aura.9}% of your Max Health [{ability.0} Shield]")).toBe(
        "Shield equal to {aura.9}% of your Max Health"
      );
      expect(stripBracketAnnotations("A plain tooltip")).toBe("A plain tooltip");
    });
  });

  describe("raw card output", () => {
    it("emits the normalized raw shape with localized tooltips", () => {
      const raw = buildRawCard(
        card({
          Localization: {
            Title: { Text: "Test Card", Key: "title-key" },
            Tooltips: [{ Content: { Key: "tooltip-key", Text: "Deal {ability.0}." }, TooltipType: "Active" }]
          }
        }),
        {
          standardPrices,
          translate: noTranslation,
          artIndex: { "card-1": { source: "unity-card", asset: "card" } },
          existingImageIds: new Set(),
          patch: "2026-10-13",
          scrapedAt: "2026-10-19T00:00:00.000Z"
        }
      );

      expect(raw.Heroes).toEqual(["Common"]);
      expect(raw.SpawningEligibility).toBe("Always");
      expect(raw.image_url).toBe("/images/cards/card-1.webp");
      expect((raw.Tiers as Record<string, { OverrideAttributes: Record<string, number> }>).Silver.OverrideAttributes).toEqual({
        DamageAmount: 10,
        BuyPrice: 4,
        SellPrice: 2
      });
      expect((raw.Tooltips as Array<{ Content: { Text: string } }>)[0].Content.Text).toBe("Deal {ability.0} Damage.");
      expect(raw.TooltipReplacements).toEqual({ "{ability.0}": { Fixed: 5 } });
    });

    it("marks cards without art", () => {
      const raw = buildRawCard(card({}), {
        standardPrices,
        translate: noTranslation,
        artIndex: {},
        existingImageIds: new Set(),
        patch: "2026-10-13",
        scrapedAt: "2026-10-19T00:00:00.000Z"
      });
      expect(raw.image_url).toBeNull();
    });
  });

  describe("combat relevance", () => {
    it("treats a card fired on a cooldown as combat", () => {
      expect(classifyCombatRelevance(card({})).relevance).toBe("combat");
    });

    it("marks sell-only loot as economy", () => {
      const loot = card({
        Abilities: {
          "0": {
            Trigger: { $type: "TTriggerOnCardSold" },
            Action: { $type: "TActionCardModifyAttribute", AttributeType: "CritChance" }
          }
        }
      });
      expect(classifyCombatRelevance(loot)).toEqual({ relevance: "economy", reason: "out-of-combat-trigger" });
    });

    it("marks packages that only sell for a reward as economy", () => {
      const pack = card({
        Abilities: {
          "0": {
            Trigger: { $type: "TTriggerOnCardSold" },
            Action: { $type: "TActionGameSpawnCards" }
          },
          "1": {
            Trigger: { $type: "TTriggerOnCardSold" },
            Action: { $type: "TActionPlayerModifyAttribute", AttributeType: "Experience" }
          }
        }
      });
      expect(classifyCombatRelevance(pack).relevance).toBe("economy");
    });

    it("marks cards with no effects as economy only when they are items", () => {
      expect(classifyCombatRelevance(card({ Abilities: {}, Auras: {} }))).toEqual({
        relevance: "economy",
        reason: "no-effects-item"
      });
      expect(classifyCombatRelevance(card({ Type: "Skill", Abilities: {}, Auras: {} }))).toEqual({
        relevance: "combat",
        reason: "no-effects-skill"
      });
    });

    it("keeps shop-value scaling items that also fight", () => {
      const fighter = card({
        Abilities: {
          "0": { Trigger: { $type: "TTriggerOnCardFired" }, Action: { $type: "TActionPlayerDamage" } },
          "1": {
            Trigger: { $type: "TTriggerOnCardSold" },
            Action: { $type: "TActionCardModifyAttribute", AttributeType: "SellPrice" }
          }
        }
      });
      expect(classifyCombatRelevance(fighter).relevance).toBe("combat");
    });

    it("treats out-of-combat-only effects as economy even under a combat trigger", () => {
      const stashed = card({
        Abilities: {
          "0": {
            Trigger: { $type: "TTriggerOnCardFired" },
            WorksIn: "OutOfCombatOnly",
            Action: { $type: "TActionPlayerDamage" }
          }
        }
      });
      expect(classifyCombatRelevance(stashed).relevance).toBe("economy");
    });

    it("honours compound OR triggers where every branch is shop-only", () => {
      const levelUp = card({
        Abilities: {
          "0": {
            Trigger: {
              $type: "TTriggerOr",
              Triggers: [{ $type: "TTriggerOnCardPurchased" }, { $type: "TTriggerOnCardUpgraded" }]
            },
            Action: { $type: "TActionCardUpgrade" }
          }
        }
      });
      expect(classifyCombatRelevance(levelUp).relevance).toBe("economy");
    });

    it("keeps combat effects that merely spawn cards at fight start", () => {
      const spawner = card({
        Abilities: {
          "0": {
            Trigger: { $type: "TTriggerOnFightStarted" },
            Action: { $type: "TActionCardEnchantRandom" }
          }
        }
      });
      expect(classifyCombatRelevance(spawner).relevance).toBe("combat");
    });

    it("writes the classification onto the raw card", () => {
      const raw = buildRawCard(
        card({
          Abilities: {
            "0": {
              Trigger: { $type: "TTriggerOnCardSold" },
              Action: { $type: "TActionPlayerModifyAttribute", AttributeType: "Gold" }
            }
          }
        }),
        {
          standardPrices,
          translate: noTranslation,
          artIndex: {},
          existingImageIds: new Set(),
          patch: "2026-10-13",
          scrapedAt: "2026-10-19T00:00:00.000Z"
        }
      );
      expect(raw.CombatRelevance).toBe("economy");
      expect(raw.CombatRelevanceReason).toBe("out-of-combat-trigger");
    });
  });

  describe("sources", () => {
    it("derives sources from encounters and monster hands", () => {
      const cards = [
        card({ Id: "item-1", Localization: { Title: { Text: "Sword" } } }),
        card({ Id: "item-2", Localization: { Title: { Text: "Shield" } } }),
        card({
          Id: "monster-fight",
          Type: "CombatEncounter",
          SpawningEligibility: "Always",
          CombatantType: { MonsterTemplateId: "monster-1" },
          Localization: { Title: { Text: "Monster Fight" } }
        })
      ];
      const monsters = [
        {
          Id: "monster-1",
          Player: {
            Hand: { Items: [{ TemplateId: "item-1" }] },
            Stash: { Items: [] },
            Skills: [{ TemplateId: "item-2" }]
          }
        }
      ];

      const sources = deriveSources(cards, monsters, noTranslation);
      expect(sources).toHaveLength(1);
      expect(sources[0].title).toBe("Monster Fight");
      expect(sources[0].category).toBe("Monsters");
      expect(sources[0].card_ids).toEqual(["item-1", "item-2"]);
      expect(sources[0].card_count).toBe(2);
    });

    it("skips debug and Never-spawning cards", () => {
      const cards = [
        card({ Id: "item-1", SpawningEligibility: "Never" }),
        card({ Id: "item-2", Localization: { Title: { Text: "[DEBUG] Sword" } } }),
        card({
          Id: "monster-fight",
          Type: "CombatEncounter",
          CombatantType: { MonsterTemplateId: "monster-1" },
          Localization: { Title: { Text: "Monster Fight" } }
        })
      ];
      const monsters = [
        {
          Id: "monster-1",
          Player: {
            Hand: { Items: [{ TemplateId: "item-1" }, { TemplateId: "item-2" }] },
            Stash: { Items: [] },
            Skills: []
          }
        }
      ];
      expect(deriveSources(cards, monsters, noTranslation)).toEqual([]);
    });
  });

  describe("merchants", () => {
    it("derives merchant filters from spawn queries", () => {
      const merchant = card({
        Id: "merchant-1",
        Type: "EventEncounter",
        Tags: ["EventEncounter", "Merchant"],
        Localization: { Title: { Text: "Food Vendor", Key: "food-key" } },
        SelectionContext: {
          $type: "TSpawnFilterQuery",
          Constraints: { $type: "ConstraintAnd", Constraints: [{ $type: "ConstraintTag", Tags: ["Food"] }] }
        }
      });

      const merchants = deriveMerchants([merchant], noTranslation);
      expect(merchants).toHaveLength(1);
      expect(merchants[0].name).toBe("Food Vendor");
      expect(merchants[0].filters).toEqual({ tag: ["Food"] });
    });

    it("skips merchants that only sell non-items", () => {
      const merchant = card({
        Type: "EventEncounter",
        Tags: ["Merchant"],
        SelectionContext: {
          $type: "TSpawnFilterQuery",
          Constraints: { $type: "ConstraintCardType", Types: ["Skill"] }
        }
      });
      expect(deriveMerchants([merchant], noTranslation)).toEqual([]);
    });
  });

  describe("indexes", () => {
    it("builds hero and tag indexes", () => {
      const cards = [card({ Id: "a", Heroes: ["Vanessa"], Tags: ["Item", "Small", "Vanessa", "Weapon"], HiddenTags: ["Damage"] })];
      const heroes = buildHeroes(cards) as { heroes: Array<{ hero: string; card_count: number }> };
      expect(heroes.heroes.find((entry) => entry.hero === "Vanessa")?.card_count).toBe(1);

      const tags = buildTags(cards) as { visible_tags: string[]; hidden_tags: string[]; mechanic_tags: string[] };
      expect(tags.visible_tags).toContain("Weapon");
      expect(tags.hidden_tags).toContain("Damage");
      expect(tags.mechanic_tags).toContain("Vanessa");
    });

    it("classifies image coverage", () => {
      const manifest = buildImageManifest(
        [
          card({ Id: "reused" }),
          card({ Id: "extractable" }),
          card({ Id: "missing" })
        ],
        { extractable: { source: "unity-card", asset: "art" } },
        new Set(["reused"])
      );
      const byId = new Map(manifest.map((entry) => [entry.card_id, entry]));
      expect(byId.get("reused")?.status).toBe("reused");
      expect(byId.get("extractable")?.status).toBe("extractable");
      expect(byId.get("missing")?.status).toBe("missing");
    });
  });
});
