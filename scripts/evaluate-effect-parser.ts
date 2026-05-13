import fs from "node:fs";
import path from "node:path";
import {
  loadRawData,
  normalizeAll,
  projectSemanticDocumentToStructuredEffects,
  structuredEffectFacets,
  structuredEffectHasUnknown
} from "../src/lib/bazaar-data";
import type { ActionNode, EnchantmentDef, ItemDef, SemanticEffectDocument, SkillDef, StructuredEffect } from "../src/lib/bazaar-data";

type CorpusEntity = ItemDef | SkillDef | EnchantmentDef;

type CorpusEntry = {
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

function countUnknownActions(node: ActionNode): number {
  if (node.node === "atomic") return node.action.type === "unknown" ? 1 : 0;
  if (node.node === "parallel" || node.node === "sequence") {
    return node.actions.reduce((sum, child) => sum + countUnknownActions(child), 0);
  }
  return [...node.then, ...(node.else ?? [])].reduce((sum, child) => sum + countUnknownActions(child), 0);
}

function semanticUnknownActionCount(document: SemanticEffectDocument | undefined): number {
  return document?.clauses.reduce((sum, clause) => sum + clause.actions.reduce((inner, node) => inner + countUnknownActions(node), 0), 0) ?? 0;
}

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

function structuredUnsupportedReason(effect: StructuredEffect): string | null {
  if (effect.action.$type === "TActionUnknown" || effect.action.SourceAction === "unknown") return "unknown action";
  if (effect.trigger?.$type === "TTriggerUnknown" || effect.trigger?.SourceEvent === "unknown") return "unknown trigger";
  if (effect.action.Target?.$type === "TTargetUnknown" || effect.trigger?.Subject?.$type === "TTargetUnknown") return "unknown target";
  if (effect.projectionStatus === "unsupported") return effect.projectionWarnings?.[0] ?? "unsupported projection";
  return null;
}

function semanticUnsupportedReason(document: SemanticEffectDocument | undefined): string[] {
  if (!document) return ["missing semantic document"];
  const reasons = new Set<string>();
  document.clauses.forEach((clause) => {
    clause.actions.forEach((node) => {
      if (node.node === "atomic" && node.action.type === "unknown") reasons.add("unknown semantic action");
    });
    clause.warnings?.forEach((warning) => {
      if (warning.code === "UNSUPPORTED_PROJECTION" || warning.code === "UNSUPPORTED_SEMANTIC_PARSE") reasons.add(warning.message);
    });
  });
  return [...reasons];
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

const corpusByKey = new Map(readCorpusEntries().map((entry) => [entityKey(entry.entityType ?? "", entry.entityId ?? ""), entry]));
const currentStatusCounts = new Map<string, number>();
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

for (const { entityType, entity } of entities) {
  const key = entityKey(entityType, entity.id);
  const previous = corpusByKey.get(key);
  const status = projectionStatus(entity);
  currentStatusCounts.set(status, (currentStatusCounts.get(status) ?? 0) + 1);
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
  const unsupportedProjectionEffects = projection?.structuredEffects.filter((effect) => effect.projectionStatus === "unsupported") ?? [];
  projectionUnsupportedCount += unsupportedProjectionEffects.length;

  for (const effect of entity.structuredEffects) {
    const reason = structuredUnsupportedReason(effect);
    if (reason) reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    const suspiciousReason = suspiciousEffect(effect);
    if (suspiciousReason) suspicious.push(`${key} ${entity.name}: ${suspiciousReason} :: ${effect.rawText}`);
  }
  for (const reason of semanticUnsupportedReason(entity.semanticEffects)) {
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
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
console.log(`Structured effects: ${totalStructuredEffects}`);
console.log(`Parsed structured effects: ${totalStructuredEffects - structuredUnknownCount}`);
console.log(`Structured unknown effects: ${structuredUnknownCount}`);
console.log(`Semantic clauses: ${semanticClauseCount}`);
console.log(`Semantic unknown actions: ${semanticUnknownCount}`);
console.log(`Unsupported projected semantic effects: ${projectionUnsupportedCount}`);
printCounts("Current projectionStatus distribution", currentStatusCounts);
printCounts("Baseline corpus projectionStatus distribution", previousStatusCounts);
printCounts("Unsupported / suspicious reason counts", reasonCounts);

console.log(`\nNewly parsed vs corpus baseline: ${newlyParsed.length}`);
newlyParsed.slice(0, 30).forEach((entry) => console.log(`  ${entry}`));
console.log(`Changed parse status vs corpus baseline: ${changedParsed.length}`);
changedParsed.slice(0, 30).forEach((entry) => console.log(`  ${entry}`));
console.log(`Suspicious parse results: ${suspicious.length}`);
suspicious.slice(0, 30).forEach((entry) => console.log(`  ${entry}`));
