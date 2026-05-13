import type { EffectActionType, EffectCondition, EffectEvent, EffectTargetScope, ItemSize, StructuredAttributeType, StructuredTriggerLimit, StructuredValue } from "./types";

export type ParsedEffectTarget = {
  scope: EffectTargetScope;
  tag?: string;
  size?: ItemSize;
};

export type ParsedEffect = {
  trigger: {
    event: EffectEvent;
    tag?: string;
    limit?: StructuredTriggerLimit;
    attributeType?: StructuredAttributeType;
    threshold?: StructuredValue;
    crossing?: "FromAtOrAboveToBelow" | "FromAtOrBelowToAbove" | "Above" | "Below";
  };
  action: {
    type: EffectActionType;
    value?: number;
    stat?: string;
    tag?: string;
  };
  target?: ParsedEffectTarget;
  triggerTarget?: ParsedEffectTarget;
  conditions?: EffectCondition[];
  rawText?: string;
};
