# Effect Parse Unknown / Unsupported Report

Generated from the current local TypeScript parser and local game data JSON only
(`data/raw/gamedata`, imported from the 2026-10-13 game runtime cache).

Latest evaluation command:

```bash
npm run evaluate:effect-parser
```

## Summary

Current parser status (2026-10-19, after the gamedata migration):

- Entities: 1969
- Corpus-eligible entities: 1957
- Structured effects: 3473
- Parsed structured effects: 3386
- Structured unknown effects: 87
- Structured unknown tokens: 233
- Semantic clauses: 3288
- Semantic unknown actions: 15
- Unsupported projected semantic effects: 15
- Suspicious parse results: 0

Current projection status distribution:

| status | count |
| --- | ---: |
| exact | 1956 |
| partial | 10 |
| unsupported | 3 |

The current raw text corpus baseline has the corpus-eligible projection distribution:
`exact 1944`, `partial 10`, `unsupported 3`.

## Current Review Buckets

| bucket | count | notes |
| --- | ---: | --- |
| unknown semantic action | 15 | Tempo/Encounter mechanics and one untranslated token |
| structured unknown effect | 87 | legacy parser layer, overlaps with semantic unknowns |
| partial projection | 10 | projection loses part of the semantic IR |
| unsupported projection | 3 | no projection to legacy `StructuredEffect` |

The new package reward text `get an Enchanted <size> <tag> item and N XP`
(100 clauses) is now parsed: the XP tail splits into its own `modify_stat`, and
`Max Health` item rewards are treated as item selectors rather than player stats.

Remaining gaps (15 clauses):

- `Tempo` spend / refund text (`spend 1 Tempo`, `Spend All Tempo:`)
- `reroll your hourly Encounters` (3 cards)
- `visit an Encounter of the same tier`
- `spend 4 to use it again`
- `G Notes`-specific text (`Tempo items on G Notes have +1 Multicast`)
- Radiant / Shiny guaranteed-enchantment tails
- `If they are already Enchanted` continuation
- One untranslated token in `Rapid Thaw` (`reduce the duration by 2000 second(s)`)

## Resolved High-Priority Patterns

The original high-priority unknown / unsupported examples are represented by parser rules and additive IR extensions:

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
| dynamic type-copy / random type text such as `This has the Types of items you have in your Stash` | dynamic tag mutation sidecar: `StructuredTagMutation`, source selector, random count, and raw description |
| `that Player` / `items adjacent to it` trigger-source targets | trigger player target and anchored positional target, with view/facet projections |
| unspecified enchantment text such as `Enchant 1 non-enchanted item(s)` | enchantment selection sidecar: `EnchantmentSelection: "Unspecified"` |
| `Heal to full` / `Heal to half health` | health set mode sidecar: `HealthSetMode: "HealToThreshold"` |
| compound action graph text with `then` or multi-action clauses | action graph sidecar: `StructuredActionGraphLink`, preserving graph id, root node, node path, and order while keeping flat effects compatible |
| `When you Repair or Transform in combat` | concrete `TTriggerOnRepairOrTransform` source event with `CombatOnly` scope |
| shorthand `increase this by N` / `double this` after a prior effect | anchored effect value modifier: `TActionEffectModify` targeting `TTargetEffect` with `Anchor: "PreviousSemanticAction"` |
| `If it already has 2 of this bonus, reset it instead` | variable reset gated by `TVariableConditionalValue(this_bonus >= 2)` |

## Notes

- `activeIn` remains limited to `hand_only` and `hand_and_stash`; fight/shop/run timing is represented through triggers, trigger limits, scopes, or projection warnings.
- `StructuredAction.SourceAction` continues to use the `EffectActionType` enum. Raw clause text is preserved through `rawText`, `semanticSourceIds`, spans/evidence, and warnings rather than being written into `SourceAction`.
- Unknown effects only reduce the entity's mechanic confidence in scoring; they do not hide the entity from the catalog or the generator.
- No runtime LLM, game client integration, scraping, database, or external data source is used.
- Future offline LLM assistance should enter through `scripts/import-pattern-candidates.ts`, where candidates are validated against local schema and ontology before review.
