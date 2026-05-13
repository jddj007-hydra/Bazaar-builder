import type { EffectActionType, EffectCondition, EffectEvent, EffectTargetScope, ItemSize } from "./types";

export type ParsedEffectTarget = {
  scope: EffectTargetScope;
  tag?: string;
  size?: ItemSize;
};

export type ParsedEffect = {
  trigger: {
    event: EffectEvent;
    tag?: string;
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
