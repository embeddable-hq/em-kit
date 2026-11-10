# charts-ui (working name)

Standalone build of the Remarkable Pro components for teams that bring their own data layer. No Embeddable runtime, builder metadata, or data loading.

## Commands

```bash
npm run sync         # regenerate src/generated + src/generated-ui from remarkable-pro@main + remarkable-ui@main, then the props reference
npm run types:check  # drift alarm: fails if upstream starts using an Embeddable API the shim lacks
npm run test         # smoke tests: every exported component × every data state × en/de
npm run check        # all three
npm run dev          # docs site on http://localhost:5310
```

## Docs site (`site/`)

A landing page, then the chart gallery, the docs and the examples. Hash-routed: `#/`, `#/charts`, `#/charts/<id>`, `#/docs`, `#/examples` (analytics dashboard), `#/examples/ai-chat`. The old `#/sample-app` and `#/ai` routes alias to the two examples (`site/router.ts`).

| Path | What |
|---|---|
| `site/config.ts` | Brand and package name. Rename here. |
| `site/catalog/registry.tsx` | One entry per chart: the props it takes and which toggles it exposes. The live preview and the Code tab are both generated from `props(ctx)`, so they can't drift apart. |
| `site/catalog/build.ts` | Turns an entry and the current settings into render props and a copy-pasteable snippet. |
| `site/catalog/datasets.ts` | Three seeded sample datasets (SaaS, web, retail), re-aggregated per granularity like a real query. |
| `site/catalog/themes.ts` | Theme presets (Default, Ocean, Forest, Midnight) and languages. |
| `site/generated/props.ts` | Every public component's props, extracted from the types by `scripts/props.mjs` (runs with `npm run sync`). Chart pages turn it into live controls: scalar props get inputs that update the preview and the generated code together, data-bound props and handlers show as chips. `site/catalog/propNotes.ts` holds the hand-written one-liner per prop name, shown on hover. |
| `site/pages/` | Landing, Gallery, ChartPage (preview, code, data, props and event log), Docs (including the AI setup reference: tool, guidance, schema), Examples (one tab per complete app). |
| `site/components/HeroShowcase.tsx` | The landing page's one visual: the same components on a live dashboard and in an AI chat, fed by one `useLiveSeries` stream. A nested `ChartsProvider` scopes a single-hue colour ramp to both, so a value is the same colour on either surface. |
| `site/components/DemoDashboard.tsx` | The dashboard example: five components cross-filtered by one donut click, with a granularity switcher and a controlled table. `site/pages/Examples.tsx` shows the standalone version of this source; keep the two in step. |
| `site/components/ChatDemo.tsx`, `SpecPlayground.tsx` | The AI chat example: the mock chat (click → intent → next chart) and the paste-a-spec playground. |
| `site/catalog/aiSnippets.ts` | The single source for every AI code sample on the site. |
| `site/catalog/benefits.ts` | The full benefit list on the landing page (ten groups, the last full-width for AI chat). Each point says what the library does, not what you still supply, and no point repeats another anywhere on the page. Counts (design tokens, AI chart kinds) are computed from the code. |

Theme, language and dataset are site-wide settings, persisted in `localStorage`. Adding a chart means adding a registry entry.

`REMARKABLE_PRO_REF=<ref>` / `REMARKABLE_UI_REF=<ref>` sync from another ref. Uncommitted upstream work is never synced.

## How it's built

| Path | Owner | What |
|---|---|---|
| `src/generated/` | `scripts/sync.mjs` | remarkable-pro `src/` minus the Embeddable layer. **Never edit by hand**; fix upstream and resync. |
| `src/generated-ui/` | `scripts/sync.mjs` | remarkable-ui `src/`, mirrored so the published package has no `@embeddable.com` dependency. Its npm dependencies are carried in this package.json instead. **Never edit by hand.** |
| `src/runtime/core.ts` | hand-written | Replaces `@embeddable.com/core`: data types (structurally identical), type guards, no-op `defineType`/`defineOption`. |
| `src/runtime/react.ts` | hand-written | Replaces `@embeddable.com/react`: theme context + `useTheme`. |
| `src/ChartsProvider.tsx` | hand-written | Merges theme overrides onto the default theme, injects CSS variables and fonts (what Embeddable's lifecycle hook does). |
| `src/TableScrollable.tsx` | hand-written | Wraps the generated scrollable table: a `resetKey` prop replaces the Embeddable `dataset` prop as the "query changed, reset paging" signal. |
| `src/data.ts` | hand-written | `dimension()`, `measure()`, `results()` helpers for building props. |
| `src/spec.ts` | hand-written | `ChartSpec`: the JSON-serializable chart spec an LLM tool call returns (23 chart kinds, including the KPI-tab and comparison lines and the labelled donut). |
| `src/ChartFromSpec.tsx` | hand-written | Renders a `ChartSpec` with the real components: normalizes dates/keys/types, falls back to a table or the error card, `chrome: card\|plain\|bare`, emits `ChartIntent`s on clicks, streams via `loading` + growing rows. |
| `src/intents.ts` | hand-written | `ChartIntent` + `intentToPrompt()`: chart clicks as one-line follow-up prompts. |
| `src/ai/` | hand-written + generated | `renderChartTool` / `renderChartToolOpenAI` tool definitions, `chartGuidance` prompt snippet, and the JSON Schemas (`spec.schema.generated.ts`, regenerated by `scripts/props.mjs`). Shown live on the docs site at `#/ai`. |
| `src/build/` | hand-written | `charts-ui/build`: the toolkit for custom charts (theme and i18n, `getThemeFormatter`, `useFillGaps`, colours and tokens, `ChartCard`, the Chart.js primitives and the Pro data/option builders), under the upstream names. Curated: nothing is re-exported wholesale. Worked example live on the docs site at `#/docs` → "Build your own chart". |
| `src/fieldInputs.ts`, `src/fieldInputs.generated.*` | hand-written + generated | `FieldInputs`: every per-field option a chart reads from a field's `inputs`, extracted from remarkable-pro's chart definitions by `scripts/extract-field-inputs.mjs` during sync. |
| `src/index.ts` | hand-written | Public API (v1: charts, KPIs, tables) under standalone names: the upstream `Pro` suffix is dropped (`BarChartDefaultPro` → `BarChart`, `KpiChartNumberPro` → `KpiNumber`, …). |

The sync drops `*.emb.ts`, `definition.ts`, `*.loadData.utils.ts`, builder input constants, preview mocks, `src/editors`, filter builders, dimension/measure pickers, and tests. `*.type.emb.ts` files are kept and renamed `*.type.ts`, because chart code imports their option constants. Declared content rewrites fail the sync when they stop matching upstream. Currently: the colour-cache `sessionStorage` key `embeddable` → `charts-ui`; two upstream bug fixes awaiting an upstream release (scatter labels forced on in remarkable-pro, the KPI number's font size in remarkable-ui). After a sync, no `@embeddable.com` import may remain anywhere, in either tree.

## Data contract

- `results`: `{ isLoading, data?: Row[], error?, total? }`, the rows from your own query.
- `dimension`/`measure`: `name` is the row key. `type` is a native type (`string | number | time | boolean`); numbers are only formatted when `type` is `number`.
- Display options go on `inputs`, e.g. `prefix`, `suffix`, `decimalPlaces`, `displayName`, `displayNullAs`.
- Time values are ISO strings without a zone: `YYYY-MM-DDTHH:mm:ss.sss`. For a time dimension with a granularity, supply the value under both `name` and `name.granularity` (line charts read the first, grouping charts the second; Cube returns both).
- Tables are controlled: pass `state`/`setState` from `useState`, then slice and sort your data from `state.page`, `state.pageSize`, `state.sort`.
- `TableScrollable` accumulates pages as the user scrolls: serve pages of `TABLE_SCROLLABLE_SIZE` rows (fewer means no more data), and change `resetKey` whenever the query behind the rows changes so it resets to the first page.

## Todo

- [ ] **Pick the public name, then publish.** This repo is local with no remote. Once the name is chosen (Mason UI is a candidate; avoid "remarkable" because of the reMarkable tablet trademark): rename in `site/config.ts` and `package.json`, create the GitHub repo (confirm first), then push.

## Open findings

Resolved: the `@embeddable.com/remarkable-ui` dependency (now mirrored as `src/generated-ui`), the `embeddable` sessionStorage key (rewritten to `charts-ui` at sync), the `__embeddableVariableMeta` payload field (dead code, removed with `Value`), the `TableScrollable` dataset prop (wrapped with `resetKey`), the `Pro` suffix (dropped from the public API), missing tests (smoke suite in `tests/`), and the gallery gap (every exported component now has a gallery entry).

1. No library build or publish step yet (tsup/Vite library mode + CSS modules + SVG assets).
2. CSS tokens are page-global. `theme.styles` goes on `:root`, so nested providers can't use different styles. JS theme settings (`theme.charts` options, colour maps, i18n) do scope correctly to a nested provider, which is how the hero dashboard gets its own palette. Scoping the CSS variables to a wrapper element would make the styles scope too.
3. Percentages aren't localised. The KPI change shows `+7.4%` in German, which should be `+7,4%`.
4. `hideMenu` hides the whole card header, title included, not just the menu.
5. The granularity picker needs `inputs.showGranularityDropdown: true` on the time dimension, an Embeddable builder input that isn't obvious from the props.
6. UI language (`theme.i18n.language`) and number/date locale (`theme.formatter.locale`) are set separately. That's flexible, but the provider should probably offer a single `locale` shortcut.
7. `TableScrollable` shows the first page twice in dev under React StrictMode: the append effect in the generated component (`src/generated/.../TableScrollable/index.tsx`, the `[rows]` effect) re-runs on StrictMode's double mount after `firstLoadPending` has already flipped, so the mount page is appended again. Production builds are unaffected. Fix upstream (guard with a last-processed-rows ref) and resync.
8. `src/i18n/fr.ts` (French) is hand-written in this repo, not synced. Keep its keys in step with the upstream `en`/`de` bundles, or better, contribute it upstream.
9. Y-axis labels clip their first character when a locale widens numbers (French `$7 000` shows as `7 000`).
