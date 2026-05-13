import type { ActionNode, SemanticEffectDocument, SemanticWarning } from "./semanticEffects";
import type { StructuredEffect } from "./types";

export type ProjectionStatus = NonNullable<StructuredEffect["projectionStatus"]>;

export type ProjectionAudit = {
  status: ProjectionStatus;
  unsupportedCount: number;
  warnings: string[];
  warningCodes: string[];
  reasons: string[];
};

export type StructuredUnknownToken = {
  path: string;
  value: string;
};

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

export function countUnknownActions(node: ActionNode): number {
  if (node.node === "atomic") return node.action.type === "unknown" ? 1 : 0;
  if (node.node === "parallel" || node.node === "sequence") {
    return node.actions.reduce((sum, child) => sum + countUnknownActions(child), 0);
  }
  return [...node.then, ...(node.else ?? [])].reduce((sum, child) => sum + countUnknownActions(child), 0);
}

export function semanticUnknownActionCount(document: SemanticEffectDocument | undefined): number {
  return document?.clauses.reduce((sum, clause) => sum + clause.actions.reduce((inner, node) => inner + countUnknownActions(node), 0), 0) ?? 0;
}

export function semanticWarningCodes(document: SemanticEffectDocument | undefined): string[] {
  return uniqueSorted(document?.warnings.map((warning) => warning.code) ?? []);
}

export function semanticWarningMessages(document: SemanticEffectDocument | undefined): string[] {
  return uniqueSorted(document?.warnings.map((warning) => warning.message) ?? []);
}

export function semanticUnsupportedReasons(document: SemanticEffectDocument | undefined): string[] {
  if (!document) return ["missing semantic document"];
  const reasons = new Set<string>();
  document.clauses.forEach((clause) => {
    clause.actions.forEach((node) => {
      if (node.node === "atomic" && node.action.type === "unknown") {
        reasons.add(`unknown semantic action: ${node.action.rawText}`);
      }
    });
    clause.warnings?.forEach((warning) => {
      if (warning.code === "UNSUPPORTED_PROJECTION" || warning.code === "UNSUPPORTED_SEMANTIC_PARSE") {
        reasons.add(warning.message);
      }
    });
  });
  return [...reasons].sort();
}

export function structuredUnknownTokens(effect: StructuredEffect): StructuredUnknownToken[] {
  const tokens: StructuredUnknownToken[] = [];

  function visit(value: unknown, path: string): void {
    if (value == null) return;
    if (typeof value === "string") {
      if (value === "Unknown" || value === "unknown" || value.endsWith("Unknown") || value.includes("TConditionUnknown")) {
        tokens.push({ path, value });
      }
      return;
    }
    if (typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}[${index}]`));
      return;
    }
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => visit(entry, path ? `${path}.${key}` : key));
  }

  visit(effect, "");
  return tokens;
}

export function structuredUnknownTokenCount(effects: StructuredEffect[]): number {
  return effects.reduce((sum, effect) => sum + structuredUnknownTokens(effect).length, 0);
}

export function structuredUnsupportedReasons(effect: StructuredEffect): string[] {
  const reasons: string[] = [];
  if (effect.action.$type === "TActionUnknown" || effect.action.SourceAction === "unknown") reasons.push("unknown action");
  if (effect.trigger?.$type === "TTriggerUnknown" || effect.trigger?.SourceEvent === "unknown") reasons.push("unknown trigger");
  if (effect.action.Target?.$type === "TTargetUnknown") reasons.push("unknown action target");
  if (effect.trigger?.Subject?.$type === "TTargetUnknown") reasons.push("unknown trigger subject");
  if (effect.trigger?.Target?.$type === "TTargetUnknown") reasons.push("unknown trigger target");
  structuredUnknownTokens(effect).forEach((token) => reasons.push(`unknown token ${token.path}: ${token.value}`));
  if (effect.projectionStatus === "unsupported") reasons.push(...(effect.projectionWarnings ?? ["unsupported projection"]));
  return uniqueSorted(reasons);
}

export function projectionAudit(structuredEffects: StructuredEffect[], document?: SemanticEffectDocument): ProjectionAudit {
  const statuses = structuredEffects.map((effect) => effect.projectionStatus ?? "partial");
  const warnings = uniqueSorted([
    ...(document?.projection?.warnings ?? []),
    ...(document?.warnings.map((warning) => warning.message) ?? []),
    ...structuredEffects.flatMap((effect) => effect.projectionWarnings ?? [])
  ]);
  const warningCodes = semanticWarningCodes(document);
  const structuredReasons = structuredEffects.flatMap(structuredUnsupportedReasons);
  const semanticReasons = semanticUnsupportedReasons(document).filter((reason) => reason !== "missing semantic document");
  const reasons = uniqueSorted([
    ...structuredReasons,
    ...semanticReasons,
    ...warnings,
    ...statuses.flatMap((status) => (status === "partial" ? ["partial projection"] : status === "lossy" ? ["lossy projection"] : []))
  ]);
  const unsupportedCount = statuses.filter((status) => status === "unsupported").length;
  const hasUnsupported = unsupportedCount > 0;
  const hasLossy = statuses.includes("lossy") || warningCodes.length > 0;
  const hasPartial = statuses.includes("partial");
  const status: ProjectionStatus =
    structuredEffects.length === 0
      ? "exact"
      : hasUnsupported && unsupportedCount === structuredEffects.length
        ? "unsupported"
        : hasUnsupported
          ? "partial"
          : hasLossy
            ? "lossy"
            : hasPartial
              ? "partial"
              : "exact";

  return {
    status,
    unsupportedCount,
    warnings,
    warningCodes,
    reasons
  };
}

export function projectionStatusFromEffects(structuredEffects: StructuredEffect[], document?: SemanticEffectDocument): ProjectionStatus {
  return projectionAudit(structuredEffects, document).status;
}

export function warningDetails(warnings: SemanticWarning[] | undefined): Array<Pick<SemanticWarning, "code" | "severity" | "message"> & { evidence?: SemanticWarning["evidence"] }> {
  return (warnings ?? []).map(({ code, severity, message, evidence }) => ({
    code,
    severity,
    message,
    ...(evidence ? { evidence } : {})
  }));
}
