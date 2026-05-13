import fs from "node:fs";
import path from "node:path";
import {
  loadRawData,
  normalizeAll,
  projectionAudit,
  projectSemanticDocumentToStructuredEffects,
  structuredEffectFacets,
  structuredEffectHasUnknown,
  structuredUnknownTokenCount,
  structuredUnsupportedReasons,
  semanticUnknownActionCount,
  semanticUnsupportedReasons
} from "../src/lib/bazaar-data";
import type { EffectCorpusEntry, EnchantmentDef, ItemDef, SkillDef, StructuredEffect } from "../src/lib/bazaar-data";

type CorpusEntity = ItemDef | SkillDef | EnchantmentDef;

type CorpusEntry = Partial<EffectCorpusEntry> & {
  corpusId?: string;
  entityType?: string;
  entityId?: string;
  nameEn?: string;
  rawTextEn?: string;
  currentParse?: {
    structuredEffectCount?: number;
    structuredUnknownCount?: number;
    semanticClauseCount?: number;
    semanticUnknownActionCount?: number;
    projectionStatus?: "exact" | "partial" | "lossy" | "unsupported";
    projectionUnsupportedCount?: number;
  };
  structuredEffects?: StructuredEffect[];
};

const corpusPath = path.resolve(process.cwd(), "docs/effect-rawtext-corpus.jsonl");

function readCorpusEntries(): CorpusEntry[] {
  if (!fs.existsSync(corpusPath)) return [];
  return fs
    .readFileSync(corpusPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CorpusEntry);
}

function entityKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

function projectionStatus(entity: CorpusEntity): "exact" | "partial" | "lossy" | "unsupported" {
  if (!entity.semanticEffects) return "unsupported";
  return projectSemanticDocumentToStructuredEffects(entity.semanticEffects).status;
}

function suspiciousEffect(effect: StructuredEffect): string | null {
  const facets = structuredEffectFacets(effect);
  if (effect.action.$type !== "TActionBoardSlotSetTerrain" && /slots? becomes/i.test(effect.rawText)) {
    return "slot terrain text did not become TActionBoardSlotSetTerrain";
  }
  if (effect.action.$type !== "TActionEffectModify" && /effects? are reduced by half/i.test(effect.rawText)) {
    return "effect modifier text did not become TActionEffectModify";
  }
  if (/first time\b.*each fight/i.test(effect.rawText) && !facets.hasTriggerLimit) {
    return "first-time-each-fight text has no trigger limit";
  }
  if (/joined the/i.test(effect.rawText) && effect.action.$type !== "TActionPlayerModifyState") {
    return "player faction text did not become TActionPlayerModifyState";
  }
  if (/gains? \d+ bonus/i.test(effect.rawText) && effect.action.$type !== "TActionVariableModify") {
    return "bonus text did not become TActionVariableModify";
  }
  return null;
}

const raw = loadRawData();
const normalized = normalizeAll(raw);
const entities: Array<{ entityType: "item" | "skill" | "enchantment"; entity: CorpusEntity }> = [
  ...normalized.items.map((entity) => ({ entityType: "item" as const, entity })),
  ...normalized.skills.map((entity) => ({ entityType: "skill" as const, entity })),
  ...normalized.enchantments.map((entity) => ({ entityType: "enchantment" as const, entity }))
];
const corpusEntities = entities.filter(({ entity }) => (entity.semanticEffects?.rawText ?? "").trim().length > 0);

const corpusByKey = new Map(readCorpusEntries().map((entry) => [entityKey(entry.entityType ?? "", entry.entityId ?? ""), entry]));
const currentStatusCounts = new Map<string, number>();
const currentCorpusStatusCounts = new Map<string, number>();
const previousStatusCounts = new Map<string, number>();
const reasonCounts = new Map<string, number>();
const newlyParsed: string[] = [];
const changedParsed: string[] = [];
const suspicious: string[] = [];

let totalStructuredEffects = 0;
let structuredUnknownCount = 0;
let semanticClauseCount = 0;
let semanticUnknownCount = 0;
let projectionUnsupportedCount = 0;
let structuredUnknownTokenTotal = 0;

for (const { entityType, entity } of entities) {
  const key = entityKey(entityType, entity.id);
  const previous = corpusByKey.get(key);
  const status = projectionStatus(entity);
  currentStatusCounts.set(status, (currentStatusCounts.get(status) ?? 0) + 1);
  if ((entity.semanticEffects?.rawText ?? "").trim().length > 0) {
    currentCorpusStatusCounts.set(status, (currentCorpusStatusCounts.get(status) ?? 0) + 1);
  }
  if (previous?.currentParse?.projectionStatus) {
    previousStatusCounts.set(previous.currentParse.projectionStatus, (previousStatusCounts.get(previous.currentParse.projectionStatus) ?? 0) + 1);
    if (previous.currentParse.projectionStatus !== status) {
      changedParsed.push(`${key} ${entity.name}: ${previous.currentParse.projectionStatus} -> ${status}`);
    }
    if (previous.currentParse.projectionStatus === "unsupported" && status !== "unsupported") {
      newlyParsed.push(`${key} ${entity.name}: ${status}`);
    }
  }

  totalStructuredEffects += entity.structuredEffects.length;
  const entityStructuredUnknowns = entity.structuredEffects.filter(structuredEffectHasUnknown).length;
  structuredUnknownCount += entityStructuredUnknowns;
  semanticClauseCount += entity.semanticEffects?.clauses.length ?? 0;
  semanticUnknownCount += semanticUnknownActionCount(entity.semanticEffects);

  const projection = entity.semanticEffects ? projectSemanticDocumentToStructuredEffects(entity.semanticEffects) : null;
  const audit = projectionAudit(projection?.structuredEffects ?? entity.structuredEffects, entity.semanticEffects);
  projectionUnsupportedCount += audit.unsupportedCount;
  structuredUnknownTokenTotal += structuredUnknownTokenCount(entity.structuredEffects);

  for (const effect of entity.structuredEffects) {
    for (const reason of structuredUnsupportedReasons(effect)) {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
    const suspiciousReason = suspiciousEffect(effect);
    if (suspiciousReason) suspicious.push(`${key} ${entity.name}: ${suspiciousReason} :: ${effect.rawText}`);
  }
  for (const reason of semanticUnsupportedReasons(entity.semanticEffects)) {
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }
  for (const reason of audit.reasons) {
    if (/unknown|unsupported|lossy|partial/.test(reason)) reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }
}

function printCounts(title: string, counts: Map<string, number>): void {
  console.log(`\n${title}`);
  [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .forEach(([key, count]) => console.log(`  ${key}: ${count}`));
}

console.log("Effect parser evaluation");
console.log(`Entities: ${entities.length}`);
console.log(`Corpus-eligible entities: ${corpusEntities.length}`);
console.log(`Structured effects: ${totalStructuredEffects}`);
console.log(`Parsed structured effects: ${totalStructuredEffects - structuredUnknownCount}`);
console.log(`Structured unknown effects: ${structuredUnknownCount}`);
console.log(`Structured unknown tokens: ${structuredUnknownTokenTotal}`);
console.log(`Semantic clauses: ${semanticClauseCount}`);
console.log(`Semantic unknown actions: ${semanticUnknownCount}`);
console.log(`Unsupported projected semantic effects: ${projectionUnsupportedCount}`);
printCounts("Current projectionStatus distribution", currentStatusCounts);
printCounts("Current corpus-eligible projectionStatus distribution", currentCorpusStatusCounts);
printCounts("Baseline corpus projectionStatus distribution", previousStatusCounts);
printCounts("Unsupported / suspicious reason counts", reasonCounts);

console.log(`\nNewly parsed vs corpus baseline: ${newlyParsed.length}`);
newlyParsed.slice(0, 30).forEach((entry) => console.log(`  ${entry}`));
console.log(`Changed parse status vs corpus baseline: ${changedParsed.length}`);
changedParsed.slice(0, 30).forEach((entry) => console.log(`  ${entry}`));
console.log(`Suspicious parse results: ${suspicious.length}`);
suspicious.slice(0, 30).forEach((entry) => console.log(`  ${entry}`));
