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
import { parseEffectText } from "./parseEffects";
import { createImageResolver, resolveCardImage } from "./resolveImages";
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
  visible_tags: ["Weapon", "Tool", "Drone"],
  hidden_tags: ["Shield", "Damage", "Haste", "PoisonReference"],
  mechanic_tags: ["Common", "Item", "Skill"],
  all_tags: ["Weapon", "Tool", "Drone", "Shield", "Damage", "Haste", "PoisonReference", "Common", "Item", "Skill"]
});

function item(partial: Partial<ItemDef> & Pick<ItemDef, "id" | "name">): ItemDef {
  return {
    slug: slugify(partial.name),
    hero: null,
    size: 1,
    tags: [],
    cooldownMs: 4000,
    rarity: "Silver",
    imageUrl: null,
    text: "",
    effects: [],
    raw: { Heroes: ["Common"] },
    ...partial
  };
}

function skill(partial: Partial<SkillDef> & Pick<SkillDef, "id" | "name">): SkillDef {
  return {
    slug: slugify(partial.name),
    hero: null,
    tags: [],
    rarity: "Silver",
    imageUrl: null,
    text: "",
    effects: [],
    raw: { Heroes: ["Common"] },
    ...partial
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
    expect(items[0].effects[0].action.type).toBe("shield");
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
    expect(skills[0].effects[0].trigger).toMatchObject({ event: "tag_item_used", tag: "tool" });
  });

  it("falls back to null when image lookup is missing", () => {
    const resolver = createImageResolver({ imageManifest: { images: [] }, manifests: {} });
    expect(resolveCardImage({ Id: "missing", Title: { Text: "Missing" } }, resolver)).toBeNull();
  });

  it("parses tooltip text conservatively", () => {
    const effect = parseEffectText("When you use a Weapon item, Haste an adjacent item for 1 second", tags);
    expect(effect.trigger).toMatchObject({ event: "tag_item_used", tag: "weapon" });
    expect(effect.action.type).toBe("haste");
    expect(effect.target?.scope).toBe("adjacent");
  });

  it("parses positional target filters", () => {
    expect(parseEffectText("Charge adjacent Small items 1 second", tags).target).toMatchObject({
      scope: "adjacent",
      size: 1
    });
    expect(parseEffectText("If the item to the right is a Tool, Haste it", tags).target).toMatchObject({
      scope: "right",
      tag: "tool"
    });
    expect(parseEffectText("Haste your leftmost item for 1 second", tags).target?.scope).toBe("leftmost");
    expect(parseEffectText("Charge your rightmost item for 1 second", tags).target?.scope).toBe("rightmost");
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
      effects: [parseEffectText("Haste adjacent Weapons for 1 second", tags)]
    });
    const weapon = item({
      id: "weapon",
      name: "Weapon",
      tags: ["weapon"],
      cooldownMs: 8000,
      effects: [parseEffectText("Deal 50 Damage", tags)]
    });
    const placements = placeItem(placeItem([], buffer, 0), weapon, 1);

    const scored = scoreLayout({ items: [buffer, weapon], skills: [], placements, slotLimit: 10 });
    expect(scored.score).toBeGreaterThan(0);
    expect(scored.reasons.some((reason) => reason.includes("Buffer"))).toBe(true);
  });

  it("scores left-only effects only with a left neighbor", () => {
    const target = item({ id: "target", name: "Target", cooldownMs: 8000, effects: [parseEffectText("Deal 50 Damage", tags)] });
    const buffer = item({
      id: "buffer",
      name: "Buffer",
      effects: [parseEffectText("Haste the item to the left for 1 second", tags)]
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
      effects: [parseEffectText("Charge the item to the right for 1 second", tags)]
    });
    const target = item({ id: "target", name: "Target", cooldownMs: 8000, effects: [parseEffectText("Deal 50 Damage", tags)] });
    const good = scoreLayout({ items: [buffer, target], skills: [], placements: placeItem(placeItem([], buffer, 0), target, 1), slotLimit: 10 });
    const bad = scoreLayout({ items: [buffer, target], skills: [], placements: placeItem(placeItem([], target, 0), buffer, 1), slotLimit: 10 });

    expect(good.score).toBeGreaterThan(bad.score);
    expect(bad.warnings.some((warning) => warning.includes("右侧"))).toBe(true);
  });

  it("optimizes adjacent payoff next to an adjacent buffer", () => {
    const buffer = item({
      id: "buffer",
      name: "Buffer",
      effects: [parseEffectText("Haste adjacent Weapons for 1 second", tags)]
    });
    const weapon = item({
      id: "weapon",
      name: "Weapon",
      tags: ["weapon"],
      cooldownMs: 9000,
      effects: [parseEffectText("Deal 50 Damage", tags)]
    });
    const filler = item({ id: "filler", name: "Filler", effects: [parseEffectText("Gain 10 Shield", tags)] });
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
      effects: [parseEffectText("Gain 50 Shield", tags)]
    });
    const reactor = skill({
      id: "reactor",
      name: "Shield Reactor",
      effects: [parseEffectText("When you gain Shield, deal 50 Damage", tags)]
    });

    const score = scoreEntityPair(producer, reactor);
    expect(score.score).toBeGreaterThan(0);
    expect(score.reasons.length).toBeGreaterThan(0);
  });

  it("scores effects into mechanic buckets", () => {
    expect(scoreEffectMechanics(parseEffectText("Burn 5", tags))).toMatchObject({ burn: 18, damage: 8 });
    expect(scoreEffectMechanics(parseEffectText("Freeze an enemy item", tags))).toMatchObject({ freeze: 16, control: 14 });
    expect(scoreEffectMechanics(parseEffectText("Charge an item 1 second", tags))).toMatchObject({ charge: 18, tempo: 16 });
  });

  it("scores item and skill mechanics", () => {
    const weapon = item({
      id: "weapon-mechanic",
      name: "Weapon Mechanic",
      tags: ["weapon"],
      effects: [parseEffectText("Deal 50 Damage", tags)]
    });
    const freezingSkill = skill({
      id: "freeze-skill",
      name: "Freeze Skill",
      effects: [parseEffectText("Freeze an enemy item", tags)]
    });

    expect(scoreItemMechanics(weapon).weapon_damage).toBeGreaterThan(20);
    expect(scoreSkillMechanics(freezingSkill)).toMatchObject({ freeze: 16, control: 14 });
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
      effects: [parseEffectText("Haste an item for 1 second", tags)]
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
      effects: [parseEffectText("Haste adjacent Weapons for 1 second", tags)]
    });
    const weapon = item({
      id: "tempo-weapon",
      name: "Tempo Weapon",
      tags: ["weapon"],
      cooldownMs: 8000,
      effects: [parseEffectText("Deal 50 Damage", tags)]
    });
    const filler = item({
      id: "tempo-filler",
      name: "Tempo Filler",
      effects: [parseEffectText("Gain 10 Shield", tags)]
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

  it("infers primary and secondary mechanics from a build profile", () => {
    const weapon = item({
      id: "crit-weapon",
      name: "Crit Weapon",
      tags: ["weapon"],
      effects: [parseEffectText("Deal 50 Damage", tags)]
    });
    const critSkill = skill({
      id: "crit-skill",
      name: "Crit Skill",
      effects: [
        {
          trigger: { event: "combat_start" },
          action: { type: "gain_stat", stat: "critChance", value: 20 },
          target: { scope: "allied_items" },
          rawText: "Your items gain 20 Crit Chance"
        },
        {
          trigger: { event: "deal_damage" },
          action: { type: "gain_stat", stat: "critChance", value: 5 },
          target: { scope: "self" },
          rawText: "When you deal Damage, gain 5 Crit Chance"
        }
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
      effects: [
        parseEffectText("Burn 5", tags),
        parseEffectText("When you Burn, Burn 5", tags),
        parseEffectText("Deal 50 Damage", tags)
      ]
    });

    const result = buildMechanicProfile({ items: [burner], skills: [] });

    expect(result.scores.damage).toBeGreaterThanOrEqual(result.scores.burn);
    expect(result.primary).toBe("burn");
  });

  it("generates deduplicated builds within the slot limit", () => {
    const hero: HeroDef = { id: "common", name: "Common", slug: "common", imageUrl: null };
    const items = [
      item({ id: "a", name: "A", size: 3, effects: [parseEffectText("Deal 10 Damage", tags)] }),
      item({ id: "b", name: "B", size: 3, effects: [parseEffectText("Gain 10 Shield", tags)] }),
      item({ id: "c", name: "C", size: 2, effects: [parseEffectText("Burn 5", tags)] }),
      item({ id: "d", name: "D", size: 1, effects: [parseEffectText("Poison 5", tags)] }),
      item({ id: "e", name: "E", size: 1, effects: [parseEffectText("Haste an item for 1 second", tags)] }),
      item({ id: "e", name: "E Duplicate", size: 1, effects: [parseEffectText("Haste an item for 1 second", tags)] })
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
          effects: [
            {
              trigger: { event: "combat_start" },
              action: { type: "gain_stat", stat: "critChance", value: 10 },
              target: { scope: "self" },
              rawText: "Gain 10 Crit Chance"
            }
          ]
        }),
        item({
          id: "b",
          name: "B",
          effects: [parseEffectText("Haste an item for 1 second", tags)]
        }),
        item({
          id: "c",
          name: "C",
          effects: [parseEffectText("Poison 5", tags)]
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
          effects: [parseEffectText("Burn 5", tags)]
        }),
        item({
          id: "knife",
          name: "Spring Knife",
          tags: ["weapon", "damage"],
          effects: [parseEffectText("Deal 4 Damage", tags)]
        })
      ]
    );

    expect(recs.map((rec) => rec.itemId)).toEqual(["burn-payoff"]);
  });
});
