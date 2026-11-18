# EmKit

Finished React chart, KPI and table components by [Embeddable](https://embeddable.com), for teams that already have a data layer. MIT licensed. Docs: [emkit.embeddable.com](https://emkit.embeddable.com).

EmKit is Embeddable’s chart components as a standalone React library: you bring the data. Inside Embeddable the same components are called Remarkable Pro. [Embeddable](https://embeddable.com) adds the data layer, multi-tenant security and self-serve dashboards for your customers.

Code samples import from `em-kit`; the package is not published yet (ROADMAP.md, Phase 5). This repository is the standalone build of the Remarkable Pro components: no Embeddable runtime, builder metadata, or data loading.

## Commands

```bash
npm run sync         # fetch and regenerate src/generated + src/generated-ui from remarkable-pro + remarkable-ui origin/main, then the exports and props reference
npm run exports      # regenerate src/components.generated.ts from the component manifest
npm run types:check  # drift alarm: fails if upstream starts using an Embeddable API the shim lacks
npm run test         # smoke tests: every exported component × every data state × en/de
npm run check        # all three
npm run dev          # docs site on http://localhost:5310
```

## Build the site

```bash
npm run site:build     # dist-site/: Vite build, then every page prerendered to HTML
npm run site:check     # the same, then asserts every page (one h1, title, canonical, Markdown link, install command)
npm run site:preview   # serves dist-site/ on http://localhost:5311 (404.html with a 404 status for unknown paths)
```

Each page in `sitePages()` is written to `dist-site/<path>/index.html` with its content and head tags, next to its `.md` twin, `llms.txt`, `llms-full.txt`, `sitemap.xml` and `robots.txt`. Old URLs get a small redirect page, and `_redirects` (Netlify and Cloudflare Pages format) lists them. Absolute URLs use `BRAND.url`; set `SITE_URL=http://localhost:5311` to override.

The host must serve `dist-site/404.html` with a 404 status for unknown paths (Netlify and Cloudflare Pages do this on their own). Playgrounds (`/docs/components/<slug>/playground[/<preset>]`) are rendered in the browser, so also serve `404.html` for them (`_redirects` rewrites them to it with a 200), and the page script then draws the playground. The pages load with `createRoot`, which replaces the prerendered HTML; `hydrateRoot` reports text mismatches (React error 418) on every page today.

## Docs site (`site/`)

A landing page, the docs (shadcn-style: sidebar, page, "On this page", ⌘K search), the chart gallery with a playground per chart, and the examples. Path-routed (`site/router.ts`), so every page has a real URL: `/`, `/docs/<guide>`, `/docs/components`, `/docs/components/<id>`, `/charts`, `/charts/<id>[/<preset>]` (playground), `/examples`, `/examples/ai-chat`. Old `#/…` links and aliases rewrite to their canonical path on load. The host must serve `index.html` for unknown paths (Vite does in dev).

Docs pages are data, not JSX, so one source renders the page, its "On this page" list, "Copy Markdown" and the search index (and later `llms.txt`):

| Path | What |
|---|---|
| `site/docs/guides.ts` | Every guide page as blocks (headings, Markdown prose, code, live demos), including "Why EmKit" and its comparison with a raw chart library. |
| `site/docs/components.ts` | Per component, derived from the registry and generated props: its examples (presets, an "Other" bucket where supported, loading/empty/error), what it does for you, and its Markdown. |
| `site/docs/nav.ts` | The sidebar and the ⌘K search index. |
| `site/pages/DocPage.tsx`, `ComponentDocPage.tsx`, `ComponentsIndex.tsx` | The guide, component and components-index pages. |

| Path | What |
|---|---|
| `site/config.ts` | Brand and package name. Rename here. |
| `site/catalog/registry.tsx` | One entry per chart: the props it takes and which toggles it exposes. The live preview and the Code tab are both generated from `props(ctx)`, so they can't drift apart. |
| `site/catalog/build.ts` | Turns an entry and the current settings into render props and a copy-pasteable snippet. |
| `site/catalog/datasets.ts` | Three seeded sample datasets (SaaS, web, retail), re-aggregated per granularity like a real query. |
| `site/catalog/themes.ts` | Theme presets (Default, Ocean, Forest, Midnight) and languages. |
| `site/generated/props.ts` | Every public component's props, extracted from the types by `scripts/props.mjs` (runs with `npm run sync`). Chart pages turn it into live controls: scalar props get inputs that update the preview and the generated code together, data-bound props and handlers show as chips. `site/catalog/propNotes.ts` holds the hand-written one-liner per prop name, shown on hover. |
| `site/pages/` | Landing, Gallery, ChartPage (the playground: preview, code, data, props and event log), the docs pages above, Examples (one tab per complete app). |
| `site/components/HeroShowcase.tsx` | The landing page's one visual: the same components on a live dashboard and in an AI chat, fed by one `useLiveSeries` stream. A nested `ChartsProvider` scopes a single-hue colour ramp to both, so a value is the same colour on either surface. |
| `site/components/DemoDashboard.tsx` | The dashboard example: five components cross-filtered by one donut click, with a granularity switcher and a controlled table. `site/pages/Examples.tsx` shows the standalone version of this source; keep the two in step. |
| `site/components/ChatDemo.tsx`, `SpecPlayground.tsx` | The AI chat example: the mock chat (click → intent → next chart) and the paste-a-spec playground. |
| `site/catalog/aiSnippets.ts` | The single source for every AI code sample on the site. |
| `site/catalog/benefits.ts` | The full benefit list on the landing page (ten groups, the last full-width for AI chat). Each point says what the library does, not what you still supply, and no point repeats another anywhere on the page. Counts (design tokens, AI chart kinds) are computed from the code. |

Theme, language and dataset are site-wide settings, persisted in `localStorage`. Adding a chart means adding a registry entry.

`REMARKABLE_PRO_REF=<ref>` / `REMARKABLE_UI_REF=<ref>` sync from another ref (default `origin/main`, fetched first; `SYNC_NO_FETCH=1` skips the fetch). Uncommitted upstream work is never synced.

### Adding a new Remarkable component

`scripts/components.manifest.mjs` lists every component remarkable-pro publishes (every directory with a `*.emb.ts` file) as `exported`, `wrapped` or `skipped` with a reason. When upstream adds one, `npm run sync` fails and prints the manifest line to add. Then:

1. Add the line, with the standalone name (upstream name minus `Pro`).
2. `npm run sync`. The export lands in `src/components.generated.ts`.
3. Add a gallery entry in `site/catalog/registry.tsx` (and a title in `site/catalog/translations.ts`). `tests/manifest.test.tsx` fails until the component is exported and has a gallery entry, and the gallery entry puts it in the smoke suite.

CI: `.github/workflows/ci.yml` checks types, tests and generated exports on every push. `.github/workflows/sync-upstream.yml` runs the sync every Monday and opens a PR listing the upstream commits it brings in, or fails with the sync's reason.

## How it's built

| Path | Owner | What |
|---|---|---|
| `src/generated/` | `scripts/sync.mjs` | remarkable-pro `src/` minus the Embeddable layer. **Never edit by hand**; fix upstream and resync. |
| `src/generated-ui/` | `scripts/sync.mjs` | remarkable-ui `src/`, mirrored so the published package has no `@embeddable.com` dependency. Its npm dependencies are carried in this package.json instead. **Never edit by hand.** |
| `src/runtime/core.ts` | hand-written | Replaces `@embeddable.com/core`: data types (structurally identical), type guards, no-op `defineType`/`defineOption`. |
| `src/runtime/react.ts` | hand-written | Replaces `@embeddable.com/react`: theme context + `useTheme`. |
| `src/ChartsProvider.tsx` | hand-written | Merges theme overrides onto the default theme, injects CSS variables and fonts (what Embeddable's lifecycle hook does). |
| `src/TableScrollable.tsx` | hand-written | Wraps the generated scrollable table: a `resetKey` prop replaces the Embeddable `dataset` prop as the "query changed, reset paging" signal, and a `heightMode` prop replaces Embeddable's dashboard layout (`'auto'` grows the card to fit every row). |
| `src/data.ts` | hand-written | `dimension()`, `measure()`, `results()` helpers for building props. |
| `src/spec.ts` | hand-written | `ChartSpec`: the JSON-serializable chart spec an LLM tool call returns (23 chart kinds, including the KPI-tab and comparison lines and the labelled donut). |
| `src/ChartFromSpec.tsx` | hand-written | Renders a `ChartSpec` with the real components: normalizes dates/keys/types, falls back to a table or the error card, `chrome: card\|plain\|bare`, emits `ChartIntent`s on clicks, streams via `loading` + growing rows. |
| `src/intents.ts` | hand-written | `ChartIntent` + `intentToPrompt()`: chart clicks as one-line follow-up prompts. |
| `src/ai/` | hand-written + generated | `renderChartTool` / `renderChartToolOpenAI` tool definitions, `chartGuidance` prompt snippet, and the JSON Schemas (`spec.schema.generated.ts`, regenerated by `scripts/props.mjs`). Shown live on the docs site at `#/ai`. |
| `src/build/` | hand-written | `em-kit/build`: the toolkit for custom charts (theme and i18n, `getThemeFormatter`, `useFillGaps`, colours and tokens, `ChartCard`, the Chart.js primitives and the Pro data/option builders), under the upstream names. Curated: nothing is re-exported wholesale. Worked example live on the docs site at `#/docs` → "Build your own chart". |
| `src/fieldInputs.ts`, `src/fieldInputs.generated.*` | hand-written + generated | `FieldInputs`: every per-field option a chart reads from a field's `inputs`, extracted from remarkable-pro's chart definitions by `scripts/extract-field-inputs.mjs` during sync. |
| `scripts/components.manifest.mjs` | hand-written | Every upstream component and its fate: exported (under which name), wrapped, or skipped (and why). |
| `src/components.generated.ts`, `src/componentDefaults.generated.ts` | `scripts/exports.mjs` | One export per manifest component under its standalone name, with its Embeddable builder defaults applied (see below): the upstream `Pro` suffix is dropped (`BarChartDefaultPro` → `BarChart`, `KpiChartNumberPro` → `KpiNumber`, …). |
| `src/index.ts` | hand-written | Public API (v1: charts, KPIs, tables): the generated component exports plus providers, helpers, wrappers and the AI spec. |

The sync drops `*.emb.ts`, `definition.ts`, `*.loadData.utils.ts`, builder input constants, preview mocks, `src/editors`, filter builders, dimension/measure pickers, and tests. `*.type.emb.ts` files are kept and renamed `*.type.ts`, because chart code imports their option constants. Declared content rewrites fail the sync when they stop matching upstream. Currently: the colour-cache `sessionStorage` key `embeddable` → `emkit`; two upstream bug fixes awaiting an upstream release (scatter labels forced on in remarkable-pro, the KPI number's font size in remarkable-ui). After a sync, no `@embeddable.com` import may remain anywhere, in either tree.

**Builder defaults.** Embeddable's builder fills every input an author leaves unset with the default declared in the component's `definition.ts`, so upstream components can rely on it (the export menu, for one, only appears when `menuOptions` is passed). The sync records those defaults (`src/builderDefaults.generated.json`), `scripts/exports.mjs` keeps the ones that are props and type-checks them (`src/componentDefaults.generated.ts`), and every exported component applies them through `src/withDefaults.tsx`. A prop passed as `undefined` gets the default too. Charts therefore look as they do in Embeddable out of the box: value labels on for bars, lines, pies and scatter, export menu with CSV, XLSX, PNG and Maximize.

## Data contract

- `results`: `{ isLoading, data?: Row[], error?, total? }`, the rows from your own query.
- `dimension`/`measure`: `name` is the row key. `type` is a native type (`string | number | time | boolean`); numbers are only formatted when `type` is `number`.
- Display options go on `inputs`, e.g. `prefix`, `suffix`, `decimalPlaces`, `displayName`, `displayNullAs`.
- Time values are ISO strings without a zone: `YYYY-MM-DDTHH:mm:ss.sss`. For a time dimension with a granularity, supply the value under both `name` and `name.granularity` (line charts read the first, grouping charts the second; Cube returns both).
- Tables are controlled: pass `state`/`setState` from `useState`, then slice and sort your data from `state.page`, `state.pageSize`, `state.sort`.
- `TableScrollable` (default `heightMode: 'fixed'`) accumulates pages as the user scrolls: serve pages of `TABLE_SCROLLABLE_SIZE` rows (fewer means no more data), and change `resetKey` whenever the query behind the rows changes so it resets to the first page. With `heightMode: 'auto'` the card grows to fit: pass every row at once (up to your own cap) with `results.total`, and the table says when rows were left out.

## Licence

MIT, like the upstream remarkable-pro and remarkable-ui repositories it is built from (`LICENSE`, copyright Embeddable.com).

## Todo

- [ ] **Publish as EmKit, last.** Name decided 2026-11-17: **EmKit**, npm package `em-kit` (free on npm that day), docs at **emkit.embeddable.com**. Build everything first; packaging and publishing come at the end (ROADMAP.md, Phase 5).
- [ ] **Localise percentages everywhere** (low impact, later). Six places format percentages by hand (`toFixed` + `%`), so German shows `12.5%` instead of `12,5 %`: remarkable-ui `KpiChartChange.tsx` (PR [remarkable-ui#445](https://github.com/embeddable-hq/remarkable-ui/pull/445) adds `percentageFormatter`), `PivotTable.utils.ts`, `funnel.utils.ts`; remarkable-pro `charts.utils.ts` (pie/donut labels as %), `LineChartComparisonWithKpiTabsPro.utils.tsx`, `FunnelChartPro.utils.ts`. Fix: one `themeFormatter.percent(value, decimals)` in remarkable-pro (Intl, theme locale), used directly in the three Pro spots and passed as `percentageFormatter` to the three ui ones. ~half a day.

## Open findings

Resolved: the `@embeddable.com/remarkable-ui` dependency (now mirrored as `src/generated-ui`), the `embeddable` sessionStorage key (rewritten to `emkit` at sync), the `__embeddableVariableMeta` payload field (dead code, removed with `Value`), the `TableScrollable` dataset prop (wrapped with `resetKey`), the `Pro` suffix (dropped from the public API), missing tests (smoke suite in `tests/`), and the gallery gap (every exported component now has a gallery entry).

1. No library build or publish step yet (tsup/Vite library mode + CSS modules + SVG assets).
2. CSS tokens are page-global. `theme.styles` goes on `:root`, so nested providers can't use different styles. JS theme settings (`theme.charts` options, colour maps, i18n) do scope correctly to a nested provider, which is how the hero dashboard gets its own palette. This is by design upstream; use one set of CSS tokens per page.
3. Percentages aren't localised. The KPI change shows `+7.4%` in German, which should be `+7,4%`.
4. `hideMenu` hides the whole card header, title included, not just the menu. By design upstream; `ChartFromSpec`'s `chrome="plain"` keeps the title and drops only the menu.
5. The granularity picker needs `inputs.showGranularityDropdown: true` on the time dimension, an Embeddable builder input that isn't obvious from the props.
6. UI language (`theme.i18n.language`) and number/date locale (`theme.formatter.locale`) are set separately. That's flexible, but the provider should probably offer a single `locale` shortcut.
7. `TableScrollable` shows the first page twice in dev under React StrictMode: the append effect in the generated component (`src/generated/.../TableScrollable/index.tsx`, the `[rows]` effect) re-runs on StrictMode's double mount after `firstLoadPending` has already flipped, so the mount page is appended again. Production builds are unaffected. Fix upstream (guard with a last-processed-rows ref) and resync.
8. `src/i18n/fr.ts` (French) is hand-written in this repo, not synced. Keep its keys in step with the upstream `en`/`de` bundles, or better, contribute it upstream.
9. Y-axis labels clip their first character when a locale widens numbers (French `$7 000` shows as `7 000`).
