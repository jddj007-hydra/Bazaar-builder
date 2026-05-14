import type {
  EffectActionType,
  EffectCondition,
  EffectEvent,
  EffectTargetScope,
  ItemSize,
  StructuredCondition,
  StructuredAttributeType,
  StructuredEffectPredicate,
  StructuredTriggerLimit,
  StructuredValue
} from "./types";

export type ParsedEffectTarget = {
  scope: EffectTargetScope;
  tag?: string;
  size?: ItemSize;
  conditions?: StructuredCondition[];
  excludeSelf?: boolean;
  preferRandom?: boolean;
  sortAttribute?: StructuredAttributeType;
};

export type ParsedEffect = {
  trigger: {
    event: EffectEvent;
    tag?: string;
    limit?: StructuredTriggerLimit;
    targetMode?: "Self" | "Opponent" | "Both";
    effectPredicate?: StructuredEffectPredicate;
    status?: string;
    attributeType?: StructuredAttributeType;
    threshold?: StructuredValue;
    crossing?: "FromAtOrAboveToBelow" | "FromAtOrBelowToAbove" | "Above" | "Below";
    changeDirection?: "Gained" | "Lost" | "Changed";
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
