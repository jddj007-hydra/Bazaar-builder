# Effect Parser / IR Audit

Generated: 2026-05-13

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

Legacy `StructuredEffect` supports:

- fixed trigger/action enum values
- card/player targets
- simple tag/size/count/attribute conditions
- fixed/range/reference/count values
- audit fields: `semanticSourceIds`, `projectionStatus`, `projectionWarnings`, `rawText`

Legacy `StructuredEffect` does not currently express:

- trigger limits and reset scope
- boolean tag expressions
- board slot / terrain actions
- effect-template or effect-instance modifiers
- status duration modifiers
- player state / faction membership
- internal variables / effect groups
- player health threshold crossing details

Semantic IR already covers some of those gaps:

- `FrequencyLimiter` covers once / first-N reset, but lacks explicit scope/key.
- `BoolExpr` covers boolean predicates, but there is no dedicated canonical tag expression shape.
- `modify_slot`, `modify_effect`, `modify_variable`, `ValueExpr.variable`, and `SemanticVariable` already exist.
- `health_threshold_crossed` exists as an event name, but lacks attribute, threshold, and crossing metadata.
- `add_player_state` exists as an action type, but has no parser rule yet.
- status duration modifier is not represented directly.

`SourceAction` currently uses the `EffectActionType` enum. Raw action text should continue to live in `rawText`, evidence, spans, or warnings rather than being written into `SourceAction`.

## Unsupported Classification

From `docs/unknown-unsupported-report.md`:

- structured unknown effects: 11
- semantic unsupported cards: 633
- unsupported reason counts:
  - scaling/formula/reference values: 307
  - status/stat modifiers: 130
  - card state/create/transform/destroy: 100
  - positional/slot/size targeting: 63
  - economy/value/shop: 26
  - other: 4
  - conditions/triggers: 3

From the current JSONL corpus:

- entries: 1523
- projection status: unsupported 358, partial 1160, lossy 5
- entries with structured unknowns: 11
- entries with semantic unknown actions: 636
- entries with unsupported projection: 854

Classification:

- Parser rule gaps: Enraged longer/shorter, joined Cult, some first-time threshold variants.
- Legacy IR gaps: slot terrain, effect modifiers, trigger limits, internal variables, status duration modifiers, player state, health threshold crossing.
- Boolean/tag gaps: `non-Burn or non-Poison`, `Burn and Poison items`, `Burn and Regen items`.
- Effect group / internal variable needs: Augmented Defenses / Augmented Weaponry.
- Manual review / override candidates: empty effect text, expedition unlocks, named item generation from loose text, any-Hero generation semantics that require a richer ontology.

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

