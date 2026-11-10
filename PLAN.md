# Plan: make charts-ui amazing for AI chat

Goal: an LLM returns JSON, the app renders a live, interactive, chat-bubble-sized chart — and clicks flow back to the model. Work top to bottom; each step is independently shippable. Mark `[x]` as we go, note decisions under the step.

Status: **all workstreams done** (2026-10-02) except 3.2, which recon showed needs an upstream remarkable-ui change (see its step and the queue). 216 tests green, `tsc --noEmit` clean, `#/ai` page browser-verified at desktop and 375px. `npm run sync` was deliberately NOT run (it pulls upstream@main and would churn the generated trees); `scripts/props.mjs` alone was run and is deterministic.

Post-test bug round: the 1.5 suite caught 6 renderer bugs, all fixed and covered by un-skipped tests — UTC parsing + bucket-start snapping for time values (matches `useFillGaps`'s dayjs.utc keys, incl. ISO weeks), null rows filtered before type inference, the unknown-kind fallback moved inside try/catch, comparison badge unlocked via an empty-but-truthy `comparisonDateRange`, and free-form `comparisonLabel`s injected into `theme.defaults.comparisonPeriodsOptions` scoped to the one chart. Browser verification caught a 7th: the error card now respects `chrome` too.

---

## 1. `ChartFromSpec` — JSON in, chart out (~1 day)

The core enabler. One serializable spec type, one renderer component. `site/catalog/build.ts` proves the spec→props mapping is mechanical; this is the productised version.

- [x] **1.1 Spec type** — `src/spec.ts`. Discriminated union on `chart`, 19 kinds (the planned 16 plus `barGroupedHorizontal`, `barStackedHorizontal`, `lineGrouped` for symmetry). Everything JSON-serializable.
      Decisions taken:
  - No top-level `fields` map: fields are inline per chart, as a bare row-key string or a `SpecField` object (`FieldRef`). One spec = one chart, so a registry would only duplicate.
  - Option keys reuse the component prop names, but always in **vertical orientation** (`xAxis` = category axis, `yAxisRange*` = value range); the renderer swaps axes for horizontal variants so producers never learn that quirk.
  - `granularity` lives on the chart, never on a field; the renderer attaches it to the time dimension.
  - KPI specs take a `value`/`comparisonValue` shortcut instead of rows; date ranges are ISO-string `{ from, to }` objects, converted to `TimeRange` Dates by the renderer.
  - `area.groupBy` is optional in the spec (component requires it) — renderer synthesizes a constant group for single-series areas.
  - `barLine` uses `barMeasures`/`lineMeasures` (component's ambiguous `measures` = bars).
  - `table.columns[*].role: 'dimension' | 'measure'` disambiguates mixed columns; inferred from values when omitted.
  - Deferred to the queue: `donutLabel`, the line-comparison/KPI-tab charts, `TableScrollable` (callback-driven paging doesn't fit a serializable spec yet).
  - Base fields `loading`/`error` are in from day one, so step 5 (streaming) is purely renderer work.
- [x] **1.2 Renderer** — `src/ChartFromSpec.tsx`. Maps spec → component props using `dimension()`/`measure()` from `src/data.ts`. Exported from `src/index.ts` together with the spec types and `intentToPrompt`. Imports components straight from `src/generated/` to avoid an index cycle. Owns table paging state and pivot expanded-row state internally (sort+slice client-side, like the demo dashboard). Horizontal variants get the axis swap here (`xAxis`→`yAxis` prop, label/range/reverse/maxItems swapped).
- [x] **1.3 Normalization layer (the LLM footgun absorber)** — done, inside the renderer: date coercion via dayjs (date-only, epoch ms, zoned ISO → zone-less ISO), `name.granularity` dual key, type inference from row values (a field carrying the chart's `granularity` is forced to `time`), numeric-string coercion for measures, non-object rows filtered out, invalid granularity values dropped.
- [x] **1.4 Never blank** — done: unknown `chart` + rows → table over the row keys; unknown + no rows → error card; per-kind required-field validation → error card naming the fields; `rows` not an array → error card; any render throw is caught into the error card. Error card = `ChartCard` with `errorMessage` (the components' own error presentation).
- [x] **1.5 Tests** — `tests/chartFromSpec.test.tsx`: 106 tests — all 19 kinds, every normalization case, every fallback, chrome modes, streaming frames, `intentToPrompt`. Chart.js draws to canvas, so the suite mocks `react-chartjs-2` (file-local) with a wrapper echoing labels/values as data attributes. Full run: 216 passing.

Acceptance: paste a hand-written JSON spec into a test, get a rendered chart; mangle the spec, still get a visible card.

## 2. Shipped tool definition (~half day)

So any app integrates with `tools: [chartSpecTool]` and `<ChartFromSpec spec={toolResult} />`.

- [x] **2.1 Generate JSON Schema** — done in `scripts/props.mjs` via `ts-json-schema-generator` (devDependency), output to `src/ai/spec.schema.generated.ts` (not `src/generated/`, which stays sync-owned). Two schemas: `chartSpecSchema` (full anyOf union, for validation) and `chartSpecToolSchema` (flattened root object — the Anthropic/OpenAI tool APIs reject a top-level anyOf; per-kind required fields are stated in the root description instead). Drift check fails the script if `CHART_KINDS` and the schema branches disagree. Validated with ajv (15 valid / 10 invalid specs).
- [x] **2.2 `src/ai/index.ts`** — exports `chartSpecSchema`, `chartSpecToolSchema`, `renderChartTool` (Anthropic), `renderChartToolOpenAI`, `chartGuidance` (~40-line system-prompt snippet), each with usage JSDoc. Proper package-exports wiring is blocked on the "no build step" finding, same as the rest of the public API.
- [x] **2.3 Docs-site page** — `#/ai` ("Use with AI"): 3-step quickstart, live JSON playground (`site/components/SpecPlayground.tsx`) with example/broken specs, chrome switcher and an intent log, plus the tool definition and `chartGuidance`. Note: code samples show `charts-ui/ai`, but package `exports` wiring stays blocked on the no-build-step finding. The nav gained a 4th link; at ≤720px links scroll horizontally and "Get started" hides (revisit if unwanted).

Acceptance: copy the tool definition into a Claude API call, feed the returned JSON straight to `ChartFromSpec`, chart renders.

## 3. Chat-safe rendering (~1–2 days)

- [x] **3.1 Chrome modes** — done as `chrome?: 'card' | 'plain' | 'bare'` + `height?: number` on `ChartFromSpec` (presentation is the app's choice, so it is a prop, not a spec field). `plain` = `menuOptions: []` (ChartCardMenuPro renders null when every option is filtered out — title survives, no upstream change needed; this soft-fixes README finding #4 for spec-rendered charts). `bare` = `hideMenu` + a wrapper div zeroing the `--em-card-*` chrome variables (padding/gap/radius/background/border/shadow) — safe because card chrome is pure CSS; chart.js colors resolve against `:root` and are unaffected. The real `hideMenu` split stays an upstream `ChartCard.tsx` fix (one shared file, lines ~99–120).
- [ ] **3.2 Scope CSS variables — RE-SCOPED after recon.** Wrapper-scoping today would break every chart.js color/font: ~115 call sites resolve variables through `getStyleValue()` → `getComputedStyle(document.documentElement)` (`src/generated-ui/styles/styles.utils.ts:16-20`), `getChartColors()` has no fallbacks (series colors become ''), and the portaled tooltip (`document.body`) would lose its theme. Correct fix is upstream in remarkable-ui (make `getStyleValue` read from a provider-registered element) or a declared `contentRewrites` entry in `scripts/sync.mjs` + resync. Moved to the queue with this evidence; not safe to do purely in this repo today. Bare-mode CSS flattening (3.1) is unaffected.
- [x] **3.3 Responsive check** — verified in the browser: chat demo, bare charts and playground all render correctly at 375px emulated width; axis labels and bubbles stay legible. Known cosmetic item: the nav is tight on phones (see 2.3 note).

Acceptance: two providers with different themes on one page render differently; a bare donut looks right in a 420px-wide container.

## 4. Two-way charts (~1 day)

Charts as conversation, not screenshots — the differentiator.

- [x] **4.1 `onIntent`** — done (`src/intents.ts` + wiring in the renderer). Every click prop (bars, lines, points, areas, segments, cells, rows) maps to one serializable `ChartIntent` with dimension/value, group dimension/value, measureValue, ISO `timeRange`, and the raw payload (dates serialized) under `details`. Tables get `clickDimension` = first dimension column so `onRowClicked` fires.
- [x] **4.2 `intentToPrompt(intent)`** — done; one plain-English follow-up line, handles value, group×value, time ranges, and a generic fallback.
- [x] **4.3 Demo** — done and browser-verified on `#/ai` (`site/components/ChatDemo.tsx`): slice click → user bubble with the exact `intentToPrompt` line → typing indicator → assistant bubble with the filtered line chart; intent JSON shown beside the thread; resettable. Chat bubbles capped at 420px. Known limit: canvas slices are mouse-only (no keyboard path).

Acceptance: clicking any interactive element yields one typed intent object; nothing fires on non-interactive charts.

## 5. Streaming rows (~half day)

- [x] **5.1** Done. react-chartjs-2 updates in place (no `key`/`redraw` anywhere; datasets matched by label), and `ChartCard` keeps the chart mounted whenever rows are present — so growing rows never flicker. While streaming, the renderer additionally scopes `animation.duration: 300` to that one chart via a `ThemeContext` wrap (merged onto the OUTER theme — a nested `ChartsProvider` would reset to the default theme), so each batch glides instead of restarting the ~1s intro tween. Rule for producers: never emit `rows: []` or drop `rows` between batches — that unmounts the chart.
- [x] **5.2** Done via the existing `loading: true` spec flag (in the base type since 1.1): rows absent → skeleton; rows present + loading → chart + header spinner; `loading` off → settled. No separate `streaming` flag needed.

Acceptance: a test that feeds rows in 3 batches renders 3 growing frames, then settles.

---

## Audit round (2026-10-03)

Full audit of usefulness, chart coverage and presentation; changes applied on top of the finished workstreams.

- [x] **Spec coverage: 19 → 23 kinds.** Added `lineWithKpiTabs`, `lineComparison`, `lineComparisonWithKpiTabs` (the tabbed/comparison charts — the library's most distinctive components) and `donutLabel`. All with derive-don't-require ergonomics: KPI tab numbers sum from the rows, comparison date ranges derive from each row set's time extent, the donut's center value sums from the rows. Schema + `chartGuidance` regenerated/extended; test fixtures cover all 23. The free-form `comparisonLabel` theme patch now applies to the comparison lines too.
- [x] **Gallery: the 6 missing components added** (comparison/tabbed lines, horizontal grouped/stacked bars, TableScrollable) — 24 entries, smoke-test matrix now 146 tests, titles translated de/fr. `datasets.ts` gained `byTimeWindow(granularity, {from,to})` for honest comparison periods; a `showComparisonAxis` toggle was added. TableScrollable serves the real accumulating-pages contract. Follow-up fixes applied in `build.ts`: the Data tab no longer clobbers entry-registered `pageRows`, and the generated snippet comment is accurate per table kind.
- [x] **DRY: central AI code snippets** — `site/catalog/aiSnippets.ts` is the single source for all seven samples (Landing/Docs/UseWithAI/ChatDemo); drifted variants reconciled (Docs' was missing required `max_tokens`; `chrome="bare"` kept as the canonical chat mode). Playground gained "Tabbed comparison" and "Donut with total" examples; tab-chart previews get 460px; the inaccurate "gallery shows every kind" sentence reworded.
- Remaining deliberately unspecced: `TableScrollable` (callback-driven paging still doesn't fit a serializable spec).
- New upstream bug recorded (README finding #7): TableScrollable duplicates its first page in dev under StrictMode — the generated `[rows]` append effect re-runs on double mount; unfixable from the wrapper, needs the upstream guard.

## Site restructure (2026-10-03)

User feedback: the nav (Docs, Charts, Sample app, Use with AI) split AI off from everything else, the sample app duplicated the home dashboard, and the home page was too long.

- [x] **Nav: Charts → Docs → Examples.** "Sample app" and "Use with AI" merged into one Examples page with two tabs (`#/examples`, `#/examples/ai-chat`); old routes alias there.
- [x] **Home simplified, 8 sections → 5:** hero, showcase, features, "two ways in" (one code sample per surface), CTA. Removed the long-tail checklist, the three-step guide (it's Docs' quick start), the standalone AI section and the "24 charts and counting" teaser.
- [x] **Duplication fixed by changing the home visual, not deleting it:** `HeroShowcase` shows the same components on two surfaces from one live stream: a compact dashboard (KPIs + streaming bars) next to an AI chat whose answer is the share donut, clickable into an intent prompt. The full apps live only on Examples.
- [x] **AI reference moved to Docs** (3 steps, tool definition, collapsible schema, guidance); Examples keeps the demos. Dead CSS (checklist, teaser, steps, old AI-page blocks) removed.

## Build toolkit (2026-10-05)

- [x] **`charts-ui/build`** — `src/build/index.ts`: the curated toolkit from remarkable-pro's build-component skill (`pro-builtins.md`), under upstream names. Package `exports` wiring is blocked on the no-build-step finding, like `charts-ui/ai`.
- [x] **Docs** — "Build your own chart" section: toolkit table, live `TargetLineChart` example (`site/examples/`, source shown via `?raw`), consistency rules.
- [ ] Optional: port the build-component skill as a Claude skill shipped with the package.

## Queued (after 1–5, in rough order)

- **CSS variable scoping (was 3.2)** — needs an upstream remarkable-ui change: `getStyleValue()` must read from a provider-registered element instead of `document.documentElement` (`src/generated-ui/styles/styles.utils.ts:16-20`), and the tooltip portal container needs the variables too. Alternative: a `contentRewrites` entry in `scripts/sync.mjs` + resync. Until then two providers share one `:root` style tag (last one wins for CSS/chart.js; JS theme settings already scope).
- **Upstream `ChartCard.tsx` header/menu split** (README finding #4 proper): one shared file, `hideMenu` currently removes title+spinner+menu together (~lines 99–120). `menuOptions: []` is the local workaround `chrome="plain"` uses.
- Spec coverage for the deferred kinds: `donutLabel`, line-comparison/KPI-tab charts, `TableScrollable` (needs a paging callback story in a serializable spec).
- Latent upstream bug found in recon: `TableChartPaginated/index.tsx:36-38` calls `getStyleNumber` at module import time, so theme overrides for cell/pagination height are ignored (and a DOM-less import would throw).
- PNG/clipboard export of a single chart for sharing out of chat (`dom-to-image-more` is already a dep; export utils exist in `src/generated/theme/utils/export.utils.ts`).
- Golden-spec eval suite: N natural-language questions → expected specs, run against a real model to catch schema regressions.
- Web-component wrapper for non-React hosts.
- Bundle slimming: lazy-register chart.js controllers/plugins per chart type.

## Constraints (carry-overs from README)

- `src/generated/` and `src/generated-ui/` are sync output — never edit by hand; fix upstream in remarkable-pro/remarkable-ui and `npm run sync`.
- `npm run check` (sync + types + tests) must stay green after every step.
- No publish yet: the package name decision (README Todo) gates step 2.2's import paths in docs, not the work itself.
