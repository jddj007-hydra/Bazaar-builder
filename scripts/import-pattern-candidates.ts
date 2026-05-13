import fs from "node:fs";
import path from "node:path";
import { loadRawData, normalizeAll } from "../src/lib/bazaar-data";
import type { StructuredActionType, StructuredAttributeType, StructuredTriggerType } from "../src/lib/bazaar-data";

type CandidateVariableType =
  | "Number"
  | "SignedNumber"
  | "Fraction"
  | "Duration"
  | "CardStat"
  | "Status"
  | "StatusPastTense"
  | "EffectFamily"
  | "CardFilter"
  | "TagExpr"
  | "Target"
  | "SlotTerrain"
  | "PlayerState"
  | "Faction"
  | "TriggerLimit"
  | "ActionClause";

type PatternCandidate = {
  id?: unknown;
  pattern?: unknown;
  variables?: unknown;
  semantics?: unknown;
  examples?: unknown;
  notes?: unknown;
};

type ReviewEntry = {
  id: string;
  pattern: string;
  status: "ready_for_review" | "rejected";
  reasons: string[];
  variables: Array<{ name: string; type: CandidateVariableType }>;
  examples: string[];
  semantics: unknown;
  notes?: string;
};

const allowedVariableTypes = new Set<CandidateVariableType>([
  "Number",
  "SignedNumber",
  "Fraction",
  "Duration",
  "CardStat",
  "Status",
  "StatusPastTense",
  "EffectFamily",
  "CardFilter",
  "TagExpr",
  "Target",
  "SlotTerrain",
  "PlayerState",
  "Faction",
  "TriggerLimit",
  "ActionClause"
]);
const allowedActionTypes = new Set<StructuredActionType>([
  "TActionPlayerDamage",
  "TActionPlayerShieldApply",
  "TActionPlayerHeal",
  "TActionPlayerRegenApply",
  "TActionPlayerBurnApply",
  "TActionPlayerPoisonApply",
  "TActionCardHaste",
  "TActionCardSlow",
  "TActionCardFreeze",
  "TActionCardCharge",
  "TActionCardModifyAttribute",
  "TActionPlayerModifyAttribute",
  "TActionGameSpawnCards",
  "TActionCardAddTagsList",
  "TActionCardReload",
  "TActionCardRepair",
  "TActionCardTransform",
  "TActionCardEnchant",
  "TActionCardUpgrade",
  "TActionCardForceUse",
  "TActionCardDestroy",
  "TActionCardRedirect",
  "TActionCardBeginSandstorm",
  "TActionCardCleanse",
  "TActionBoardSlotSetTerrain",
  "TActionEffectModify",
  "TActionStatusDurationModify",
  "TActionStatusModify",
  "TActionPlayerModifyState",
  "TActionVariableModify",
  "TActionPlayerPreventDamage",
  "TActionUnknown"
]);
const allowedTriggerTypes = new Set<StructuredTriggerType>([
  "TTriggerAlways",
  "TTriggerOnCardFired",
  "TTriggerOnFightStarted",
  "TTriggerOnItemUsed",
  "TTriggerOnCardPerformedShield",
  "TTriggerOnCardPerformedHeal",
  "TTriggerOnCardPerformedBurn",
  "TTriggerOnCardPerformedPoison",
  "TTriggerOnCardPerformedDamage",
  "TTriggerOnEnemyDamaged",
  "TTriggerOnEnemyHealed",
  "TTriggerOnEnemyShielded",
  "TTriggerOnCardPurchased",
  "TTriggerOnCardSold",
  "TTriggerOnCardUpgraded",
  "TTriggerOnCardTransformed",
  "TTriggerOnFightEnded",
  "TTriggerOnCombatWon",
  "TTriggerOnCombatLost",
  "TTriggerOnCardAmmoEmpty",
  "TTriggerOnCardDestroyed",
  "TTriggerOnMerchantVisited",
  "TTriggerOnCardCritted",
  "TTriggerOnEnrage",
  "TTriggerOnPlayerAttributeThresholdCrossed",
  "TTriggerOnConditionMet",
  "TTriggerUnknown"
]);
const allowedAttributes = new Set<StructuredAttributeType>([
  "Ammo",
  "AmmoMax",
  "Burn",
  "BurnApplyAmount",
  "BuyPrice",
  "ChargeAmount",
  "CooldownMax",
  "CritChance",
  "CritDamage",
  "DamageAmount",
  "FreezeAmount",
  "Gold",
  "HasteAmount",
  "HealAmount",
  "Health",
  "HealthMax",
  "Income",
  "Experience",
  "Lifesteal",
  "Multicast",
  "Poison",
  "PoisonApplyAmount",
  "Prestige",
  "Rage",
  "RageRequirement",
  "RegenApplyAmount",
  "ReloadAmount",
  "RerollCost",
  "SellPrice",
  "Shield",
  "ShieldApplyAmount",
  "SlowAmount",
  "Value",
  "EffectMagnitude",
  "EffectDuration",
  "EffectValue",
  "EffectTrigger",
  "Unknown"
]);

const inputPath = path.resolve(process.cwd(), process.argv[2] ?? "docs/effect-pattern-candidates.jsonl");
const outputPath = path.resolve(process.cwd(), process.argv[3] ?? "docs/effect-pattern-review-queue.json");
const raw = loadRawData();
const normalized = normalizeAll(raw);
const ontology = {
  tags: new Set(normalized.tags.flatMap((tag) => [tag.name.toLowerCase(), tag.slug.toLowerCase()])),
  statuses: new Set(["heated", "chilled", "frozen", "slowed", "hasted", "enraged", "flying"]),
  terrains: new Set(["stove", "cooler"]),
  factions: new Set(["cult"]),
  effectFamilies: new Set(["charge", "haste", "slow", "freeze", "burn", "poison", "shield", "heal", "regen", "damage"])
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function validateVariables(value: unknown, reasons: string[]): Array<{ name: string; type: CandidateVariableType }> {
  if (!Array.isArray(value)) {
    reasons.push("variables must be an array");
    return [];
  }
  return value.flatMap((entry, index) => {
    const record = asRecord(entry);
    const name = typeof record.name === "string" ? record.name : "";
    const type = typeof record.type === "string" ? record.type : "";
    if (!name) reasons.push(`variables[${index}].name is required`);
    if (!allowedVariableTypes.has(type as CandidateVariableType)) reasons.push(`variables[${index}].type '${type}' is not a supported parser fragment`);
    return name && allowedVariableTypes.has(type as CandidateVariableType) ? [{ name, type: type as CandidateVariableType }] : [];
  });
}

function validateSemantics(value: unknown, reasons: string[]): void {
  const semantics = asRecord(value);
  const actionType = semantics.actionType;
  const triggerType = semantics.triggerType;
  const attributeType = semantics.attributeType;
  if (!Object.keys(semantics).length) {
    reasons.push("semantics object is required");
    return;
  }
  if (typeof actionType === "string" && !allowedActionTypes.has(actionType as StructuredActionType)) {
    reasons.push(`semantics.actionType '${actionType}' is not in StructuredActionType`);
  }
  if (typeof triggerType === "string" && !allowedTriggerTypes.has(triggerType as StructuredTriggerType)) {
    reasons.push(`semantics.triggerType '${triggerType}' is not in StructuredTriggerType`);
  }
  if (typeof attributeType === "string" && !allowedAttributes.has(attributeType as StructuredAttributeType)) {
    reasons.push(`semantics.attributeType '${attributeType}' is not in StructuredAttributeType`);
  }
  for (const tag of stringArray(semantics.tags)) {
    if (!ontology.tags.has(tag.toLowerCase())) reasons.push(`unknown tag '${tag}'`);
  }
  for (const status of stringArray(semantics.statuses)) {
    if (!ontology.statuses.has(status.toLowerCase())) reasons.push(`unknown status '${status}'`);
  }
  for (const terrain of stringArray(semantics.terrains)) {
    if (!ontology.terrains.has(terrain.toLowerCase())) reasons.push(`unknown terrain '${terrain}'`);
  }
  for (const faction of stringArray(semantics.factions)) {
    if (!ontology.factions.has(faction.toLowerCase())) reasons.push(`unknown faction '${faction}'`);
  }
  for (const family of stringArray(semantics.effectFamilies)) {
    if (!ontology.effectFamilies.has(family.toLowerCase())) reasons.push(`unknown effect family '${family}'`);
  }
}

function parseLine(line: string, index: number): ReviewEntry {
  const reasons: string[] = [];
  let candidate: PatternCandidate = {};
  try {
    candidate = JSON.parse(line) as PatternCandidate;
  } catch (error) {
    return {
      id: `line-${index + 1}`,
      pattern: "",
      status: "rejected",
      reasons: [`invalid JSON: ${error instanceof Error ? error.message : String(error)}`],
      variables: [],
      examples: [],
      semantics: null
    };
  }

  const id = typeof candidate.id === "string" && candidate.id ? candidate.id : `line-${index + 1}`;
  const pattern = typeof candidate.pattern === "string" ? candidate.pattern.trim() : "";
  if (!pattern) reasons.push("pattern is required");
  if (!/\{[a-zA-Z_][\w-]*:[A-Za-z]+\}/.test(pattern)) {
    reasons.push("pattern should contain typed placeholders such as {amount:Number}");
  }
  const variables = validateVariables(candidate.variables, reasons);
  validateSemantics(candidate.semantics, reasons);

  return {
    id,
    pattern,
    status: reasons.length === 0 ? "ready_for_review" : "rejected",
    reasons,
    variables,
    examples: stringArray(candidate.examples).slice(0, 10),
    semantics: candidate.semantics ?? null,
    ...(typeof candidate.notes === "string" ? { notes: candidate.notes } : {})
  };
}

const lines = fs.existsSync(inputPath)
  ? fs.readFileSync(inputPath, "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  : [];
const reviewQueue = lines.map(parseLine);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      schemaVersion: "effect-pattern-review-queue/v1",
      source: inputPath,
      generatedAt: new Date().toISOString(),
      counts: {
        total: reviewQueue.length,
        readyForReview: reviewQueue.filter((entry) => entry.status === "ready_for_review").length,
        rejected: reviewQueue.filter((entry) => entry.status === "rejected").length
      },
      entries: reviewQueue
    },
    null,
    2
  )}\n`
);

console.log(`Read ${lines.length} candidate pattern(s) from ${inputPath}`);
console.log(`Wrote review queue to ${outputPath}`);
console.log(`Ready for review: ${reviewQueue.filter((entry) => entry.status === "ready_for_review").length}`);
console.log(`Rejected: ${reviewQueue.filter((entry) => entry.status === "rejected").length}`);
