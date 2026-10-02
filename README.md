# charts-ui (working name)

Standalone build of the Remarkable Pro components for teams that bring their own data layer. No Embeddable runtime, builder metadata, or data loading.

## Commands

```bash
npm run sync         # regenerate src/generated from remarkable-pro@main
npm run types:check  # drift alarm: fails if upstream starts using an Embeddable API the shim lacks
npm run check        # both
npm run dev          # docs site on http://localhost:5310
```

## Docs site (`site/`)

A landing page first, then docs and a gallery of live charts. Hash-routed: `#/`, `#/docs`, `#/charts`, `#/charts/<id>`.

| Path | What |
|---|---|
| `site/config.ts` | Brand and package name. Rename here. |
| `site/catalog/registry.tsx` | One entry per chart: the props it takes and which toggles it exposes. The live preview and the Code tab are both generated from `props(ctx)`, so they can't drift apart. |
| `site/catalog/build.ts` | Turns an entry and the current settings into render props and a copy-pasteable snippet. |
| `site/catalog/datasets.ts` | Three seeded sample datasets (SaaS, web, retail), re-aggregated per granularity like a real query. |
| `site/catalog/themes.ts` | Theme presets (Default, Ocean, Forest, Midnight) and languages. |
| `site/pages/` | Landing, Docs, Gallery, ChartPage (preview, code, data, props and event log). |
| `site/components/HeroDashboard.tsx` | The live landing dashboard. A nested `ChartsProvider` scopes a single-hue colour ramp and slimmer bars to it; `useLiveSeries` streams hourly data into real components. |

Theme, language and dataset are site-wide settings, persisted in `localStorage`. Adding a chart means adding a registry entry.

`REMARKABLE_PRO_REF=<ref>` syncs from another ref. Uncommitted work in remarkable-pro is never synced.

## How it's built

| Path | Owner | What |
|---|---|---|
| `src/generated/` | `scripts/sync.mjs` | remarkable-pro `src/` minus the Embeddable layer. **Never edit by hand**; fix upstream and resync. |
| `src/runtime/core.ts` | hand-written | Replaces `@embeddable.com/core`: data types (structurally identical), `Value`, type guards, no-op `defineType`/`defineOption`. |
| `src/runtime/react.ts` | hand-written | Replaces `@embeddable.com/react`: theme context + `useTheme`. |
| `src/ChartsProvider.tsx` | hand-written | Merges theme overrides onto the default theme, injects CSS variables and fonts (what Embeddable's lifecycle hook does). |
| `src/data.ts` | hand-written | `dimension()`, `measure()`, `results()` helpers for building props. |
| `src/index.ts` | hand-written | Public API (v1: charts, KPIs, tables). |

The sync drops `*.emb.ts`, `definition.ts`, `*.loadData.utils.ts`, builder input constants, preview mocks, `src/editors`, filter builders, dimension/measure pickers, and tests. `*.type.emb.ts` files are kept and renamed `*.type.ts`, because chart code imports their option constants.

## Data contract

- `results`: `{ isLoading, data?: Row[], error?, total? }`, the rows from your own query.
- `dimension`/`measure`: `name` is the row key. `type` is a native type (`string | number | time | boolean`); numbers are only formatted when `type` is `number`.
- Display options go on `inputs`, e.g. `prefix`, `suffix`, `decimalPlaces`, `displayName`, `displayNullAs`.
- Time values are ISO strings without a zone: `YYYY-MM-DDTHH:mm:ss.sss`. For a time dimension with a granularity, supply the value under both `name` and `name.granularity` (line charts read the first, grouping charts the second; Cube returns both).
- Tables are controlled: pass `state`/`setState` from `useState`, then slice and sort your data from `state.page`, `state.pageSize`, `state.sort`.

## Open findings

1. `@embeddable.com/remarkable-ui` is still a visible dependency. Bundle it into the build, or mirror it the same way.
2. Colour assignments persist to `sessionStorage` under the key `embeddable`.
3. Emitted `Value` payloads carry an `__embeddableVariableMeta` field.
4. `TableScrollablePro` requires an Embeddable-shaped `dataset` prop (used to reset paging) and needs a standalone wrapper.
5. Component names keep the `Pro` suffix. Decide on public naming together with the package name.
6. Upstream tests aren't synced (they mock `@embeddable.com/react`). Add a smoke test per exported component here.
7. No library build or publish step yet (tsup/Vite library mode + CSS modules + SVG assets).
8. CSS tokens are page-global. `theme.styles` goes on `:root`, so nested providers can't use different styles. JS theme settings (`theme.charts` options, colour maps, i18n) do scope correctly to a nested provider, which is how the hero dashboard gets its own palette. Scoping the CSS variables to a wrapper element would make the styles scope too.
9. Percentages aren't localised. The KPI change shows `+7.4%` in German, which should be `+7,4%`.
10. `hideMenu` hides the whole card header, title included, not just the menu.
11. The granularity picker needs `inputs.showGranularityDropdown: true` on the time dimension, an Embeddable builder input that isn't obvious from the props.
12. UI language (`theme.i18n.language`) and number/date locale (`theme.formatter.locale`) are set separately. That's flexible, but the provider should probably offer a single `locale` shortcut.
13. Not yet in the gallery: `LineChartComparisonDefaultPro`, `LineChartWithKpiTabsPro`, `LineChartComparisonWithKpiTabsPro`, `BarChartStackedHorizontalPro`, `BarChartGroupedHorizontalPro`, `TableScrollablePro` (all exported).
14. `src/i18n/fr.ts` (French) is hand-written in this repo, not synced. Keep its keys in step with the upstream `en`/`de` bundles, or better, contribute it upstream.
15. Y-axis labels clip their first character when a locale widens numbers (French `$7 000` shows as `7 000`).
