# Effect Parser / IR Audit

Generated: 2026-05-14

This audit covers the current TypeScript effect parser, legacy `StructuredEffect` IR, newer `SemanticEffectDocument` IR, unsupported reporting, and the 10 high-priority unsupported tooltip patterns.

## Relevant Files

- IR types: `src/lib/bazaar-data/types.ts`, `src/lib/bazaar-data/semanticEffects.ts`, `src/lib/bazaar-data/effectParserTypes.ts`
- Legacy parser entry and rules: `src/lib/bazaar-data/parseEffects.ts`
- Legacy projection helpers: `src/lib/bazaar-data/structuredEffects.ts`
- Semantic parser and projection: `src/lib/bazaar-data/semanticEffects.ts`
- Raw / normalized tooltip source: `src/lib/bazaar-data/cardRecord.ts`, `src/lib/bazaar-data/normalizeItems.ts`, `src/lib/bazaar-data/normalizeSkills.ts`, `src/lib/bazaar-data/normalizeEnchantments.ts`
- Unsupported / audit export: `scripts/export-effect-parse-audit.ts`, `scripts/export-effect-rawtext-corpus.ts`
- Tests: `src/lib/bazaar-data/bazaar-data.test.ts`
- Reports / corpus: `docs/unknown-unsupported-report.md`, `docs/effect-text-parse-audit.md`, `docs/effect-rawtext-corpus.jsonl`

No runtime schema validator was found. Current validation is mainly TypeScript unions plus Vitest assertions.

## Current Parser Architecture

There are two parser layers.

The legacy parser in `parseEffects.ts` is a regex/rule parser. It parses each tooltip text into `ParsedEffect`, using helper steps such as `splitLead`, `splitCompoundAssignment`, `splitCompoundActions`, `inferTrigger`, `inferAction`, `inferTarget`, and `inferConditions`. `structuredEffects.ts` then maps `ParsedEffect` to `StructuredEffect`.

The semantic parser in `semanticEffects.ts` is a wider semantic IR pipeline. It supports `BoolExpr`, `EntitySelector`, `ValueExpr`, variables, effect selectors, slot modification, effect modification, and action graphs. Its rule chain is:

1. `parseSlotTerrain`
2. `parseEffectModifier`
3. `parseWouldBeDefeated`
4. `parseCustomScope`
5. `parseFirstLimiter`
6. `parseWhileAura`
7. `parseWhenUseClause`
8. `parseSimpleClause`

Legacy unknowns come from unknown trigger/action/target values and are counted by `structuredEffectHasUnknown`. Semantic unknowns come from `{ type: "unknown" }` action nodes, while unsupported semantic projection is produced when semantic actions cannot be projected back to legacy `StructuredEffect`.

## Current IR Boundaries

Legacy `StructuredEffect` now supports:

- fixed trigger/action enum values
- card/player/effect/status-application/board-slot targets
- simple and boolean tag/size/count/attribute conditions
- fixed/fraction/range/reference/count/expression/variable values
- trigger limits with reset scope
- board slot terrain actions
- effect-template and effect-instance modifiers
- status duration modifiers
- player state / faction membership
- internal variables / effect groups
- player and card attribute threshold crossing triggers
- effect sequence completion triggers
- generated / transformed card specs through `StructuredCardSpec`, `GeneratedCards`, and `TransformInto`
- audit fields: `semanticSourceIds`, `projectionStatus`, `projectionWarnings`, `rawText`

Current precision boundaries are narrower:

- sequence-like compound semantic action graphs are flattened into multiple legacy structured effects
- incoming damage reduction is represented as an opponent damage-effect magnitude modifier with recipient binding
- destroy replacement timing is represented explicitly
- dynamic type-copy/random type is represented by `StructuredTagMutation`; unspecified enchantment type is represented by `EnchantmentSelection: "Unspecified"`; compound action graphs are represented by `StructuredActionGraphLink`; shorthand previous-action modifiers are represented with `TTargetEffect.Anchor`
- some rounding behavior is intentionally preserved as `Rounding: "Unspecified"` when the tooltip does not state it

Semantic IR covers the richer source semantics:

- `FrequencyLimiter` covers first / max-times reset behavior.
- `BoolExpr` and legacy `TagExpr` cover canonical boolean card filters.
- `modify_slot`, `modify_effect`, `modify_variable`, `ValueExpr.variable`, and `SemanticVariable` represent slot terrain, effect modifiers, and internal variables.
- threshold crossing triggers carry attribute, threshold, and crossing metadata.
- player state / faction and status duration modifiers have parser coverage.

`SourceAction` currently uses the `EffectActionType` enum. Raw action text should continue to live in `rawText`, evidence, spans, or warnings rather than being written into `SourceAction`.

## Unsupported Classification

From `docs/unknown-unsupported-report.md` and `npm run evaluate:effect-parser`:

- structured effects: 2938
- parsed structured effects: 2938
- structured unknown effects: 0
- structured unknown tokens: 0
- semantic clauses: 2763
- semantic unknown actions: 0
- unsupported projected semantic effects: 0
- suspicious parse results: 0
- projection status: exact 1524

Resolved classification:

- Parser rule gaps: resolved for the original high-priority patterns, including Enraged longer/shorter, joined Cult, first-time threshold triggers, listed applied-effect triggers, first-time single event triggers, and first-time effect sequence triggers.
- Legacy IR gaps: resolved by additive support for slot terrain, effect modifiers, trigger limits, internal variables, status duration modifiers, player state/faction, player threshold crossing, card attribute threshold crossing, and effect sequence completion.
- Boolean/tag gaps: resolved with boolean tag expressions for `NoneOf`, `AnyOf`, and related filter forms.
- Effect group / internal variable needs: represented for Augmented Defenses / Augmented Weaponry style text.
- Generated / transform item identity gaps: resolved with `StructuredCardSpec` sidecars on `GeneratedCards` and `TransformInto`; raw descriptions, count values, selector predicates, source pools, copy targets, duration hints, and name hints are preserved in structured IR.
- Manual review candidates: no current full unknowns, unsupported projections, lossy projections, or partial projections remain. Dynamic type-copy/random type tags are represented with `StructuredTagMutation`; unspecified enchantment text is represented with `EnchantmentSelection: "Unspecified"`; heal-to-health threshold text is represented with `HealthSetMode: "HealToThreshold"`; compound action graph flattening is represented with `StructuredActionGraphLink`; trigger-player and trigger-source anchored targets are represented in IR and view/facet projections. Repair-or-transform combat triggers are represented with `TTriggerOnRepairOrTransform` plus `CombatOnly`; shorthand previous-action modifiers are represented with `TTargetEffect.Anchor`; bonus reset thresholds are represented with `TVariableConditionalValue`. Incoming damage reduction recipient binding is represented on `TTargetEffect.Recipient`; destroy replacement timing/original target selection is represented with `ReplacementTrigger`, `OriginalTarget`, and `ReplacementTiming`. Unspecified rounding remains exported as an audit warning when represented by explicit `Rounding: "Unspecified"` IR, but it no longer downgrades projection status.

## Minimal IR Extension Proposal

Add only additive union members and optional fields:

- `StructuredTrigger.Limit?: StructuredTriggerLimit`
- `TTriggerOnPlayerAttributeThresholdCrossed`
- boolean `StructuredTagExpr` and `TCardConditionalTagExpr`
- board slot targets and `TActionBoardSlotSetTerrain`
- effect target and `TActionEffectModify`
- status application target and `TActionStatusDurationModify`
- player state action and identifier value
- variable modification action and variable reference value

Keep `activeIn` as `hand_only | hand_and_stash`. Fight/shop/run lifecycle belongs in trigger limits or semantic `activeIn`, not in legacy `activeIn`.

## Parser Fragment Proposal

Introduce reusable fragments:

- `parseNumber`, `parseSignedNumber`, `parseFraction`, `parseDuration`
- `parseCardStat`, `parseStatus`, `parseStatusPastTense`
- `parseEffectFamily`, `parseSlotTerrain`, `parseFaction`
- `parseCardFilter` -> selector / target and tag expression
- `parseTagExpr` -> `AnyOf`, `AllOf`, `NoneOf`, `Not`, `And`, `Or`
- `parseTriggerLimitPhrase`
- `parseActionClause`

For the first implementation loop, use these as local parser helpers before deciding whether to split them into separate files.

## 10 Target Patterns

1. `One of your slots becomes a Stove (The item here is Heated)` -> board slot terrain action, linked Heated occupant status.
2. `All Charge effects are reduced by half` -> effect modifier, Charge family, multiply magnitude by 1/2.
3. `The first time you use a non-Burn or non-Poison item each fight, Charge your Burn and Poison items 1 Charge second(s)` -> item-used trigger with trigger limit; subject `NoneOf(Burn, Poison)`; action target `AnyOf(Burn, Poison)`.
4. `One of your slots becomes a Cooler (The item here is Chilled)` -> board slot terrain action, linked Chilled occupant status.
5. `The first time you fall below half Health each fight, Haste your Burn and Regen items for 1 Haste second(s)` -> health threshold crossing trigger with first-per-fight limit; target `AnyOf(Burn, Regen)`.
6. `Your items have +1 Shield. When you sell a Small item, this gains 1 bonus` -> source-card variable, aura value is variable ref, sell trigger modifies variable.
7. `Your items have +1 Damage. When you sell a Small item, this gains 1 bonus` -> same as 6 for damage.
8. `You are Enraged for 1 second longer` -> status duration modifier.
9. `You are Enraged for 1 second shorter` -> status duration modifier.
10. `You have joined the Cult` -> player state / faction membership.

## Testing Strategy

- Focused clause tests for each new parser rule.
- Compound full-tooltip tests for the two Augmented skills.
- Regression tests for all 10 patterns in both semantic and structured output.
- Assertions must check specific semantics, not just absence of `TActionUnknown`.
- Add evaluation script output for total clauses, unknowns, unsupported projection, projection status distribution, and suspicious parses.
