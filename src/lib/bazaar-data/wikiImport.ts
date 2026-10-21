import { asArray, asRecord, numberValue, stringValue } from "./cardRecord";
import {
  baseTierKey,
  effectiveTierAttributes,
  insertKeyword,
  keywordForNode,
  resolveToken,
  stripBracketAnnotations
} from "./gamedataImport";
import { slugify, uniqueSlug } from "./slug";
import type {
  CardTier,
  WikiCombatRewards,
  WikiEncounterEntry,
  WikiEncounterOption,
  WikiEncounterReward,
  WikiKeywordEntry,
  WikiLevelUpEntry,
  WikiRulesEntry
} from "./types";
import type { GameCard, MonsterRecord, TranslationLookup } from "./gamedataImport";

/**
 * Wiki content that the card catalog does not need but the game ships anyway:
 * encounter pages, the keyword glossary, the level-up reward table, and the
 * rule constants in `game_modes`.
 *
 * Everything here reads the same runtime cache the catalog import reads, so the
 * wiki and the catalog can never disagree about what an encounter grants — the
 * reward lists are card ids that the catalog already knows how to render.
 */

const ENCOUNTER_TYPES = ["EventEncounter", "EncounterStep", "PedestalEncounter", "CombatEncounter"] as const;
export type EncounterType = (typeof ENCOUNTER_TYPES)[number];

const ENCOUNTER_CATEGORY: Record<EncounterType, WikiEncounterEntry["category"]> = {
  EventEncounter: "event",
  EncounterStep: "event-step",
  PedestalEncounter: "pedestal",
  CombatEncounter: "monster"
};

const ENCOUNTER_CATEGORY_LABEL: Record<WikiEncounterEntry["category"], string> = {
  event: "事件",
  "event-step": "事件选项",
  pedestal: "底座",
  monster: "怪物",
  merchant: "商人"
};

export { ENCOUNTER_CATEGORY_LABEL };

const DEBUG_NAME = /tutorial|debug|unused/i;

function isReal(card: GameCard): boolean {
  if (stringValue(card.SpawningEligibility) === "Never") return false;
  const internal = stringValue(card.InternalName) ?? "";
  const title = stringValue(asRecord(asRecord(card.Localization).Title).Text) ?? "";
  return !DEBUG_NAME.test(internal) && !DEBUG_NAME.test(title);
}

function localizedPair(node: unknown, translate: TranslationLookup): { en: string; zh: string } {
  const entry = asRecord(node);
  const english = stringValue(entry.Text) ?? "";
  if (!english) return { en: "", zh: "" };
  const zh = translate(stringValue(entry.Key), english);
  return { en: english, zh: zh && zh !== english ? zh : "" };
}

const TOKEN_PATTERN = /\{(?:ability|aura)\.[A-Za-z0-9]+(?:\.[a-z]+)?\}|\{custom_\d+\}|\{TempoCost\}|\{[^{}]+ \?\? [^{}]+\}/g;

/**
 * Encounter descriptions are templates ("Your items permanently gain
 * {ability.0}") exactly like card tooltips, so they need the same substitution
 * pass. Encounter cards carry a flat `Attributes` block rather than per-tier
 * records, so the base tier's attributes are merged in as the context.
 */
function renderText(card: GameCard, text: string, locale: "en-US" | "zh-CN"): string {
  if (!text) return "";
  const tierAttributes = baseTierKey(card);
  const attributes: Record<string, number> = tierAttributes ? effectiveTierAttributes(card, tierAttributes) : {};
  for (const [key, value] of Object.entries(asRecord(card.Attributes))) {
    const numeric = numberValue(value);
    if (numeric != null) attributes[key] = numeric;
  }

  const context = { Abilities: card.Abilities, Auras: card.Auras };
  let result = stripBracketAnnotations(text) || text;

  for (const token of new Set(result.match(TOKEN_PATTERN) ?? [])) {
    const keyword = (() => {
      const nodeInfo = /^\{(ability|aura)\.([A-Za-z0-9]+)(?:\.([a-z]+))?\}$/.exec(token);
      if (!nodeInfo || nodeInfo[3]) return null;
      const nodes = asRecord(nodeInfo[1] === "ability" ? card.Abilities : card.Auras);
      return keywordForNode(nodes[nodeInfo[2]]);
    })();
    result = insertKeyword(result, token, keyword, locale);

    const value = resolveToken(token, context, attributes);
    if (value == null) continue;
    const rendered = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
    result = result.split(token).join(rendered);
  }

  // Tokens with no resolvable value would otherwise leak into the page.
  return result.replace(TOKEN_PATTERN, "").replace(/\s{2,}/g, " ").trim();
}

function tierValue(card: GameCard): CardTier | null {
  const tier = stringValue(card.StartingTier);
  return tier === "Bronze" || tier === "Silver" || tier === "Gold" || tier === "Diamond" || tier === "Legendary"
    ? tier
    : null;
}

/**
 * Hero names arrive as the game's raw ids ("Vanessa", "Hero8"); the catalog
 * keys heroes by slug ("vanessa", "hero8"), so store the slug to keep the wiki
 * filter and the hero index talking about the same thing.
 */
function heroList(card: GameCard): string[] {
  const heroes = asArray(card.Heroes)
    .map(stringValue)
    .filter((hero): hero is string => Boolean(hero))
    .map((hero) => slugify(hero, "common"));
  return heroes.length > 0 ? heroes : ["common"];
}

/** Every `TSpawnFilterIdList` id anywhere under the node. */
function spawnIds(node: unknown): string[] {
  const ids: string[] = [];
  const walk = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    const current = value as Record<string, unknown>;
    if (current.$type === "TSpawnFilterIdList") {
      for (const id of asArray(current.Ids).map(stringValue)) if (id) ids.push(id);
    }
    for (const key of Object.keys(current)) walk(current[key]);
  };
  walk(node);
  return ids;
}

/**
 * Describe a spawn constraint tree in words. Encounter rewards are mostly
 * queries ("a Silver-tier Tool") rather than fixed card lists, so without this
 * the wiki page would show nothing for 80% of encounters.
 */
export function describeConstraints(node: unknown, translate: TranslationLookup): { en: string; zh: string } | null {
  const current = asRecord(node);
  const type = stringValue(current.$type);
  if (!type) return null;

  if (type === "ConstraintAnd" || type === "ConstraintOr") {
    const parts = asArray(current.Constraints)
      .map((child) => describeConstraints(child, translate))
      .filter((part): part is { en: string; zh: string } => Boolean(part));
    if (parts.length === 0) return null;
    const joiner = type === "ConstraintOr" ? " or " : " + ";
    const zhJoiner = type === "ConstraintOr" ? " 或 " : " + ";
    return {
      en: parts.map((part) => part.en).join(joiner),
      zh: parts.map((part) => part.zh).join(zhJoiner)
    };
  }

  const isNot = current.IsNot === true;
  const negate = (text: string, textZh: string) => ({
    en: isNot ? `not ${text}` : text,
    zh: isNot ? `非${textZh}` : textZh
  });

  if (type === "ConstraintCardType") {
    const types = asArray(current.Types)
      .map(stringValue)
      .filter((value): value is string => Boolean(value));
    const zhTypes = types.map((value) => (value === "Item" ? "物品" : value === "Skill" ? "技能" : value));
    return negate(types.join("/"), zhTypes.join("/"));
  }
  if (type === "ConstraintTag" || type === "ConstraintHiddenTag") {
    const key = type === "ConstraintTag" ? "Tags" : "HiddenTags";
    const tags = asArray(current[key])
      .map(stringValue)
      .filter((value): value is string => Boolean(value));
    // `PotionReference` and friends are internal "mentions a Potion" tags; the
    // player-facing name is the base tag, so strip the suffix before looking
    // the name up in the game's translation table.
    const nameOf = (tag: string): string => {
      const base = tag.replace(/Reference$/, "");
      return translate(base, base) ?? base;
    };
    return negate(tags.join("/"), tags.map(nameOf).join("/"));
  }
  if (type === "ConstraintTier") {
    const tiers = asArray(current.Tiers)
      .map(stringValue)
      .filter((value): value is string => Boolean(value));
    const zh: Record<string, string> = {
      Bronze: "青铜",
      Silver: "白银",
      Gold: "黄金",
      Diamond: "钻石",
      Legendary: "传说"
    };
    return negate(tiers.join("/"), tiers.map((tier) => zh[tier] ?? tier).join("/"));
  }
  if (type === "ConstraintSize") {
    const sizes = asArray(current.Sizes)
      .map(stringValue)
      .filter((value): value is string => Boolean(value));
    const zh: Record<string, string> = { Small: "小型", Medium: "中型", Large: "大型" };
    return negate(sizes.join("/"), sizes.map((size) => zh[size] ?? size).join("/"));
  }
  if (type === "ConstraintHero") {
    const heroes = asArray(current.Heroes)
      .map(stringValue)
      .filter((value): value is string => Boolean(value));
    return negate(heroes.join("/"), heroes.join("/"));
  }
  if (type === "ConstraintEnchantmentEligible") {
    return isNot ? null : { en: "enchanted", zh: "附魔" };
  }
  void translate;
  return null;
}

function rewardFromGroup(group: unknown, cardsById: Map<string, GameCard>, translate: TranslationLookup): WikiEncounterReward | null {
  const node = asRecord(group);
  const filters = asArray(node.Filters);
  const limit = numberValue(asRecord(node.Limit).Value);
  const cardIds: string[] = [];
  const descriptions: Array<{ en: string; zh: string }> = [];

  for (const filter of filters) {
    const entry = asRecord(filter);
    const filterType = stringValue(entry.$type);
    if (filterType === "TSpawnFilterIdList") {
      for (const id of asArray(entry.Ids).map(stringValue)) {
        const card = id ? cardsById.get(id) : undefined;
        if (card && (card.Type === "Item" || card.Type === "Skill")) cardIds.push(id as string);
      }
      continue;
    }
    const described = describeConstraints(entry.Constraints ?? entry, translate);
    if (described) descriptions.push(described);
  }

  if (cardIds.length === 0 && descriptions.length === 0) return null;

  const reward: WikiEncounterReward = {};
  if (cardIds.length > 0) reward.cardIds = [...new Set(cardIds)];
  if (descriptions.length > 0) {
    reward.description = descriptions.map((part) => part.en).join(" or ");
    reward.descriptionZh = descriptions.map((part) => part.zh).join(" 或 ");
  }
  if (limit != null && limit > 0) reward.limit = limit;
  return reward;
}

function rulesFrom(card: GameCard): WikiEncounterEntry["rules"] | undefined {
  const rules = asRecord(asRecord(card.SelectionContext).Rules);
  if (Object.keys(rules).length === 0) return undefined;
  const reroll = asRecord(rules.RerollRules);
  const result: NonNullable<WikiEncounterEntry["rules"]> = {
    free: rules.SelectionIsFree !== false,
    canExit: rules.CanExit === true,
    canSelectMultiple: rules.CanSelectMultiple === true
  };
  const startingCost = numberValue(reroll.StartingCost);
  if (Object.keys(reroll).length > 0 && startingCost != null) {
    // `TotalAllowedRerolls: null` is "unlimited" (Pearl's Dig Site, Aerodrome's
    // advertised infinite refresh); `0` is "you cannot reroll". Keeping the two
    // apart matters: only one encounter in the game is genuinely unlimited.
    const total = reroll.TotalAllowedRerolls == null
      ? null
      : numberValue(reroll.TotalAllowedRerolls) ?? 0;
    result.rerolls = {
      total,
      startingCost,
      costIncrease: numberValue(reroll.CostIncrease) ?? 0
    };
  }
  return result;
}

/** Distinct finite numbers, in the order they first appear. */
function distinctNumbers(values: Array<number | null>): number[] {
  const seen = new Set<number>();
  for (const value of values) {
    if (value == null || seen.has(value)) continue;
    seen.add(value);
  }
  return [...seen];
}

/**
 * Gold and XP a fight pays. Read from every variant because the same monster
 * page can pay different amounts at different tiers, and returned only when at
 * least one variant pays something.
 */
function combatRewardsFrom(variants: GameCard[]): WikiCombatRewards | undefined {
  const xp = distinctNumbers(variants.map((variant) => numberValue(variant.RewardCombatXp)));
  const gold = distinctNumbers(variants.map((variant) => numberValue(variant.RewardCombatGold)));
  if (xp.length === 0 && gold.length === 0) return undefined;
  const paid = (values: number[]): number | null => (values.some((value) => value > 0) ? Math.max(...values) : 0);
  return {
    xp: xp.length > 0 ? paid(xp) : null,
    gold: gold.length > 0 ? paid(gold) : null
  };
}

/**
 * Day windows the record's internal name carries: "(Day 4-6)", "(Day 3 to 4)",
 * "(Day 6 and Day 7)", "(Day 5+)". The runtime cache has no day/hour schedule
 * table, so these name tags are the only day information the game ships.
 */
const DAY_TAG = /\(Day\s+([^)]+)\)/gi;

function dayWindows(card: GameCard): string[] {
  const internal = stringValue(card.InternalName) ?? "";
  const windows: string[] = [];
  for (const match of internal.matchAll(DAY_TAG)) {
    const text = match[1].trim();
    if (text) windows.push(text);
  }
  return windows;
}

function optionFrom(card: GameCard, translate: TranslationLookup): WikiEncounterOption {
  const title = localizedPair(asRecord(card.Localization).Title, translate);
  const description = localizedPair(asRecord(card.Localization).Description, translate);
  const option: WikiEncounterOption = {
    id: stringValue(card.Id) ?? "",
    name: title.en || stringValue(card.InternalName) || "",
    nameZh: title.zh,
    description: renderText(card, description.en, "en-US"),
    descriptionZh: renderText(card, description.zh, "zh-CN")
  };
  const price = numberValue(asRecord(card.Attributes).BuyPrice);
  if (price != null && price > 0) option.price = price;
  return option;
}

export type EncounterArtIndex = Map<string, string>;

export function buildEncounterIndex(
  cards: GameCard[],
  monsters: MonsterRecord[],
  translate: TranslationLookup,
  artByCardId: EncounterArtIndex = new Map()
): WikiEncounterEntry[] {
  const cardsById = new Map(cards.map((card) => [stringValue(card.Id) ?? "", card]));
  const monstersById = new Map(monsters.map((monster) => [stringValue(monster.Id) ?? "", monster]));
  const realCardIds = new Set(
    cards
      .filter((card) => (card.Type === "Item" || card.Type === "Skill") && isReal(card))
      .map((card) => stringValue(card.Id) ?? "")
  );

  // Cards that point at a monster template, so a CombatEncounter page can show
  // the deck the player actually fights instead of an empty description.
  const encounterByMonster = new Map<string, GameCard>();
  for (const card of cards) {
    const monsterId = stringValue(asRecord(card.CombatantType).MonsterTemplateId);
    if (!monsterId) continue;
    if (!encounterByMonster.has(monsterId)) encounterByMonster.set(monsterId, card);
  }

  const groups = new Map<string, GameCard[]>();
  for (const card of cards) {
    const type = stringValue(card.Type);
    if (!type || !(ENCOUNTER_TYPES as readonly string[]).includes(type)) continue;
    if (!isReal(card)) continue;
    const title = stringValue(asRecord(asRecord(card.Localization).Title).Text) ?? stringValue(card.InternalName) ?? "";
    if (!title) continue;
    const key = `${type}|${title}`;
    const list = groups.get(key) ?? [];
    list.push(card);
    groups.set(key, list);
  }

  const usedSlugs = new Set<string>();
  const entries: WikiEncounterEntry[] = [];

  for (const [key, variants] of groups) {
    const [typeText, title] = key.split("|");
    const type = typeText as EncounterType;
    const primary = variants[0];
    const titlePair = localizedPair(asRecord(asRecord(primary.Localization).Title), translate);
    const descriptionPair = localizedPair(asRecord(asRecord(primary.Localization).Description), translate);

    const heroes = [...new Set(variants.flatMap(heroList))].sort();
    const tiers = [...new Set(variants.map(tierValue).filter((tier): tier is CardTier => Boolean(tier)))];
    // Merchant encounters are EventEncounters tagged `Merchant`. They are the
    // 52 shops the catalog already lists, so giving them their own category
    // keeps "event" meaning "non-shop encounter" on the wiki.
    const isMerchant = variants.some((variant) => asArray(variant.Tags).map(stringValue).includes("Merchant"));
    const days = [...new Set(variants.flatMap(dayWindows))];

    const entry: WikiEncounterEntry = {
      id: stringValue(primary.Id) ?? key,
      slug: uniqueSlug(title, usedSlugs, "encounter"),
      category: type === "EventEncounter" && isMerchant ? "merchant" : ENCOUNTER_CATEGORY[type],
      name: titlePair.zh || title,
      nameEn: titlePair.en || title,
      description: renderText(primary, descriptionPair.en, "en-US"),
      descriptionZh: renderText(primary, descriptionPair.zh, "zh-CN"),
      heroes,
      tiers,
      variants: variants.map((variant) => {
        const variantDays = dayWindows(variant);
        return {
          id: stringValue(variant.Id) ?? "",
          tier: tierValue(variant),
          heroes: heroList(variant),
          ...(variantDays.length > 0 ? { days: variantDays } : {})
        };
      })
    };
    if (days.length > 0) entry.days = days;

    const rules = rulesFrom(primary);
    if (rules) entry.rules = rules;

    // Combat payouts and takeover flags live on the card itself, not in the
    // game mode constants. Variants of one page can disagree (a fight that pays
    // 3 XP at one tier and 4 at another), so the page records every distinct
    // value rather than pretending there is a single number.
    if (type === "CombatEncounter") {
      const combatRewards = combatRewardsFrom(variants);
      if (combatRewards) entry.combatRewards = combatRewards;
    }
    const xpOnSelection = distinctNumbers(variants.map((variant) => numberValue(variant.ExperienceAwardUponSelection)))
      .filter((value) => value > 0);
    if (xpOnSelection.length > 0) entry.xpOnSelection = Math.max(...xpOnSelection);
    if (variants.some((variant) => variant.IsTakeover === true)) entry.takeover = true;

    const portrait = artByCardId.get(entry.id) ?? variants.map((v) => artByCardId.get(stringValue(v.Id) ?? "")).find(Boolean);
    if (portrait) entry.portrait = portrait;

    // Options: encounter steps the event offers.
    const optionIds = new Set<string>();
    for (const variant of variants) {
      for (const id of spawnIds(asRecord(variant.SelectionContext).SpawnContext)) optionIds.add(id);
    }
    const options = [...optionIds]
      .map((id) => cardsById.get(id))
      .filter((card): card is GameCard => Boolean(card) && card!.Type === "EncounterStep" && isReal(card!))
      .map((card) => optionFrom(card, translate));
    if (options.length > 0) entry.options = options;

    // Rewards: the cards this encounter can actually put in the player's hands.
    const rewardIds = new Set<string>();
    const rewards: WikiEncounterReward[] = [];
    for (const variant of variants) {
      for (const group of asArray(asRecord(asRecord(variant.SelectionContext).SpawnContext).Groups)) {
        const reward = rewardFromGroup(group, cardsById, translate);
        if (!reward) continue;
        for (const id of reward.cardIds ?? []) if (realCardIds.has(id)) rewardIds.add(id);
        if (reward.description || (reward.cardIds && reward.cardIds.length > 0)) rewards.push(reward);
      }
    }
    if (rewardIds.size > 0) entry.rewardCardIds = [...rewardIds].sort();
    if (rewards.length > 0) entry.rewards = rewards;

    if (type === "CombatEncounter") {
      const monsterId = stringValue(asRecord(primary.CombatantType).MonsterTemplateId);
      const monster = monsterId ? monstersById.get(monsterId) : undefined;
      if (monster) {
        const player = asRecord(monster.Player);
        const monsterTitle = stringValue(monster.InternalName) ?? title;
        const items = asArray(asRecord(player.Hand).Items)
          .map((item) => stringValue(asRecord(item).TemplateId))
          .filter((id): id is string => Boolean(id))
          .filter((id) => realCardIds.has(id));
        const skills = asArray(player.Skills)
          .map((skill) => stringValue(asRecord(skill).TemplateId))
          .filter((id): id is string => Boolean(id));
        entry.monster = {
          id: monsterId ?? "",
          name: monsterTitle,
          nameZh: translate(null, monsterTitle) ?? monsterTitle,
          level: numberValue(asRecord(player.Attributes).Level),
          health: numberValue(asRecord(player.Attributes).HealthMax),
          prestige: numberValue(asRecord(player.Attributes).Prestige),
          itemIds: [...new Set(items)],
          skillIds: [...new Set(skills)]
        };
        const monsterEncounter = monsterId ? encounterByMonster.get(monsterId) : undefined;
        void monsterEncounter;
      }
    }

    entries.push(entry);
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
}

/** Keyword glossary: the tooltip terms the game shows on hover. */
export function buildKeywordIndex(tooltips: Record<string, unknown>, translate: TranslationLookup): WikiKeywordEntry[] {
  const entries: WikiKeywordEntry[] = [];

  for (const [key, raw] of Object.entries(tooltips)) {
    const tip = asRecord(raw);
    const english = stringValue(tip.Keyword);
    if (!english) continue;
    const tag = stringValue(tip.Tag) ?? key;
    const nameZh = translate(tag, key) ?? "";
    const definitionZh = translate(english, english) ?? "";
    // The data ships plural aliases ("Hastes", "Burns") and two Shield/Burn
    // texts that say the same thing with different wording. Collapse by the
    // Chinese name so the glossary lists one entry per concept, and keep the
    // canonical (singular, shortest) key as the displayed English name.
    const dedupeKey = (nameZh && nameZh !== key ? nameZh : key).toLowerCase();
    const existing = entries.find((entry) => entry.name.toLowerCase() === dedupeKey);
    if (existing) {
      if (key.length < existing.nameEn.length) {
        existing.nameEn = key;
        existing.id = slugify(key, "keyword");
        existing.description = english;
        existing.descriptionZh = definitionZh && definitionZh !== english ? definitionZh : "";
      }
      continue;
    }
    entries.push({
      id: slugify(key, "keyword"),
      key,
      name: nameZh && nameZh !== key ? nameZh : key,
      nameEn: key,
      description: english,
      descriptionZh: definitionZh && definitionZh !== english ? definitionZh : ""
    });
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
}

/** Level-up reward table: what each level offers, in the game's own order. */
export function buildLevelUpIndex(
  levelUps: Array<Record<string, unknown>>,
  cards: GameCard[],
  translate: TranslationLookup
): WikiLevelUpEntry[] {
  const cardsById = new Map(cards.map((card) => [stringValue(card.Id) ?? "", card]));

  return levelUps
    .map((levelUp) => {
      const level = numberValue(levelUp.Level);
      if (level == null) return null;
      const rewards = asRecord(levelUp.Rewards);
      const groups = asArray(rewards.Groups)
        .map((rawGroup) => {
          const group = asRecord(rawGroup);
          const ids = [...new Set(spawnIds(group.Filters))];
          const options = ids
            .map((id) => cardsById.get(id))
            .filter((card): card is GameCard => Boolean(card) && isReal(card!))
            .map((card) => {
              const title = localizedPair(asRecord(card.Localization).Title, translate);
              const description = localizedPair(asRecord(card.Localization).Description, translate);
              return {
                id: stringValue(card.Id) ?? "",
                name: title.en || stringValue(card.InternalName) || "",
                nameZh: title.zh,
                description: renderText(card, description.en, "en-US"),
                descriptionZh: renderText(card, description.zh, "zh-CN"),
                type: stringValue(card.Type) ?? ""
              };
            });
          if (options.length === 0) return null;
          const heroCondition = asArray(group.Prerequisites)
            .map((prerequisite) => asRecord(asRecord(prerequisite).Conditions))
            .find((conditions) => stringValue(conditions.$type) === "TRunConditionalPlayerHero");
          const heroes = heroCondition
            ? asArray(heroCondition.Heroes)
                .map(stringValue)
                .filter((value): value is string => Boolean(value))
                .map((hero) => slugify(hero, "common"))
            : [];
          return {
            limit: numberValue(asRecord(group.Limit).Value) ?? 1,
            weight: numberValue(group.RandomWeight) ?? 0,
            heroes,
            heroOperator: heroCondition ? stringValue(heroCondition.Operator) ?? "Any" : null,
            options
          };
        })
        .filter((group): group is NonNullable<typeof group> => Boolean(group));

      if (groups.length === 0) return null;

      const entry: WikiLevelUpEntry = {
        level,
        health: numberValue(levelUp.HealthIncrease),
        pick: numberValue(asRecord(rewards.Limit).Value),
        groups
      };
      return entry;
    })
    .filter((entry): entry is WikiLevelUpEntry => Boolean(entry))
    .sort((a, b) => a.level - b.level);
}

/** Rule constants that the game mode ships and the wiki can quote verbatim. */
export function buildRulesIndex(
  gameMode: Record<string, unknown>,
  cards: GameCard[] = [],
  translate: TranslationLookup = (key, english) => key ?? english
): WikiRulesEntry {
  const prestige = asRecord(gameMode.Prestige);
  const fates = asRecord(gameMode.Fates);
  const sandstorm = asRecord(gameMode.Sandstorm);
  const prices = asRecord(gameMode.StandardPrices);

  const priceTable = (raw: unknown): Record<string, Record<string, number>> => {
    const result: Record<string, Record<string, number>> = {};
    for (const [size, tiers] of Object.entries(asRecord(raw))) {
      const row: Record<string, number> = {};
      for (const [tier, value] of Object.entries(asRecord(tiers))) {
        const numeric = numberValue(value);
        if (numeric != null) row[tier] = numeric;
      }
      if (Object.keys(row).length > 0) result[size] = row;
    }
    return result;
  };

  const tierWeights = (raw: unknown): Record<string, number> => {
    const result: Record<string, number> = {};
    for (const [tier, value] of Object.entries(asRecord(raw))) {
      const numeric = numberValue(value);
      if (numeric != null) result[tier] = numeric;
    }
    return result;
  };

  const tiersByDay: Record<string, Record<string, number>> = {};
  for (const [day, weights] of Object.entries(asRecord(gameMode.ItemSkillSpawnTierPercantagesByDay))) {
    if (!/^\d+$/.test(day)) continue;
    tiersByDay[day] = tierWeights(weights);
  }

  // The Fate three-way choice is not a constant: `Fates.TemplateId` points at
  // the Futura event, whose options are ordinary EncounterSteps. Reading them
  // from the cards keeps the wiki quoting the shipped text.
  const fateId = stringValue(fates.TemplateId);
  const fateEvent = fateId ? cards.find((card) => stringValue(card.Id) === fateId) : undefined;
  const fateOptions = fateEvent
    ? spawnIds(asRecord(fateEvent.SelectionContext).SpawnContext)
        .map((id) => cards.find((card) => stringValue(card.Id) === id))
        .filter((card): card is GameCard => Boolean(card))
        .map((card) => {
          const title = localizedPair(asRecord(card.Localization).Title, translate);
          const description = localizedPair(asRecord(card.Localization).Description, translate);
          return {
            name: title.en || stringValue(card.InternalName) || "",
            nameZh: title.zh,
            description: renderText(card, description.en, "en-US"),
            descriptionZh: renderText(card, description.zh, "zh-CN")
          };
        })
    : [];

  // Reroll rules as shipped, grouped so the page can show the real distribution
  // (Bronze 2 / Silver 3 / Gold 4–6 / Diamond 8) instead of a community table.
  // Debug and tutorial records are skipped so the summary describes encounters
  // a player can actually meet, matching what the encounter index lists.
  const rerollGroups = new Map<string, WikiRulesEntry["encounterRerolls"][number]>();
  for (const card of cards) {
    if (!(ENCOUNTER_TYPES as readonly string[]).includes(stringValue(card.Type) ?? "")) continue;
    if (!isReal(card)) continue;
    const rules = rulesFrom(card);
    const rerolls = rules?.rerolls;
    if (!rerolls) continue;
    const tier = tierValue(card);
    const key = `${tier ?? "?"}|${rerolls.total ?? "inf"}|${rerolls.startingCost}|${rerolls.costIncrease}`;
    const existing = rerollGroups.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    rerollGroups.set(key, { tier, ...rerolls, count: 1 });
  }
  const tierRank: Record<string, number> = { Bronze: 0, Silver: 1, Gold: 2, Diamond: 3, Legendary: 4 };
  const encounterRerolls = [...rerollGroups.values()].sort(
    (a, b) =>
      (a.tier ? tierRank[a.tier] ?? 9 : 9) - (b.tier ? tierRank[b.tier] ?? 9 : 9) ||
      a.startingCost - b.startingCost ||
      b.count - a.count
  );

  const sandstormEntry = Object.keys(sandstorm).length > 0
    ? {
        baseTickRate: numberValue(sandstorm.BaseTickRate),
        tickRateDecrement: numberValue(sandstorm.TickRateDecrement),
        tickRateFloor: numberValue(sandstorm.TickRateFloor),
        baseDamage: numberValue(sandstorm.BaseDamage),
        additiveScalar: numberValue(sandstorm.AdditiveScalar),
        countdownStartTime: numberValue(sandstorm.CountdownStartTime),
        countdownDuration: numberValue(sandstorm.CountdownDuration)
      }
    : null;

  return {
    hoursInDay: numberValue(gameMode.HoursInADay),
    numberOfDays: numberValue(gameMode.NumberOfDays),
    victoriesToWin: numberValue(gameMode.VictoriesToWin),
    experiencePerLevel: numberValue(gameMode.ExperiencePerLevel),
    experiencePerHour: numberValue(gameMode.ExperiencePerHour),
    critPercentMultiplier: numberValue(gameMode.CritPercentMultiplier),
    burnDecrementPercent: numberValue(gameMode.BurnDecrementByAsPercentage),
    boardSocketsPerLevel: numberValue(gameMode.NumCarpetSocketsUnlockPerLevel),
    maxLevel: numberValue(gameMode.MaxLevel),
    prestige: {
      initial: numberValue(prestige.PrestigeInitial),
      max: numberValue(prestige.PrestigeMax),
      lossFromMonsters: numberValue(prestige.PrestigeLossFromMonsters)
    },
    fates: {
      templateId: fateId,
      spawnAtOrBelow: numberValue(fates.SpawnAtOrBelowPrestigeValue),
      afterPrestige: numberValue(fates.AfterFatesPrestigeValue)
    },
    fateOptions,
    sandstorm: sandstormEntry,
    encounterTierWeights: tierWeights(gameMode.EncounterSpawnTierPercentages),
    rewardTierWeights: tierWeights(gameMode.RewardSpawnTierPercentages),
    itemBuyPrices: priceTable(prices.ItemBuyPrices),
    itemSellPrices: priceTable(prices.ItemSellPrices),
    skillBuyPrices: priceTable(prices.SkillBuyPrices),
    skillSellPrices: priceTable(prices.SkillSellPrices),
    tiersByDay,
    encounterRerolls
  };
}
