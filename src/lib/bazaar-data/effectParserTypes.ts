import type {
  EffectActionType,
  EffectCondition,
  EffectEvent,
  EffectTargetScope,
  ItemSize,
  StructuredAttributeType,
  StructuredEffectPredicate,
  StructuredTriggerLimit,
  StructuredValue
} from "./types";

export type ParsedEffectTarget = {
  scope: EffectTargetScope;
  tag?: string;
  size?: ItemSize;
  excludeSelf?: boolean;
};

export type ParsedEffect = {
  trigger: {
    event: EffectEvent;
    tag?: string;
    limit?: StructuredTriggerLimit;
    targetMode?: "Self" | "Opponent" | "Both";
    effectPredicate?: StructuredEffectPredicate;
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
