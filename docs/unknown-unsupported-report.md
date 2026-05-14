# Effect Parse Unknown / Unsupported Report

Generated from the current local TypeScript parser and local BazaarDB JSON only.

Latest evaluation command:

```bash
npm run evaluate:effect-parser
```

## Summary

Current parser status:

- Entities: 1524
- Corpus-eligible entities: 1523
- Structured effects: 2938
- Parsed structured effects: 2938
- Structured unknown effects: 0
- Structured unknown tokens: 0
- Semantic clauses: 2758
- Semantic unknown actions: 0
- Unsupported projected semantic effects: 0
- Suspicious parse results: 0

Current projection status distribution:

| status | count |
| --- | ---: |
| exact | 1396 |
| partial | 114 |
| lossy | 14 |

The current raw text corpus baseline has the same corpus-eligible projection distribution: `exact 1395`, `partial 114`, `lossy 14`.

## Resolved High-Priority Patterns

The original high-priority unknown / unsupported examples are now represented by parser rules and additive IR extensions:

| text family | current representation |
| --- | --- |
| `One of your slots becomes a Stove (The item here is Heated)` | board slot terrain action: `TActionBoardSlotSetTerrain`, terrain `Stove`, occupant status hint `Heated` |
| `One of your slots becomes a Cooler (The item here is Chilled)` | board slot terrain action: `TActionBoardSlotSetTerrain`, terrain `Cooler`, occupant status hint `Chilled` |
| `All Charge effects are reduced by half` | effect modifier: `TActionEffectModify`, effect family `Charge`, magnitude multiplier `1/2` |
| `The first time ... each fight` | trigger limit on the trigger: `Mode=First`, `Reset=Fight` |
| `non-Burn or non-Poison item` | boolean tag expression canonicalized to `NoneOf(Burn, Poison)` with audit warning for text ambiguity |
| `Burn and Poison items` / `Burn and Regen items` | boolean tag expression represented as `AnyOf(...)` for collection-style game text |
| `fall below half Health each fight` | player attribute threshold crossing trigger with half max-health threshold and first-per-fight limit |
| `this gains 1 bonus` tied to an aura | internal variable / effect group representation, with child effects linked by group metadata |
| `You are Enraged for 1 second longer/shorter` | status duration modifier action instead of applying Enrage |
| `You have joined the Cult` | player state / faction action |
| first-time single event triggers such as Burn, Poison, Crit, Over-Heal | concrete event triggers with first-per-fight limit |
| `When this item's value reaches 10 out of combat` | card attribute threshold crossing trigger; out-of-combat timing is preserved as projection warning |
| `The first time you Freeze, Burn, Slow, Poison, and Haste each fight` | effect sequence completed trigger with an effect predicate group and first-per-fight limit |

## Current Review Buckets

There are no current full unknowns or unsupported semantic projections. Remaining audit work is about projection precision:

| bucket | count |
| --- | ---: |
| partial projection | 115 |
| lossy projection | 13 |
| incoming damage reduction recipient binding warning | 4 |
| destroy replacement timing warning | 1 |
| redirect predicate warning | 1 |

These are intentionally not counted as unknown. Every current partial projection has an explicit `projectionWarnings` reason. They should be reviewed when improving projection fidelity, facets, UI explanation, or scoring behavior.

## Notes

- `activeIn` remains limited to `hand_only` and `hand_and_stash`; fight/shop/run timing is represented through triggers, trigger limits, scopes, or projection warnings.
- `StructuredAction.SourceAction` continues to use the `EffectActionType` enum. Raw clause text is preserved through `rawText`, `semanticSourceIds`, spans/evidence, and warnings rather than being written into `SourceAction`.
- No runtime LLM, game client integration, scraping, database, or external data source is used.
- Future offline LLM assistance should enter through `scripts/import-pattern-candidates.ts`, where candidates are validated against local schema and ontology before review.
