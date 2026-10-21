import { describe, expect, it } from "vitest";
import {
  buildEncounterIndex,
  buildKeywordIndex,
  buildLevelUpIndex,
  buildRulesIndex,
  describeConstraints
} from "./wikiImport";

const noTranslation = (key: string | null, english: string) => key ?? english;

type Raw = Record<string, unknown>;

function encounter(overrides: Raw = {}): Raw {
  return {
    Id: "event-1",
    Type: "EventEncounter",
    StartingTier: "Gold",
    SpawningEligibility: "Always",
    Heroes: ["Common"],
    InternalName: "Apothecary",
    Localization: {
      Title: { Text: "Apothecary", Key: "apothecary" },
      Description: { Text: "Offers a variety of boons", Key: "apothecary-desc" }
    },
    SelectionContext: {
      Rules: {
        SelectionIsFree: false,
        CanExit: true,
        CanSelectMultiple: false,
        RerollRules: { TotalAllowedRerolls: 2, StartingCost: 1, CostIncrease: 1 }
      },
      SpawnContext: {
        $type: "TSpawnContextQuery",
        Groups: [
          {
            $type: "TSpawnGroup",
            Filters: [{ $type: "TSpawnFilterIdList", Ids: ["step-1", "step-2"] }],
            Limit: { $type: "TFixedValue", Value: 2 }
          }
        ]
      }
    },
    ...overrides
  };
}

function step(id: string, overrides: Raw = {}): Raw {
  return {
    Id: id,
    Type: "EncounterStep",
    StartingTier: "Bronze",
    SpawningEligibility: "Always",
    Heroes: ["Common"],
    InternalName: id,
    Attributes: { BuyPrice: 5 },
    Localization: {
      Title: { Text: `Step ${id}`, Key: `title-${id}` },
      Description: { Text: "Your items gain {ability.0}", Key: `desc-${id}` }
    },
    Abilities: { "0": { Action: { $type: "TActionPlayerShieldApply", Value: { $type: "TFixedValue", Value: 5 } } } },
    Auras: {},
    ...overrides
  };
}

function item(id: string, overrides: Raw = {}): Raw {
  return {
    Id: id,
    Type: "Item",
    StartingTier: "Bronze",
    SpawningEligibility: "Always",
    Heroes: ["Vanessa"],
    InternalName: id,
    Localization: { Title: { Text: id, Key: id }, Description: { Text: "", Key: null } },
    ...overrides
  };
}

describe("wiki importer", () => {
  describe("encounter index", () => {
    it("groups variants by type and title into one page", () => {
      const entries = buildEncounterIndex(
        [
          encounter({ Id: "bronze", StartingTier: "Bronze" }),
          encounter({ Id: "gold", StartingTier: "Gold" })
        ],
        [],
        noTranslation
      );

      expect(entries).toHaveLength(1);
      expect(entries[0].slug).toBe("apothecary");
      expect(entries[0].tiers).toEqual(["Bronze", "Gold"]);
      expect(entries[0].variants.map((variant) => variant.id)).toEqual(["bronze", "gold"]);
    });

    it("drops disabled and tutorial records", () => {
      const entries = buildEncounterIndex(
        [
          encounter({ Id: "never", SpawningEligibility: "Never" }),
          encounter({ Id: "tutorial", InternalName: "Apothecary Tutorial Day 1", Localization: { Title: { Text: "Apothecary Tutorial Day 1" } } })
        ],
        [],
        noTranslation
      );
      expect(entries).toHaveLength(0);
    });

    it("lists the steps an event offers and renders their tokens", () => {
      const entries = buildEncounterIndex([encounter(), step("step-1"), step("step-2")], [], noTranslation);
      const page = entries.find((entry) => entry.category === "event")!;

      expect(page.options?.map((option) => option.id)).toEqual(["step-1", "step-2"]);
      // `{ability.0}` resolves against the step's own attributes and gains the
      // keyword the template omits.
      expect(page.options?.[0].description).toBe("Your items gain 5 Shield");
      expect(page.options?.[0].price).toBe(5);
    });

    it("reports reroll rules from the selection context", () => {
      const [page] = buildEncounterIndex([encounter()], [], noTranslation);
      expect(page.rules).toEqual({
        free: false,
        canExit: true,
        canSelectMultiple: false,
        rerolls: { total: 2, startingCost: 1, costIncrease: 1 }
      });
    });

    it("tells unlimited rerolls apart from no rerolls", () => {
      const reroll = (total: number | null) => ({
        SelectionContext: {
          Rules: {
            SelectionIsFree: true,
            CanExit: true,
            CanSelectMultiple: false,
            RerollRules: { TotalAllowedRerolls: total, StartingCost: 1, CostIncrease: 1 }
          }
        }
      });
      const [unlimited] = buildEncounterIndex([encounter({ ...reroll(null), Id: "pearl" })], [], noTranslation);
      const [none] = buildEncounterIndex([encounter({ ...reroll(0), Id: "fixed" })], [], noTranslation);

      // `null` is the game's "infinite"; `0` is "you cannot reroll". Collapsing
      // both to 0 would label every tutorial-style encounter as unlimited.
      expect(unlimited.rules?.rerolls?.total).toBeNull();
      expect(none.rules?.rerolls?.total).toBe(0);
    });

    it("files merchant encounters under their own category", () => {
      const entries = buildEncounterIndex(
        [
          encounter({ Id: "shop", Tags: ["Merchant"], Localization: { Title: { Text: "Aila" } } }),
          encounter({ Id: "event", Tags: [], Localization: { Title: { Text: "Apothecary" } } })
        ],
        [],
        noTranslation
      );
      const byName = new Map(entries.map((entry) => [entry.nameEn, entry.category]));
      expect(byName.get("Aila")).toBe("merchant");
      expect(byName.get("Apothecary")).toBe("event");
    });

    it("reads the day windows from the internal name", () => {
      const entries = buildEncounterIndex(
        [
          encounter({ Id: "d1", InternalName: "Candy Stash (Day 1-3)" }),
          encounter({ Id: "d2", InternalName: "Candy Stash (Day 4-6)" })
        ],
        [],
        noTranslation
      );
      expect(entries[0].days).toEqual(["1-3", "4-6"]);
      expect(entries[0].variants.map((variant) => variant.days)).toEqual([["1-3"], ["4-6"]]);
    });

    it("attaches a monster's deck to a combat encounter", () => {
      const monster = {
        Id: "monster-1",
        InternalName: "Flame Juggler",
        Player: {
          Attributes: { Level: 7, HealthMax: 1200, Prestige: 50 },
          Hand: { Items: [{ TemplateId: "item-1" }, { TemplateId: "missing-item" }] },
          Skills: [{ TemplateId: "skill-1" }]
        }
      };
      const [page] = buildEncounterIndex(
        [
          encounter({
            Id: "combat-1",
            Type: "CombatEncounter",
            Localization: { Title: { Text: "Flame Juggler" }, Description: { Text: "" } },
            CombatantType: { MonsterTemplateId: "monster-1" },
            RewardCombatXp: 3,
            RewardCombatGold: 2
          }),
          item("item-1")
        ],
        [monster],
        noTranslation
      );

      expect(page.category).toBe("monster");
      expect(page.monster?.level).toBe(7);
      expect(page.monster?.health).toBe(1200);
      // The fight's payout is on the card, not derived from a global rule.
      expect(page.combatRewards).toEqual({ xp: 3, gold: 2 });
      // Unknown templates are dropped rather than rendered as broken chips.
      expect(page.monster?.itemIds).toEqual(["item-1"]);
      expect(page.monster?.skillIds).toEqual(["skill-1"]);
    });

    it("flags takeover encounters and the XP paid for selecting one", () => {
      const [page] = buildEncounterIndex(
        [encounter({ Id: "bounty", IsTakeover: true, ExperienceAwardUponSelection: 1 })],
        [],
        noTranslation
      );
      expect(page.takeover).toBe(true);
      expect(page.xpOnSelection).toBe(1);
    });

    it("omits the selection XP when the encounter pays nothing for being picked", () => {
      const [page] = buildEncounterIndex(
        [encounter({ Id: "plain", ExperienceAwardUponSelection: 0 })],
        [],
        noTranslation
      );
      expect(page.xpOnSelection).toBeUndefined();
      expect(page.takeover).toBeUndefined();
    });

    it("keeps the highest payout when a fight's variants disagree", () => {
      const [page] = buildEncounterIndex(
        [
          encounter({
            Id: "fight-low",
            Type: "CombatEncounter",
            Localization: { Title: { Text: "Bandit" } },
            RewardCombatXp: 3,
            RewardCombatGold: 2
          }),
          encounter({
            Id: "fight-high",
            Type: "CombatEncounter",
            Localization: { Title: { Text: "Bandit" } },
            RewardCombatXp: 4,
            RewardCombatGold: 0
          })
        ],
        [],
        noTranslation
      );
      expect(page.combatRewards).toEqual({ xp: 4, gold: 2 });
    });

    it("keeps only real cards in a reward list", () => {
      const [page] = buildEncounterIndex(
        [
          encounter({
            Id: "reward-event",
            SelectionContext: {
              SpawnContext: {
                Groups: [
                  {
                    $type: "TSpawnGroup",
                    Filters: [{ $type: "TSpawnFilterIdList", Ids: ["item-1", "debug-1"] }],
                    Limit: { $type: "TFixedValue", Value: 1 }
                  }
                ]
              }
            }
          }),
          item("item-1"),
          item("debug-1", { SpawningEligibility: "Never" })
        ],
        [],
        noTranslation
      );

      expect(page.rewardCardIds).toEqual(["item-1"]);
    });

    it("records a portrait only when art exists for the page", () => {
      const art = new Map([["event-1", "/images/encounters/event-1.webp"]]);
      const [page] = buildEncounterIndex([encounter()], [], noTranslation, art);
      expect(page.portrait).toBe("/images/encounters/event-1.webp");
    });
  });

  describe("spawn constraints", () => {
    it("describes query filters in words", () => {
      const described = describeConstraints(
        {
          $type: "ConstraintAnd",
          Constraints: [
            { $type: "ConstraintCardType", Types: ["Item"] },
            { $type: "ConstraintTier", Tiers: ["Legendary"], IsNot: true }
          ]
        },
        noTranslation
      );
      expect(described?.en).toBe("Item + not Legendary");
      expect(described?.zh).toBe("物品 + 非传说");
    });

    it("names reference tags by their base tag", () => {
      const described = describeConstraints({ $type: "ConstraintTag", Tags: ["PotionReference"] }, (key, english) =>
        key === "Potion" ? "药水" : english
      );
      expect(described?.zh).toBe("药水");
    });
  });

  describe("keyword index", () => {
    it("collapses plural aliases onto the canonical term", () => {
      const keywords = buildKeywordIndex(
        {
          Burn: { Keyword: "Damages twice per second", Tag: "Burn" },
          Burns: { Keyword: "Burns damage decreases by 1", Tag: "Burns" }
        },
        (key, english) => (key === "Burn" || key === "Burns" ? "灼烧" : english)
      );

      expect(keywords).toHaveLength(1);
      expect(keywords[0].name).toBe("灼烧");
      expect(keywords[0].nameEn).toBe("Burn");
      expect(keywords[0].description).toBe("Damages twice per second");
    });

    it("skips tooltips that carry no keyword text", () => {
      const keywords = buildKeywordIndex({ Exit: { Keyword: "", Tag: "Exit" } }, noTranslation);
      expect(keywords).toHaveLength(0);
    });
  });

  describe("level up index", () => {
    it("reads groups, limits and hero conditions", () => {
      const levels = buildLevelUpIndex(
        [
          {
            Level: 2,
            HealthIncrease: 150,
            Rewards: {
              $type: "TSpawnContextQuery",
              Limit: { $type: "TFixedValue", Value: 4 },
              Groups: [
                {
                  Filters: [{ $type: "TSpawnFilterIdList", Ids: ["step-1"] }],
                  Limit: { $type: "TFixedValue", Value: 1 },
                  RandomWeight: 22,
                  Prerequisites: [
                    { $type: "TPrerequisiteRun", Conditions: { $type: "TRunConditionalPlayerHero", Heroes: ["Dooley"], Operator: "None" } }
                  ]
                }
              ]
            }
          },
          step("step-1")
        ],
        [step("step-1")],
        noTranslation
      );

      expect(levels).toHaveLength(1);
      expect(levels[0].level).toBe(2);
      expect(levels[0].health).toBe(150);
      expect(levels[0].pick).toBe(4);
      // Heroes are stored as catalog slugs, not the game's raw hero ids.
      expect(levels[0].groups[0]).toMatchObject({ limit: 1, weight: 22, heroes: ["dooley"], heroOperator: "None" });
      expect(levels[0].groups[0].options[0].id).toBe("step-1");
    });

    it("drops levels whose groups reference no real card", () => {
      const levels = buildLevelUpIndex([{ Level: 3, Rewards: { Groups: [{ Filters: [{ $type: "TSpawnFilterIdList", Ids: ["ghost"] }] }] } }], [], noTranslation);
      expect(levels).toHaveLength(0);
    });
  });

  describe("rules index", () => {
    it("quotes the game mode constants", () => {
      const rules = buildRulesIndex({
        HoursInADay: 6,
        NumberOfDays: 10,
        VictoriesToWin: 10,
        ExperiencePerLevel: 8,
        ExperiencePerHour: 1,
        CritPercentMultiplier: 200,
        BurnDecrementByAsPercentage: 3,
        Prestige: { PrestigeInitial: 20, PrestigeMax: 20, PrestigeLossFromMonsters: 0 },
        Fates: { TemplateId: "fate", SpawnAtOrBelowPrestigeValue: 0, AfterFatesPrestigeValue: 1 },
        Sandstorm: { BaseTickRate: 250, TickRateDecrement: 10, TickRateFloor: 150, BaseDamage: 1, AdditiveScalar: 2, CountdownStartTime: 20000, CountdownDuration: 10000 },
        EncounterSpawnTierPercentages: { Bronze: 0.4, Silver: 0.3 },
        RewardSpawnTierPercentages: { Bronze: 0, Silver: 0 },
        ItemSkillSpawnTierPercantagesByDay: {
          "1": { Bronze: 1, Silver: 0 },
          "2": { Bronze: 0.9, Silver: 0.1 }
        },
        StandardPrices: {
          ItemBuyPrices: { Small: { Bronze: 2 }, Medium: { Bronze: 4 } },
          ItemSellPrices: { Small: { Bronze: 1 } },
          SkillBuyPrices: { Medium: { Bronze: 5 } },
          SkillSellPrices: { Medium: { Bronze: 2 } }
        }
      });

      expect(rules.hoursInDay).toBe(6);
      expect(rules.prestige.initial).toBe(20);
      expect(rules.sandstorm?.countdownStartTime).toBe(20000);
      expect(rules.encounterTierWeights).toEqual({ Bronze: 0.4, Silver: 0.3 });
      expect(rules.tiersByDay["2"]).toEqual({ Bronze: 0.9, Silver: 0.1 });
      expect(rules.itemBuyPrices.Small.Bronze).toBe(2);
      expect(rules.skillBuyPrices.Medium.Bronze).toBe(5);
    });

    it("tolerates a mode without a sandstorm table", () => {
      const rules = buildRulesIndex({ HoursInADay: 6 });
      expect(rules.sandstorm).toBeNull();
      expect(rules.tiersByDay).toEqual({});
      expect(rules.itemBuyPrices).toEqual({});
    });

    it("reads the Fate options from the template the mode points at", () => {
      const futura = {
        Id: "futura",
        Type: "EventEncounter",
        Localization: { Title: { Text: "Futura" } },
        SelectionContext: {
          SpawnContext: {
            Groups: [
              { Filters: [{ $type: "TSpawnFilterIdList", Ids: ["legacy"] }] },
              { Filters: [{ $type: "TSpawnFilterIdList", Ids: ["bounty"] }] }
            ]
          }
        }
      };
      const legacy = {
        Id: "legacy",
        Type: "EncounterStep",
        Localization: {
          Title: { Text: "Fate's Legacy", Key: "legacy" },
          Description: { Text: "Upgrade your items", Key: "legacy-desc" }
        }
      };
      const bounty = {
        Id: "bounty",
        Type: "EncounterStep",
        Localization: {
          Title: { Text: "Fate's Bounty", Key: "bounty" },
          Description: { Text: "Gain {ability.1} Gold", Key: "bounty-desc" }
        }
      };
      const rules = buildRulesIndex(
        { Fates: { TemplateId: "futura", SpawnAtOrBelowPrestigeValue: 0, AfterFatesPrestigeValue: 1 } },
        [futura, legacy, bounty] as never,
        (key, english) => (key === "legacy" ? "命运的遗产" : key === "bounty" ? "命运的恩赐" : english)
      );

      expect(rules.fateOptions.map((option) => option.nameZh)).toEqual(["命运的遗产", "命运的恩赐"]);
      expect(rules.fateOptions[0].description).toBe("Upgrade your items");
    });

    it("summarises the reroll rules the encounters actually ship", () => {
      const reroll = (id: string, tier: string, total: number | null, cost: number) => ({
        Id: id,
        Type: "EventEncounter",
        StartingTier: tier,
        SpawningEligibility: "Always",
        InternalName: id,
        Localization: { Title: { Text: id } },
        SelectionContext: {
          Rules: {
            SelectionIsFree: false,
            CanExit: true,
            RerollRules: { TotalAllowedRerolls: total, StartingCost: cost, CostIncrease: 0 }
          }
        }
      });
      const rules = buildRulesIndex(
        { HoursInADay: 6 },
        [
          reroll("bronze-a", "Bronze", 1, 2),
          reroll("bronze-b", "Bronze", 1, 2),
          reroll("silver", "Silver", 1, 3),
          reroll("pearl", "Gold", null, 1)
        ] as never
      );

      expect(rules.encounterRerolls).toEqual([
        { tier: "Bronze", total: 1, startingCost: 2, costIncrease: 0, count: 2 },
        { tier: "Silver", total: 1, startingCost: 3, costIncrease: 0, count: 1 },
        { tier: "Gold", total: null, startingCost: 1, costIncrease: 0, count: 1 }
      ]);
    });
  });
});
