import { asArray, asRecord, normalizeCardTier, numberValue, stringValue } from "./cardRecord";

/**
 * Converts the game's shipped `GameData.db` records into the raw JSON shape that
 * `normalizeAll` consumes. The functions here are pure so they can be unit tested
 * without a database; `scripts/import-gamedata.ts` only handles I/O.
 */

export type GameCard = Record<string, unknown>;
export type StandardPrices = Record<string, unknown>;
export type TranslationLookup = (key: string | null, english: string) => string | null;

export type ArtIndexEntry = {
  source: "unity-card" | "unity-skill-icon";
  bundle?: string;
  asset?: string;
  texture?: string;
};

export type ArtIndex = Record<string, ArtIndexEntry>;

export type RawCardRecord = Record<string, unknown>;

const CARD_TIERS = ["Bronze", "Silver", "Gold", "Diamond", "Legendary"] as const;
type ImportTier = (typeof CARD_TIERS)[number];

const DEBUG_PATTERNS = [
  /\[DEBUG\]/i,
  /ITEM TEMPLATE/i,
  /SKILL TEMPLATE/i,
  /^Unused Card$/i,
  /effectdata/i,
  /^SkillCard - /i
];

const MILLISECOND_ATTRIBUTES = new Set([
  "ChargeAmount",
  "CooldownMax",
  "FlatCooldownReduction",
  "FreezeAmount",
  "HasteAmount",
  "SlowAmount"
]);

const ACTION_ATTRIBUTE: Record<string, string> = {
  TActionCardCharge: "ChargeAmount",
  TActionCardFreeze: "FreezeAmount",
  TActionCardHaste: "HasteAmount",
  TActionCardReload: "ReloadAmount",
  TActionCardSlow: "SlowAmount",
  TActionPlayerBurnApply: "BurnApplyAmount",
  TActionPlayerBurnRemove: "BurnRemoveAmount",
  TActionPlayerDamage: "DamageAmount",
  TActionPlayerHeal: "HealAmount",
  TActionPlayerPoisonApply: "PoisonApplyAmount",
  TActionPlayerPoisonRemove: "PoisonRemoveAmount",
  TActionPlayerRageApply: "RageApplyAmount",
  TActionPlayerRegenApply: "RegenApplyAmount",
  TActionPlayerShieldApply: "ShieldApplyAmount",
  TActionPlayerTempoApply: "TempoApplyAmount"
};

const ACTION_TARGET_ATTRIBUTE: Record<string, string> = {
  TActionCardCharge: "ChargeTargets",
  TActionCardDestroy: "DestroyTargets",
  TActionCardDisable: "DisableTargets",
  TActionCardEnchant: "EnchantTargets",
  TActionCardFlyingStart: "FlyingTargets",
  TActionCardFlyingStop: "FlyingTargets",
  TActionCardFlyingToggle: "FlyingTargets",
  TActionCardForceUse: "ForceUseTargets",
  TActionCardFreeze: "FreezeTargets",
  TActionCardHaste: "HasteTargets",
  TActionCardReload: "ReloadTargets",
  TActionCardSlow: "SlowTargets",
  TActionCardTransform: "TransformTargets",
  TActionCardUpgrade: "UpgradeTargets"
};

const ATTRIBUTE_TARGET: Record<string, string> = {
  ChargeAmount: "ChargeTargets",
  DestroyTargets: "DestroyTargets",
  DisableTargets: "DisableTargets",
  EnchantTargets: "EnchantTargets",
  FlyingTargets: "FlyingTargets",
  ForceUseTargets: "ForceUseTargets",
  FreezeAmount: "FreezeTargets",
  HasteAmount: "HasteTargets",
  ReloadAmount: "ReloadTargets",
  SlowAmount: "SlowTargets",
  TransformTargets: "TransformTargets",
  UpgradeTargets: "UpgradeTargets"
};

const ACTION_KEYWORD: Record<string, string> = {
  TAuraActionCardAddTagsBySource: "Tag",
  TAuraActionCardAddTagsList: "Tag",
  TAuraActionCardModifyAttribute: "",
  TActionCardCharge: "Charge",
  TActionCardFreeze: "Freeze",
  TActionCardHaste: "Haste",
  TActionCardReload: "Ammo",
  TActionCardSlow: "Slow",
  TActionPlayerBurnApply: "Burn",
  TActionPlayerBurnRemove: "Burn",
  TActionPlayerDamage: "Damage",
  TActionPlayerHeal: "Heal",
  TActionPlayerPoisonApply: "Poison",
  TActionPlayerPoisonRemove: "Poison",
  TActionPlayerRageApply: "Rage",
  TActionPlayerRegenApply: "Regen",
  TActionPlayerReviveHeal: "Heal",
  TActionPlayerShieldApply: "Shield",
  TActionPlayerTempoApply: "Tempo"
};

const ATTRIBUTE_KEYWORD: Record<string, string> = {
  AmmoMax: "Ammo",
  BurnApplyAmount: "Burn",
  BurnRemoveAmount: "Burn",
  ChargeAmount: "Charge",
  CritChance: "Crit",
  DamageAmount: "Damage",
  DamageCrit: "Crit",
  FreezeAmount: "Freeze",
  HasteAmount: "Haste",
  HealAmount: "Heal",
  HealthMax: "Heal",
  HealthRegen: "Heal",
  Lifesteal: "Lifesteal",
  Multicast: "Multicast",
  PoisonApplyAmount: "Poison",
  PoisonRemoveAmount: "Poison",
  RageApplyAmount: "Rage",
  RegenApplyAmount: "Regen",
  ShieldApplyAmount: "Shield",
  SlowAmount: "Slow",
  TempoApplyAmount: "Tempo",
  Value: "Value"
};

const KEYWORD_ZH: Record<string, string> = {
  Ammo: "弹药",
  Burn: "灼烧",
  Charge: "充能",
  Crit: "暴击",
  Damage: "伤害",
  Freeze: "冻结",
  Haste: "加速",
  Heal: "治疗",
  Lifesteal: "吸血",
  Multicast: "多重释放",
  Poison: "剧毒",
  Rage: "怒火",
  Regen: "再生",
  Shield: "护盾",
  Slow: "减速",
  Tag: "",
  Tempo: "节奏",
  Value: "价值"
};

const KEYWORD_UNITS: Record<string, { en: RegExp; zh: RegExp }> = {
  Ammo: { en: /\bammo\b|\breload/i, zh: /弹药|装填/ },
  Burn: { en: /\bburn(?:ed|ing)?\b/i, zh: /灼烧|燃烧/ },
  Charge: { en: /\bcharge|\bsecond/i, zh: /充能|秒/ },
  Crit: { en: /\bcrit/i, zh: /暴击/ },
  Damage: { en: /\bdamage\b/i, zh: /伤害|攻击力/ },
  Freeze: { en: /\bfreez|\bsecond/i, zh: /冻结|秒/ },
  Haste: { en: /\bhaste\b|\bsecond/i, zh: /加速|秒/ },
  Heal: { en: /\bheal|\bhealth\b/i, zh: /治疗|生命/ },
  Lifesteal: { en: /\blifesteal\b/i, zh: /吸血/ },
  Multicast: { en: /\bmulticast\b/i, zh: /多重/ },
  Poison: { en: /\bpoison/i, zh: /剧毒|中毒/ },
  Rage: { en: /\brage\b|\benrage/i, zh: /怒火|愤怒|暴怒/ },
  Regen: { en: /\bregen/i, zh: /再生/ },
  Shield: { en: /\bshield\b/i, zh: /护盾|护甲/ },
  Slow: { en: /\bslow\b|\bsecond/i, zh: /减速|秒/ },
  Tempo: { en: /\btempo\b/i, zh: /节奏/ },
  Value: { en: /\bvalue\b/i, zh: /价值/ }
};

function record(value: unknown): Record<string, unknown> {
  return asRecord(value);
}

function cardTitle(card: GameCard): string {
  return stringValue(record(record(card.Localization).Title).Text) ?? "";
}

export function isDebugCard(card: GameCard): boolean {
  const title = cardTitle(card);
  const internal = stringValue(card.InternalName) ?? "";
  return DEBUG_PATTERNS.some((pattern) => pattern.test(title) || pattern.test(internal));
}

export function isItemOrSkill(card: GameCard): boolean {
  return card.Type === "Item" || card.Type === "Skill";
}

/**
 * Triggers that only fire outside of combat. A card whose every effect hangs off
 * one of these (sell-only loot, merchant packages, day/hour rewards, level-ups)
 * never contributes to a board fight, so the generator should not draft it.
 */
const OUT_OF_COMBAT_TRIGGERS = new Set([
  "TTriggerOnBeforeCardSold",
  "TTriggerOnCardPurchased",
  "TTriggerOnCardQuestCompleted",
  "TTriggerOnCardSelected",
  "TTriggerOnCardSold",
  "TTriggerOnCardUpgraded",
  "TTriggerOnDayStarted",
  "TTriggerOnEncounterCardsDealt",
  "TTriggerOnEncounterEntered",
  "TTriggerOnEncounterExited",
  "TTriggerOnEncounterSelected",
  "TTriggerOnHourStarted",
  "TTriggerOnPlayerLeveledUp",
  "TTriggerOnRunCompleted"
]);

/** Attributes the game only uses in the shop / economy layer (Value is `SellPrice`). */
const ECONOMY_ATTRIBUTES = new Set([
  "BuyPrice",
  "Experience",
  "Gold",
  "Income",
  "Level",
  "Prestige",
  "RerollCostModifier",
  "SellPrice"
]);

/** Actions that hand out rewards or change shop state rather than fighting. */
const ECONOMY_ACTIONS = new Set(["TActionGameDealCards", "TActionGameReroll", "TActionGameSpawnCards"]);

function triggerTypes(trigger: unknown): string[] {
  const node = record(trigger);
  const type = stringValue(node.$type);
  if (type === "TTriggerOr" || type === "TTriggerAnd") {
    const nested = asArray(node.Triggers).flatMap((child) => triggerTypes(child));
    return nested.length > 0 ? nested : type ? [type] : [];
  }
  return type ? [type] : [];
}

function actionIsEconomyOnly(action: unknown): boolean {
  const node = record(action);
  const type = stringValue(node.$type);
  if (!type) return false;
  if (type === "TActionAnd") {
    const children = asArray(node.Actions);
    return children.length > 0 && children.every((child) => actionIsEconomyOnly(child));
  }
  if (ECONOMY_ACTIONS.has(type)) return true;
  if (type.endsWith("ModifyAttribute")) {
    const attribute = stringValue(node.AttributeType) ?? stringValue(node.TargetAttributeType);
    return attribute != null && ECONOMY_ATTRIBUTES.has(attribute);
  }
  return false;
}

function triggerIsOutOfCombat(trigger: unknown): boolean {
  const node = record(trigger);
  const types = triggerTypes(node);
  if (types.length === 0) return false;
  return types.every((type) => {
    if (OUT_OF_COMBAT_TRIGGERS.has(type)) return true;
    if (type === "TTriggerOnPlayerAttributeChanged") {
      const attribute = stringValue(node.AttributeType);
      return attribute != null && ECONOMY_ATTRIBUTES.has(attribute);
    }
    return false;
  });
}

function effectIsCombatRelevant(effect: unknown): boolean {
  const node = record(effect);
  const worksIn = stringValue(node.WorksIn);
  if (worksIn === "CombatOnly") return true;
  if (worksIn === "OutOfCombatOnly") return false;
  if (triggerIsOutOfCombat(node.Trigger)) return false;
  return !actionIsEconomyOnly(node.Action);
}

export type CombatRelevance = "combat" | "economy";

export type CombatRelevanceResult = {
  relevance: CombatRelevance;
  reason: string;
};

/**
 * Decides whether a card can do anything during a fight. The game has no single
 * flag for this, so it is derived from the effect DSL: `WorksIn`, the trigger,
 * and whether the action only touches economy attributes.
 */
export function classifyCombatRelevance(card: GameCard): CombatRelevanceResult {
  const effects = [...Object.values(record(card.Abilities)), ...Object.values(record(card.Auras))];
  if (effects.length === 0) {
    // Skills such as the Note / Major passives ship no DSL effects but still
    // change combat, so only effect-less items are treated as economy.
    return card.Type === "Skill"
      ? { relevance: "combat", reason: "no-effects-skill" }
      : { relevance: "economy", reason: "no-effects-item" };
  }
  const combatEffect = effects.find(effectIsCombatRelevant);
  if (combatEffect) {
    const worksIn = stringValue(record(combatEffect).WorksIn);
    return { relevance: "combat", reason: worksIn === "CombatOnly" ? "combat-only" : "in-combat-effect" };
  }
  const onlyOutOfCombatTriggers = effects.every((effect) => triggerIsOutOfCombat(record(effect).Trigger));
  return { relevance: "economy", reason: onlyOutOfCombatTriggers ? "out-of-combat-trigger" : "economy-effect" };
}

export function availableTierKeys(card: GameCard): ImportTier[] {
  const tiers = record(card.Tiers);
  return CARD_TIERS.filter((tier) => tiers[tier] != null);
}

function startingTier(card: GameCard): ImportTier | null {
  return normalizeCardTier(card.StartingTier) as ImportTier | null;
}

/**
 * The tier whose attributes act as `BaseAttributes`: the starting tier when it
 * exists, otherwise the highest tier below it (Legendary cards that only ship a
 * Diamond block), otherwise the first available tier.
 */
export function baseTierKey(card: GameCard): ImportTier | null {
  const keys = availableTierKeys(card);
  const starting = startingTier(card);
  if (starting && keys.includes(starting)) return starting;
  if (starting) {
    const startingIndex = CARD_TIERS.indexOf(starting);
    for (let index = startingIndex - 1; index >= 0; index -= 1) {
      const candidate = CARD_TIERS[index];
      if (keys.includes(candidate)) return candidate;
    }
  }
  return keys[0] ?? null;
}

export function effectiveTierAttributes(card: GameCard, tier: ImportTier): Record<string, number> {
  const tiers = record(card.Tiers);
  const attributes: Record<string, number> = {};
  const targetIndex = CARD_TIERS.indexOf(tier);

  for (const candidate of CARD_TIERS) {
    if (CARD_TIERS.indexOf(candidate) > targetIndex) break;
    const tierAttributes = record(record(tiers[candidate]).Attributes);
    for (const [key, value] of Object.entries(tierAttributes)) {
      const numeric = numberValue(value);
      if (numeric != null) attributes[key] = numeric;
    }
  }

  return attributes;
}

function priceTable(tables: StandardPrices, key: string, type: string, size: string, tier: string): number | null {
  const table = record(tables[key]);
  const bySize = record(table[size]);
  return numberValue(bySize[tier]) ?? numberValue(record(table.Medium)[tier]);
}

export function derivePrice(
  standardPrices: StandardPrices,
  type: string,
  size: string,
  tier: string,
  kind: "buy" | "sell"
): number | null {
  if (type === "Skill") {
    return priceTable(standardPrices, kind === "buy" ? "SkillBuyPrices" : "SkillSellPrices", type, "Medium", tier);
  }
  return priceTable(standardPrices, kind === "buy" ? "ItemBuyPrices" : "ItemSellPrices", type, size, tier);
}

export function attributesWithPrices(
  attributes: Record<string, number>,
  standardPrices: StandardPrices,
  type: string,
  size: string,
  tier: ImportTier
): Record<string, number> {
  const result = { ...attributes };
  if (result.BuyPrice == null) {
    const buy = derivePrice(standardPrices, type, size, tier, "buy");
    if (buy != null) result.BuyPrice = buy;
  }
  if (result.SellPrice == null) {
    const sell = derivePrice(standardPrices, type, size, tier, "sell");
    if (sell != null) result.SellPrice = sell;
  }
  return result;
}

type ResolvedNumber = { value: number | undefined; timeScaled: boolean };

function undefinedNumber(): ResolvedNumber {
  return { value: undefined, timeScaled: false };
}

function applyModifier(
  base: number | undefined,
  modifier: unknown,
  attributes: Record<string, number>
): number | undefined {
  if (base == null) return undefined;
  const modifierRecord = record(modifier);
  if (Object.keys(modifierRecord).length === 0) return base;

  const factor = resolveValueExpression(modifierRecord.Value, attributes).value;
  if (factor == null) return undefined;

  const mode = stringValue(modifierRecord.ModifyMode) ?? "Multiply";
  let result: number;
  if (mode === "Multiply") result = base * factor;
  else if (mode === "Add") result = base + factor;
  else if (mode === "Set") result = factor;
  else return undefined;

  if (modifierRecord.ShouldRound === true) result = Math.round(result);
  return result;
}

export function resolveValueExpression(expression: unknown, attributes: Record<string, number>): ResolvedNumber {
  const value = record(expression);
  const type = stringValue(value.$type);
  if (!type) return undefinedNumber();

  if (type === "TFixedValue") {
    const numeric = numberValue(value.Value);
    return numeric == null ? undefinedNumber() : { value: numeric, timeScaled: false };
  }

  if (type === "TReferenceValueCardAttribute" || type === "TReferenceValueCardAttributeUnscaled") {
    const attributeType = stringValue(value.AttributeType);
    if (!attributeType) return undefinedNumber();
    const raw = attributes[attributeType];
    // `DefaultValue` is the game's fallback when the referenced card does not
    // expose the attribute statically (cross-card references, aggregates).
    if (raw == null) {
      const fallback = numberValue(value.DefaultValue);
      if (fallback == null) return undefinedNumber();
      return { value: applyModifier(fallback, value.Modifier, attributes), timeScaled: false };
    }
    const scaled = MILLISECOND_ATTRIBUTES.has(attributeType) && type === "TReferenceValueCardAttribute";
    const base = scaled ? raw / 1000 : raw;
    return { value: applyModifier(base, value.Modifier, attributes), timeScaled: scaled };
  }

  if (type === "TReferenceValuePlayerAttribute" || type === "TReferenceValuePlayerAttributeUnscaled") {
    const base = numberValue(value.DefaultValue) ?? 0;
    return { value: applyModifier(base, value.Modifier, attributes), timeScaled: false };
  }

  // Aggregates are summed over the player's cards at runtime and cannot be
  // resolved statically; the game's default (0) keeps the displayed token a
  // number instead of leaving a raw `{aura.N}` in the tooltip.
  if (type === "TReferenceValueCardAttributeAggregate") {
    const base = numberValue(value.DefaultValue) ?? 0;
    return { value: applyModifier(base, value.Modifier, attributes), timeScaled: false };
  }

  if (
    type === "TReferenceValueCardCount" ||
    type === "TReferenceValueCardTagCount" ||
    type === "TReferenceValueUniqueCardCount"
  ) {
    return { value: applyModifier(1, value.Modifier, attributes), timeScaled: false };
  }

  if (type === "TRangeValue") {
    const numeric = numberValue(value.Min) ?? numberValue(value.Max);
    return numeric == null ? undefinedNumber() : { value: numeric, timeScaled: false };
  }

  return undefinedNumber();
}

function actionAttributeKey(action: Record<string, unknown>): string | null {
  return stringValue(action.AttributeType) ?? ACTION_ATTRIBUTE[stringValue(action.$type) ?? ""] ?? null;
}

function scaleForAction(action: Record<string, unknown>, resolved: ResolvedNumber): number | undefined {
  if (resolved.value == null) return undefined;
  const attributeKey = actionAttributeKey(action);
  if (!resolved.timeScaled && attributeKey && MILLISECOND_ATTRIBUTES.has(attributeKey)) {
    return resolved.value / 1000;
  }
  return resolved.value;
}

export function resolveActionValue(action: unknown, attributes: Record<string, number>): number | undefined {
  const actionRecord = record(action);
  if (Object.keys(actionRecord).length === 0) return undefined;

  const value = record(actionRecord.Value);
  if (Object.keys(value).length > 0) {
    return scaleForAction(actionRecord, resolveValueExpression(value, attributes));
  }

  // `TActionGameSpawnCards` stores its count in `SpawnContext.Limit`, not in
  // `Value`; e.g. "get {ability.0} Spare Change".
  const spawnLimit = record(record(actionRecord.SpawnContext).Limit);
  if (Object.keys(spawnLimit).length > 0) {
    return resolveValueExpression(spawnLimit, attributes).value;
  }

  const attributeKey = actionAttributeKey(actionRecord);
  if (attributeKey) {
    const raw = attributes[attributeKey];
    if (raw != null) {
      return MILLISECOND_ATTRIBUTES.has(attributeKey) ? raw / 1000 : raw;
    }
  }

  return undefined;
}

export function resolveActionTargets(action: unknown, attributes: Record<string, number>): number | undefined {
  const actionRecord = record(action);
  if (Object.keys(actionRecord).length === 0) return undefined;

  if (actionRecord.TargetCount != null) {
    const count = resolveValueExpression(actionRecord.TargetCount, attributes).value;
    if (count != null) return count;
  }

  const attributeKey = actionAttributeKey(actionRecord);
  const targetKey =
    (attributeKey ? ATTRIBUTE_TARGET[attributeKey] : undefined) ??
    ACTION_TARGET_ATTRIBUTE[stringValue(actionRecord.$type) ?? ""];
  if (targetKey) {
    const raw = attributes[targetKey];
    if (raw != null) return raw;
  }

  return undefined;
}

export function resolveActionModifier(action: unknown, attributes: Record<string, number>): number | undefined {
  const actionRecord = record(action);
  const modifier = record(record(actionRecord.Value).Modifier);
  if (Object.keys(modifier).length === 0) return undefined;
  const expression = record(modifier.Value);
  if (Object.keys(expression).length === 0) return undefined;
  return resolveValueExpression(expression, attributes).value;
}

export type TokenContext = {
  Abilities?: unknown;
  Auras?: unknown;
};

function tokenNode(token: string, context: TokenContext): { kind: "ability" | "aura"; id: string; sub: string | null } | null {
  const match = /^\{(ability|aura)\.([A-Za-z0-9]+)(?:\.([a-z]+))?\}$/.exec(token);
  if (!match) return null;
  return { kind: match[1] as "ability" | "aura", id: match[2], sub: match[3] ?? null };
}

export function resolveToken(token: string, context: TokenContext, attributes: Record<string, number>): number | undefined {
  const nodeInfo = tokenNode(token, context);
  if (nodeInfo) {
    const primary = record(nodeInfo.kind === "ability" ? context.Abilities : context.Auras);
    // A handful of cards reference an aura through an `{ability.N}` token (or
    // vice versa); fall back to the other node kind before giving up.
    const fallback = record(nodeInfo.kind === "ability" ? context.Auras : context.Abilities);
    const node = Object.keys(record(primary[nodeInfo.id])).length > 0 ? record(primary[nodeInfo.id]) : record(fallback[nodeInfo.id]);
    if (Object.keys(node).length === 0) return undefined;
    if (nodeInfo.sub === "targets") return resolveActionTargets(node.Action, attributes);
    if (nodeInfo.sub === "mod") return resolveActionModifier(node.Action, attributes);
    return resolveActionValue(node.Action, attributes);
  }

  const customMatch = /^\{custom_(\d+)\}$/.exec(token);
  if (customMatch) return attributes[`Custom_${customMatch[1]}`];

  if (token === "{TempoCost}") return attributes.TempoCost;

  const either = /^\{(.+?) \?\? (.+?)\}$/.exec(token);
  if (either) {
    const first = resolveToken(`{${either[1]}}`, context, attributes);
    if (first != null) return first;
    return resolveToken(`{${either[2]}}`, context, attributes);
  }

  return undefined;
}

export function keywordForNode(node: unknown): string | null {
  const action = record(record(node).Action);
  const actionType = stringValue(action.$type);
  const byAction = actionType ? ACTION_KEYWORD[actionType] : undefined;
  if (byAction) return byAction;
  const attributeType = stringValue(action.AttributeType);
  if (attributeType) return ATTRIBUTE_KEYWORD[attributeType] ?? null;
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsKeyword(segment: string, keyword: string, locale: string): boolean {
  if (!segment || !keyword) return false;
  if (locale === "zh-CN") {
    const zhKeyword = KEYWORD_ZH[keyword] ?? keyword;
    return Boolean(zhKeyword) && (segment.includes(zhKeyword) || segment.includes(keyword));
  }
  return new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i").test(segment);
}

function unitPresent(segment: string, keyword: string, locale: string): boolean {
  const units = KEYWORD_UNITS[keyword];
  if (!units) return false;
  return (locale === "zh-CN" ? units.zh : units.en).test(segment);
}

function segmentBefore(text: string): string {
  return text.split(/[.;,，。；、!?！？\n]/).pop() ?? "";
}

function segmentAfter(text: string): string {
  return text.split(/[.;,，。；、!?！？\n]/)[0] ?? "";
}

/**
 * The game templates omit the keyword that names the unit of a value
 * (`gain {ability.0}`). Insert it only when the surrounding clause neither
 * repeats the keyword nor names a unit of its own (`second`, `Health`, `%`...).
 */
export function insertKeyword(text: string, token: string, keyword: string | null, locale: string): string {
  if (!keyword || !token || !text.includes(token)) return text;
  const localized = locale === "zh-CN" ? KEYWORD_ZH[keyword] ?? keyword : keyword;
  if (!localized) return text;

  const parts = text.split(token);
  let output = parts[0];
  for (let index = 1; index < parts.length; index += 1) {
    const before = segmentBefore(output);
    const after = segmentAfter(parts[index]);
    const present =
      containsKeyword(before, keyword, locale) ||
      containsKeyword(after, keyword, locale) ||
      unitPresent(after, keyword, locale);
    output += token;
    if (!present) {
      output += locale === "zh-CN" ? localized : ` ${localized}`;
    }
    output += parts[index];
  }
  return output;
}

function collectTokens(text: string): string[] {
  return [...new Set(text.match(/\{[^}]+\}/g) ?? [])];
}

/**
 * The game appends a secondary runtime readout in brackets, e.g.
 * `Your items have +{aura.0.mod} ... [{aura.0}]` or `[{ability.0} Shield]`.
 * Those values are only known during a run, so the old BazaarDB export dropped
 * them; doing the same keeps tooltips readable instead of showing `[0]`.
 */
export function stripBracketAnnotations(text: string): string {
  return text
    .replace(/\s*\[[^\]]*\{[^}]+\}[^\]]*\]/g, "")
    .replace(/[ \t]+([.;,，。；、!?！？])/g, "$1")
    .trim();
}

function tooltipTexts(card: GameCard, locale: "en-US" | "zh-CN", translate: TranslationLookup): string[] {
  return asArray(record(card.Localization).Tooltips)
    .map(record)
    .map((tooltip) => {
      const content = record(tooltip.Content);
      const english = stringValue(content.Text) ?? "";
      if (!english) return "";
      const text = locale === "en-US" ? english : translate(stringValue(content.Key), english) ?? english;
      return stripBracketAnnotations(text) || text;
    });
}

type TooltipResult = {
  en: string[];
  zh: string[];
  replacements: Record<string, Record<string, number | string>>;
};

function buildTooltips(
  card: GameCard,
  attributesByTier: Map<ImportTier, Record<string, number>>,
  translate: TranslationLookup
): TooltipResult {
  const tiers = [...attributesByTier.keys()];
  const englishTooltips = tooltipTexts(card, "en-US", translate);
  const chineseTooltips = tooltipTexts(card, "zh-CN", translate);
  const replacements: Record<string, Record<string, number | string>> = {};

  for (const token of englishTooltips.flatMap(collectTokens)) {
    const values = new Map<ImportTier, number>();
    for (const tier of tiers) {
      const value = resolveToken(token, card, attributesByTier.get(tier) ?? {});
      if (value != null) values.set(tier, value);
    }
    if (values.size === 0) continue;

    const unique = new Set([...values.values()].map((value) => value.toFixed(6)));
    if (unique.size === 1) {
      replacements[token] = { Fixed: [...values.values()][0] };
    } else {
      replacements[token] = Object.fromEntries([...values.entries()]);
    }
  }

  const applyKeywords = (texts: string[], locale: string): string[] =>
    texts.map((text) => {
      let result = text;
      for (const token of collectTokens(text)) {
        const nodeInfo = tokenNode(token, card);
        if (!nodeInfo || nodeInfo.sub === "targets") continue;
        const nodes = record(nodeInfo.kind === "ability" ? card.Abilities : card.Auras);
        const keyword = keywordForNode(nodes[nodeInfo.id]);
        result = insertKeyword(result, token, keyword, locale);
      }
      return result;
    });

  const english = applyKeywords(englishTooltips, "en-US");
  const chineseRaw = chineseTooltips.map((text, index) => text || english[index] || "");
  const chinese = applyKeywords(chineseRaw, "zh-CN");

  return { en: english, zh: chinese, replacements };
}

function enchantmentBlock(
  card: GameCard,
  enchantment: Record<string, unknown>,
  cardAttributesByTier: Map<ImportTier, Record<string, number>>,
  translate: TranslationLookup
): Record<string, unknown> {
  const enchantAttributes = record(enchantment.Attributes);
  const context: TokenContext = {
    Abilities: { ...record(card.Abilities), ...record(enchantment.Abilities) },
    Auras: { ...record(card.Auras), ...record(enchantment.Auras) }
  };
  const attributesByTier = new Map<ImportTier, Record<string, number>>();
  for (const [tier, attributes] of cardAttributesByTier.entries()) {
    const merged: Record<string, number> = { ...attributes };
    for (const [key, value] of Object.entries(enchantAttributes)) {
      const numeric = numberValue(value);
      if (numeric != null) merged[key] = numeric;
    }
    attributesByTier.set(tier, merged);
  }

  const englishTooltips = asArray(record(enchantment.Localization).Tooltips)
    .map(record)
    .map((tooltip) => {
      const content = record(tooltip.Content);
      return {
        key: stringValue(content.Key),
        english: stripBracketAnnotations(stringValue(content.Text) ?? ""),
        type: stringValue(tooltip.TooltipType) ?? "Passive"
      };
    })
    .filter((tooltip) => Boolean(tooltip.english));

  const replacements: Record<string, Record<string, number | string>> = {};
  const keywords: Record<string, string> = {};
  const tokens = [...new Set(englishTooltips.flatMap((tooltip) => collectTokens(tooltip.english)))];

  for (const token of tokens) {
    const nodeInfo = tokenNode(token, context);
    if (nodeInfo) {
      const nodes = record(nodeInfo.kind === "ability" ? context.Abilities : context.Auras);
      const keyword = keywordForNode(nodes[nodeInfo.id]);
      if (keyword) keywords[token] = keyword;
    }

    const values = new Map<ImportTier, number>();
    for (const tier of attributesByTier.keys()) {
      const value = resolveToken(token, context, attributesByTier.get(tier) ?? {});
      if (value != null) values.set(tier, value);
    }
    if (values.size === 0) continue;
    const unique = new Set([...values.values()].map((value) => value.toFixed(6)));
    replacements[token] = unique.size === 1
      ? { Fixed: [...values.values()][0] }
      : Object.fromEntries([...values.entries()]);
  }

  const withKeywords = (texts: string[], locale: string): string[] =>
    texts.map((text) => {
      let result = text;
      for (const token of collectTokens(text)) {
        result = insertKeyword(result, token, keywords[token] ?? null, locale);
      }
      return result;
    });

  const english = withKeywords(englishTooltips.map((tooltip) => tooltip.english), "en-US");
  const chinese = withKeywords(
    englishTooltips.map((tooltip) => {
      const translated = translate(tooltip.key, tooltip.english) ?? tooltip.english;
      return stripBracketAnnotations(translated) || translated;
    }),
    "zh-CN"
  );

  return {
    Tags: asArray(enchantment.Tags),
    HiddenTags: asArray(enchantment.HiddenTags),
    DisplayTags: [],
    Localization: {
      Tooltips: english.map((text, index) => ({
        Content: { Key: englishTooltips[index]?.key ?? null, Text: text },
        TooltipType: englishTooltips[index]?.type ?? "Passive",
        TooltipCondition: null
      }))
    },
    TooltipReplacements: replacements,
    TooltipReplacementKeywords: {},
    i18n: {
      "en-US": {
        Tooltips: english.map((text, index) => ({
          Content: { Text: text },
          TooltipType: englishTooltips[index]?.type ?? "Passive",
          TooltipCondition: null
        }))
      },
      "zh-CN": {
        Tooltips: chinese.map((text, index) => ({
          Content: { Text: text },
          TooltipType: englishTooltips[index]?.type ?? "Passive",
          TooltipCondition: null
        }))
      }
    }
  };
}

export type BuildRawCardOptions = {
  standardPrices: StandardPrices;
  translate: TranslationLookup;
  artIndex: ArtIndex;
  existingImageIds: Set<string>;
  patch: string;
  scrapedAt: string;
};

export function buildRawCard(card: GameCard, options: BuildRawCardOptions): RawCardRecord {
  const id = stringValue(card.Id) ?? "";
  const type = stringValue(card.Type) ?? "Item";
  const size = stringValue(card.Size) ?? "Medium";
  const tiers = availableTierKeys(card);
  const baseKey = baseTierKey(card);
  const tierRecords = record(card.Tiers);

  const attributesByTier = new Map<ImportTier, Record<string, number>>();
  for (const tier of tiers) {
    const effective = effectiveTierAttributes(card, tier);
    attributesByTier.set(tier, attributesWithPrices(effective, options.standardPrices, type, size, tier));
  }
  const baseAttributes = baseKey
    ? attributesWithPrices(effectiveTierAttributes(card, baseKey), options.standardPrices, type, size, baseKey)
    : {};

  const { en, zh, replacements } = buildTooltips(card, attributesByTier, options.translate);
  const rawTierRecords = asArray(record(card.Localization).Tooltips).map(record);

  const outputTiers: Record<string, unknown> = {};
  for (const tier of tiers) {
    const tierRecord = record(tierRecords[tier]);
    outputTiers[tier] = {
      AbilityIds: asArray(tierRecord.AbilityIds),
      AuraIds: asArray(tierRecord.AuraIds),
      OverrideAttributes: attributesByTier.get(tier) ?? {},
      ActiveTooltips: asArray(tierRecord.TooltipIds)
    };
  }

  const enchantments: Record<string, unknown> = {};
  for (const [name, enchantment] of Object.entries(record(card.Enchantments))) {
    enchantments[name] = enchantmentBlock(card, record(enchantment), attributesByTier, options.translate);
  }

  const heroes = asArray(card.Heroes).map(stringValue).filter((hero): hero is string => Boolean(hero));
  const displayTags = asArray(card.Tags).map(stringValue).filter((tag): tag is string => Boolean(tag));
  const hiddenTags = asArray(card.HiddenTags).map(stringValue).filter((tag): tag is string => Boolean(tag));
  const combatRelevance = classifyCombatRelevance(card);
  const title = cardTitle(card);
  const localizedTitle = options.translate(stringValue(record(record(card.Localization).Title).Key), title) ?? title;
  const art = options.artIndex[id];
  const imageUrl = options.existingImageIds.has(id) || art ? `/images/cards/${id}.webp` : null;

  return {
    Id: id,
    Type: type,
    Title: { Text: title },
    Description: null,
    BaseTier: stringValue(card.StartingTier) ?? baseKey,
    BaseAttributes: baseAttributes,
    Size: size,
    Heroes: heroes,
    SpawningEligibility: stringValue(card.SpawningEligibility) ?? "Always",
    CombatRelevance: combatRelevance.relevance,
    CombatRelevanceReason: combatRelevance.reason,
    DisplayTags: displayTags,
    HiddenTags: hiddenTags,
    Tags: [...new Set([type, size, ...heroes, ...displayTags, ...hiddenTags])],
    Tiers: outputTiers,
    Tooltips: rawTierRecords.map((tooltip, index) => ({
      Content: { Key: stringValue(record(tooltip.Content).Key), Text: en[index] ?? "" },
      TooltipType: stringValue(tooltip.TooltipType) ?? "Passive",
      TooltipCondition: null
    })),
    TooltipReplacements: replacements,
    TooltipReplacementKeywords: {},
    Enchantments: enchantments,
    InternalName: stringValue(card.InternalName) ?? "",
    ArtKey: stringValue(card.ArtKey) ?? "",
    i18n: {
      "en-US": {
        Title: { Text: title },
        Tooltips: en.map((text) => ({ Content: { Text: text }, TooltipType: "Passive", TooltipCondition: null }))
      },
      "zh-CN": {
        Title: { Text: localizedTitle },
        Tooltips: zh.map((text) => ({ Content: { Text: text }, TooltipType: "Passive", TooltipCondition: null }))
      }
    },
    image_url: imageUrl,
    local_image_path: imageUrl ? `data/images/cards/${id}.webp` : null,
    source_url: null,
    patch: options.patch,
    scraped_at: options.scrapedAt
  };
}

const ENCOUNTER_TYPES = new Set(["EventEncounter", "EncounterStep", "CombatEncounter", "PedestalEncounter"]);

/**
 * The game's own "which tiers can spawn on day N" table
 * (`game_modes[0].ItemSkillSpawnTierPercantagesByDay`). This is the only
 * authoritative day signal in the data: source and merchant records almost
 * never carry a day window (7 of 224 sources do), so deriving days from them
 * made the day filter look broken — day 1 collapsed to a single card.
 */
export function buildSpawnTiersByDay(gameMode: Record<string, unknown>): Record<string, string[]> {
  const raw = record(gameMode.ItemSkillSpawnTierPercantagesByDay);
  // The table ships days past the run length (up to 20); only the first
  // `NumberOfDays` are reachable, and the catalog only offers those.
  const numberOfDays = numberValue(gameMode.NumberOfDays) ?? 10;
  const table: Record<string, string[]> = {};
  for (const [day, weights] of Object.entries(raw)) {
    if (!/^\d+$/.test(day)) continue;
    if (Number(day) > numberOfDays) continue;
    const tiers = Object.entries(record(weights))
      .filter(([, weight]) => (numberValue(weight) ?? 0) > 0)
      .map(([tier]) => tier)
      .filter((tier) => CARD_TIERS.includes(tier as ImportTier));
    if (tiers.length > 0) table[day] = tiers;
  }
  return table;
}

export type MonsterRecord = Record<string, unknown>;

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
      for (const id of asArray(current.Ids).map(stringValue)) {
        if (id) ids.push(id);
      }
    }
    for (const key of Object.keys(current)) walk(current[key]);
  };
  walk(node);
  return ids;
}

function monsterCardIds(encounter: GameCard, monstersById: Map<string, MonsterRecord>): string[] {
  const combatant = record(encounter.CombatantType);
  const monsterId = stringValue(combatant.MonsterTemplateId);
  if (!monsterId) return [];
  const monster = monstersById.get(monsterId);
  if (!monster) return [];

  const player = record(monster.Player);
  const ids: string[] = [];
  for (const section of ["Hand", "Stash"]) {
    for (const item of asArray(record(player[section]).Items).map(record)) {
      const templateId = stringValue(item.TemplateId);
      if (templateId) ids.push(templateId);
    }
  }
  for (const skill of asArray(player.Skills).map(record)) {
    const templateId = stringValue(skill.TemplateId);
    if (templateId) ids.push(templateId);
  }
  return ids;
}

function collectDayConditions(node: unknown, days: Set<number>): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((entry) => collectDayConditions(entry, days));
    return;
  }
  const current = node as Record<string, unknown>;
  if (current.$type === "TRunConditionalCurrentDay") {
    const day = numberValue(current.CurrentDay);
    const operator = stringValue(current.ComparisonOperator) ?? "Equal";
    if (day != null) {
      if (operator === "Equal") days.add(day);
      else if (operator === "GreaterThanOrEqual") for (let value = day; value <= 10; value += 1) days.add(value);
      else if (operator === "GreaterThan") for (let value = day + 1; value <= 10; value += 1) days.add(value);
      else if (operator === "LessThanOrEqual") for (let value = 1; value <= day; value += 1) days.add(value);
      else if (operator === "LessThan") for (let value = 1; value < day; value += 1) days.add(value);
    }
  }
  for (const key of Object.keys(current)) collectDayConditions(current[key], days);
}

function isTutorialCard(card: GameCard): boolean {
  return /tutorial/i.test(stringValue(card.InternalName) ?? "");
}

export type DerivedSource = {
  source_type: "DroppedBy";
  source_id: string;
  title: string;
  category: string;
  category_type: string;
  days: number[];
  availability_labels: string[];
  card_ids: string[];
  card_count: number;
  i18n: Record<string, { title: string }>;
};

const SOURCE_CATEGORY: Record<string, { category: string; categoryType: string }> = {
  CombatEncounter: { category: "Monsters", categoryType: "Monster" },
  PedestalEncounter: { category: "Monsters", categoryType: "Monster" },
  EventEncounter: { category: "Events", categoryType: "Event" },
  EncounterStep: { category: "Events", categoryType: "Event Step" }
};

export function deriveSources(
  cards: GameCard[],
  monsters: MonsterRecord[],
  translate: TranslationLookup
): DerivedSource[] {
  const byId = new Map(cards.map((card) => [stringValue(card.Id) ?? "", card]));
  const monstersById = new Map(monsters.map((monster) => [stringValue(monster.Id) ?? "", monster]));
  const realCardIds = new Set(
    cards
      .filter((card) => isItemOrSkill(card) && !isDebugCard(card) && stringValue(card.SpawningEligibility) !== "Never")
      .map((card) => stringValue(card.Id) ?? "")
  );

  const expand = (encounter: GameCard): { cardIds: Set<string>; days: Set<number> } => {
    const cardIds = new Set<string>();
    const days = new Set<number>();
    const seen = new Set<string>();
    const stack = [...spawnIds(encounter), ...monsterCardIds(encounter, monstersById)];
    collectDayConditions(encounter, days);

    while (stack.length > 0) {
      const id = stack.pop();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const card = byId.get(id);
      if (!card) continue;
      if (isItemOrSkill(card)) {
        if (realCardIds.has(id)) cardIds.add(id);
        continue;
      }
      if (ENCOUNTER_TYPES.has(stringValue(card.Type) ?? "")) {
        collectDayConditions(card, days);
        stack.push(...spawnIds(card), ...monsterCardIds(card, monstersById));
      }
    }

    return { cardIds, days };
  };

  const groups = new Map<string, { primary: GameCard; type: string; cardIds: Set<string>; days: Set<number> }>();
  for (const card of cards) {
    const type = stringValue(card.Type) ?? "";
    if (!ENCOUNTER_TYPES.has(type)) continue;
    if (isDebugCard(card) || isTutorialCard(card)) continue;
    if (stringValue(card.SpawningEligibility) === "Never") continue;

    const { cardIds, days } = expand(card);
    if (cardIds.size === 0) continue;

    const title = cardTitle(card);
    const key = `${title}|${type}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { primary: card, type, cardIds: new Set(cardIds), days: new Set(days) });
      continue;
    }
    cardIds.forEach((id) => existing.cardIds.add(id));
    days.forEach((day) => existing.days.add(day));
    if (stringValue(card.SpawningEligibility) === "Always" && stringValue(existing.primary.SpawningEligibility) !== "Always") {
      existing.primary = card;
    }
  }

  return [...groups.values()]
    .map(({ primary, type, cardIds, days }) => {
      const title = cardTitle(primary);
      const category = SOURCE_CATEGORY[type] ?? { category: "Events", categoryType: "Event" };
      const sortedDays = [...days].filter((day) => day >= 1 && day <= 10).sort((a, b) => a - b);
      return {
        source_type: "DroppedBy" as const,
        source_id: stringValue(primary.Id) ?? title,
        title,
        category: category.category,
        category_type: category.categoryType,
        days: sortedDays,
        availability_labels: [],
        card_ids: [...cardIds].sort(),
        card_count: cardIds.size,
        i18n: {
          "en-US": { title },
          "zh-CN": { title: translate(stringValue(record(record(primary.Localization).Title).Key), title) ?? title }
        }
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

export type DerivedMerchant = {
  id: string;
  name: string;
  nameZh?: string;
  isHeroMerchant?: boolean;
  heroes: string[];
  filters?: Record<string, unknown>;
};

type MerchantFilterDraft = {
  tag: string[];
  hiddenTag: string[];
  notTag: string[];
  size: string[];
  tier: string[];
  heroes: string[];
  enchantmentOnly: boolean;
  cardTypes: string[];
};

function emptyMerchantFilter(): MerchantFilterDraft {
  return { tag: [], hiddenTag: [], notTag: [], size: [], tier: [], heroes: [], enchantmentOnly: false, cardTypes: [] };
}

function mergeConstraint(constraint: unknown, filter: MerchantFilterDraft): void {
  const node = record(constraint);
  const type = stringValue(node.$type);
  const isNot = node.IsNot === true;

  if (type === "ConstraintAnd" || type === "ConstraintOr") {
    for (const child of asArray(node.Constraints)) mergeConstraint(child, filter);
    return;
  }
  if (type === "ConstraintTag") {
    const values = asArray(node.Tags).map(stringValue).filter((value): value is string => Boolean(value));
    (isNot ? filter.notTag : filter.tag).push(...values);
    return;
  }
  if (type === "ConstraintHiddenTag") {
    const values = asArray(node.HiddenTags).map(stringValue).filter((value): value is string => Boolean(value));
    (isNot ? filter.notTag : filter.hiddenTag).push(...values);
    return;
  }
  if (type === "ConstraintSize") {
    filter.size.push(...asArray(node.Sizes).map(stringValue).filter((value): value is string => Boolean(value)));
    return;
  }
  if (type === "ConstraintTier") {
    filter.tier.push(...asArray(node.Tiers).map(stringValue).filter((value): value is string => Boolean(value)));
    return;
  }
  if (type === "ConstraintHero") {
    filter.heroes.push(...asArray(node.Heroes).map(stringValue).filter((value): value is string => Boolean(value)));
    return;
  }
  if (type === "ConstraintCardType") {
    filter.cardTypes.push(...asArray(node.Types).map(stringValue).filter((value): value is string => Boolean(value)));
    return;
  }
  if (type === "ConstraintEnchantmentEligible" && !isNot) {
    filter.enchantmentOnly = true;
  }
}

function findSpawnFilters(node: unknown, output: Record<string, unknown>[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((entry) => findSpawnFilters(entry, output));
    return;
  }
  const current = node as Record<string, unknown>;
  if (current.$type === "TSpawnFilterQuery" && current.Constraints) {
    output.push(record(current.Constraints));
  }
  for (const key of Object.keys(current)) findSpawnFilters(current[key], output);
}

function compactFilter(filter: MerchantFilterDraft): Record<string, unknown> | undefined {
  const result: Record<string, unknown> = {};
  const unique = (values: string[]): string[] => [...new Set(values)];
  if (filter.tag.length > 0) result.tag = unique(filter.tag);
  if (filter.hiddenTag.length > 0) result.hiddenTag = unique(filter.hiddenTag);
  if (filter.notTag.length > 0) result.notTag = unique(filter.notTag);
  if (filter.size.length > 0) result.size = unique(filter.size);
  if (filter.tier.length > 0) result.tier = unique(filter.tier);
  if (filter.heroes.length > 0) result.heroes = unique(filter.heroes);
  if (filter.enchantmentOnly) result.enchantmentOnly = true;
  if (filter.cardTypes.length > 0) result.cardTypes = unique(filter.cardTypes);
  return Object.keys(result).length > 0 ? result : undefined;
}

export function deriveMerchants(cards: GameCard[], translate: TranslationLookup): DerivedMerchant[] {
  const groups = new Map<string, GameCard[]>();
  for (const card of cards) {
    if (card.Type !== "EventEncounter") continue;
    if (!asArray(card.Tags).map(stringValue).includes("Merchant")) continue;
    if (isDebugCard(card)) continue;
    if (stringValue(card.SpawningEligibility) === "Never") continue;
    const title = cardTitle(card);
    const list = groups.get(title) ?? [];
    list.push(card);
    groups.set(title, list);
  }

  const merchants: DerivedMerchant[] = [];
  for (const [title, encounters] of groups) {
    const nonTutorial = encounters.filter((encounter) => !isTutorialCard(encounter));
    const pool = nonTutorial.length > 0 ? nonTutorial : encounters;
    const primary =
      pool.find((encounter) => stringValue(encounter.SpawningEligibility) === "Always") ?? pool[0];

    const constraintNodes: Record<string, unknown>[] = [];
    findSpawnFilters(primary.SelectionContext, constraintNodes);
    const filter = emptyMerchantFilter();
    for (const constraint of constraintNodes) mergeConstraint(constraint, filter);

    if (filter.cardTypes.length > 0 && !filter.cardTypes.includes("Item")) continue;

    const encounterHeroes = asArray(primary.Heroes).map(stringValue).filter((hero): hero is string => Boolean(hero));
    const heroConstraint = filter.heroes.filter((hero) => hero.toLowerCase() !== "common");
    const isHeroMerchant =
      heroConstraint.length === 1 &&
      !encounterHeroes.some((hero) => hero.toLowerCase() === heroConstraint[0].toLowerCase());

    const nameZh = translate(stringValue(record(record(primary.Localization).Title).Key), title) ?? title;
    merchants.push({
      id: stringValue(primary.Id) ?? title,
      name: title,
      nameZh,
      ...(isHeroMerchant ? { isHeroMerchant: true } : {}),
      heroes: encounterHeroes,
      ...(compactFilter(filter) ? { filters: compactFilter(filter) } : {})
    });
  }

  return merchants.sort((a, b) => a.name.localeCompare(b.name));
}

export function buildTags(cards: GameCard[]): Record<string, string[]> {
  const visible = new Set<string>();
  const hidden = new Set<string>();
  const mechanic = new Set<string>(["Common", "Item", "Skill", "Small", "Medium", "Large"]);
  const heroes = new Set<string>();

  for (const card of cards) {
    if (!isItemOrSkill(card) || isDebugCard(card)) continue;
    for (const tag of asArray(card.Tags).map(stringValue)) if (tag) visible.add(tag);
    for (const tag of asArray(card.HiddenTags).map(stringValue)) if (tag) hidden.add(tag);
    for (const hero of asArray(card.Heroes).map(stringValue)) if (hero) heroes.add(hero);
  }
  heroes.forEach((hero) => mechanic.add(hero));

  const all = new Set([...visible, ...hidden, ...mechanic]);
  return {
    visible_tags: [...visible].sort(),
    hidden_tags: [...hidden].sort(),
    mechanic_tags: [...mechanic].sort(),
    all_tags: [...all].sort()
  };
}

export function buildHeroes(cards: GameCard[]): Record<string, unknown> {
  const cardIdsByHero = new Map<string, string[]>();
  for (const card of cards) {
    if (!isItemOrSkill(card) || isDebugCard(card)) continue;
    const id = stringValue(card.Id) ?? "";
    for (const hero of asArray(card.Heroes).map(stringValue)) {
      if (!hero) continue;
      cardIdsByHero.set(hero, [...(cardIdsByHero.get(hero) ?? []), id]);
    }
  }

  const order = ["Common", "Vanessa", "Pygmalien", "Dooley", "Mak", "Stelle", "Jules", "Karnok", "Hero8"];
  const names = [...new Set([...order, ...cardIdsByHero.keys()])];
  return {
    heroes: names.map((hero) => ({
      hero,
      card_count: cardIdsByHero.get(hero)?.length ?? 0,
      card_ids: cardIdsByHero.get(hero) ?? []
    }))
  };
}

export function buildEnchantmentIndex(cards: GameCard[]): Record<string, unknown> {
  const cardIdsByName = new Map<string, string[]>();
  for (const card of cards) {
    if (!isItemOrSkill(card) || isDebugCard(card)) continue;
    const id = stringValue(card.Id) ?? "";
    for (const name of Object.keys(record(card.Enchantments))) {
      cardIdsByName.set(name, [...(cardIdsByName.get(name) ?? []), id]);
    }
  }

  return {
    enchantments: [...cardIdsByName.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, cardIds]) => ({ enchantment: name, card_count: cardIds.length, card_ids: cardIds }))
  };
}

export type ImageManifestEntry = {
  card_id: string;
  title: string;
  type: string;
  status: "reused" | "extractable" | "missing";
  source: "existing" | "unity-card" | "unity-skill-icon" | "none";
  image_url: string | null;
  local_image_path: string | null;
  art_key: string;
  bundle?: string;
  asset?: string;
  texture?: string;
};

export function buildImageManifest(
  cards: GameCard[],
  artIndex: ArtIndex,
  existingImageIds: Set<string>
): ImageManifestEntry[] {
  return cards
    .filter((card) => isItemOrSkill(card) && !isDebugCard(card))
    .map((card) => {
      const id = stringValue(card.Id) ?? "";
      const art = artIndex[id];
      const reused = existingImageIds.has(id);
      const status: ImageManifestEntry["status"] = reused ? "reused" : art ? "extractable" : "missing";
      const source: ImageManifestEntry["source"] = reused ? "existing" : art?.source ?? "none";
      const imageUrl = reused || art ? `/images/cards/${id}.webp` : null;
      return {
        card_id: id,
        title: cardTitle(card),
        type: stringValue(card.Type) ?? "",
        status,
        source,
        image_url: imageUrl,
        local_image_path: imageUrl ? `data/images/cards/${id}.webp` : null,
        art_key: stringValue(card.ArtKey) ?? "",
        ...(art?.bundle ? { bundle: art.bundle } : {}),
        ...(art?.asset ? { asset: art.asset } : {}),
        ...(art?.texture ? { texture: art.texture } : {})
      } satisfies ImageManifestEntry;
    })
    .sort((a, b) => a.card_id.localeCompare(b.card_id));
}
