# Roadmap: a standalone chart library that competes with shadcn charts and Bklit

Goal: Remarkable's components, freed from Embeddable, published everywhere a developer or an agent looks for charts. The pitch is **behaviour you don't have to build**: stable colour per value, date gap filling, granularity switching, comparison periods, number/date localisation, loading/empty/error states, CSV/XLSX/PNG export, and pivot and heat-map tables. shadcn charts give you Recharts and leave the wiring to you; Bklit gives you good-looking composable primitives. We give you the finished chart.

Work top to bottom. Each phase can ship on its own. Estimates assume one person.

---

## Decisions

1. ~~**Licence.**~~ Decided 2026-11-10: **MIT.** The upstream remarkable-pro and remarkable-ui repos are already public under MIT, so a no-resale licence on this package couldn't stop anyone reselling the same components taken from upstream. It would only add friction for users.
2. ~~**Public name.**~~ Decided 2026-11-17: **EmKit**, npm package `em-kit`, docs at **emkit.embeddable.com**, repo `embeddable-hq/em-kit`. ("em" is the prefix of every theme variable, `--em-*`, and short for Embeddable.) It was R Kit from 2026-11-11 until then; dropped because `rkit` on npm is someone else's React UI kit.
3. ~~**Embeddable's place in the brand.**~~ Settled by the domain: EmKit lives under embeddable.com.
4. ~~**Scope v1.**~~ Decided 2026-11-18: **charts, tables and controls.** Controls work without Embeddable: a value in, `onChange` out, wired to the charts by the app's own state.

## Phase 0: Secure the work (~1 hour)

- [x] Commit everything since the initial commit (a month of work is uncommitted).
- [ ] Once the name is chosen: create the GitHub repo (confirm first) and push.

## Phase 1: Automatic intake of new Remarkable components (done 2026-11-10, except the upstream fix loop)

Before this phase, `sync.mjs` copied every upstream component, but `src/index.ts`, the gallery, the spec and the tests were hand-written. A new upstream component landed silently and stayed invisible. It also synced local `main`, which was 32 commits behind GitHub, so `FunnelChartPro` hadn't arrived at all.

- [x] **Component manifest** (`scripts/components.manifest.mjs`): all 43 upstream components (every `*.emb.ts` directory), each `exported`, `wrapped` or `skipped` with a reason. Sync **fails** when upstream gains or loses a component, and prints the line to add.
- [x] **Generated exports** (`scripts/exports.mjs` → `src/components.generated.ts`). `tests/manifest.test.tsx` fails until each published component is exported and has a gallery entry, and the gallery entry puts it in the smoke suite. The gallery entry itself stays hand-written: it is where sample data and toggles are chosen.
- [x] **Sync from `origin/main`**, fetched first, instead of whatever local `main` happens to be.
- [x] **Latest upstream synced** (remarkable-pro `a362e0ac`, remarkable-ui `0474f921`): colour assignment, time-zone handling, "Other" bucketing, PNG card export, maximize, TableScrollable auto height. Shim additions: `HEIGHT_MODES`/`useEmbeddableLayout` (exposed as `TableScrollable`'s `heightMode` prop) and `LoadDataRequest`.
- [x] **`FunnelChart` exported**, with a gallery entry and funnel-stage data in all three sample datasets (translated de/fr).
- [x] **CI:** `ci.yml` (types, tests, generated exports) and `sync-upstream.yml` (weekly sync PR). Both are untested until the repo is on GitHub.
- [ ] **Upstream fix loop:** PRs on embeddable-hq/remarkable-pro and remarkable-ui for the issues still present after the 2026-11-10 sync. Each merged fix removes a workaround here: once released, delete the matching `contentRewrites` entry in `scripts/sync.mjs` and resync (the sync fails if a rewrite stops matching, so a merged fix announces itself).
  - KPI change percentages use `toFixed`, so German shows `+7.4%` instead of `+7,4%`. PR [remarkable-ui#445](https://github.com/embeddable-hq/remarkable-ui/pull/445) adds `percentageFormatter`. Low impact: the wider fix (all six hand-formatted percentages) is a README todo for later.
  - A host page's global `h2` font-size pins the KPI number and defeats auto-sizing (content rewrite here). PR [remarkable-ui#446](https://github.com/embeddable-hq/remarkable-ui/pull/446).
  - Scatter value and point labels are forced on, ignoring `showValueLabels`/`showPointLabels` (content rewrites here). PR [remarkable-pro#314](https://github.com/embeddable-hq/remarkable-pro/pull/314).
  - `TableScrollable` shows its first page twice under React StrictMode in dev (112 rows, 62 unique). PR [remarkable-pro#315](https://github.com/embeddable-hq/remarkable-pro/pull/315).
  - By design upstream, not to be changed: CSS variables read from `document.documentElement` (no per-provider CSS scoping); `hideMenu` hiding the whole header, title included; `TableChartPaginated` reading row heights once at import (rows have a fixed height).
  - Not rechecked: y-axis labels clip their first character when a locale widens numbers (French `$7 000`).
- [x] **Builder defaults:** the sync found upstream's export menu is now opt-in, with its default set only in Embeddable's builder input, so standalone users silently lost CSV/PNG export. Fixed generally: the sync records every input's `defaultValue` from the definitions, and each exported component applies the ones that are props (`withDefaults`, type-checked with `satisfies`). Standalone charts now match Embeddable's out-of-the-box look, including value labels on bar, line, pie and scatter charts.
- [ ] **Controls**, in four parts:
  - [x] The seven simple ones (18 Nov 2026): `DateRangePicker`, `DateRangePickerCustom`, `GranularitySelect`, `ComparisonPeriodSelect`, `SingleSelect`, `MultiSelect`, `TextField`, each with a docs page, examples and builder defaults, and `dateRangePreset()` for a picker's starting value. The calendar and its locales load on demand.
  - [ ] A "Controls" guide with one worked example (date range, granularity and a multi select driving a line chart), and helpers: the options of a field from rows, and a comparison period's dates.
  - [ ] The filter builders, wrapped: plain `value` / `onChange` in place of `embeddableState`, one `loadOptions(field, search)` in place of the `filterResults<id>` props, and `applyFilters(rows, clause)` for in-memory data.
  - [ ] The dimension and measure pickers, which only need a list of fields.
  - Open: a date picker in another language draws after its date names load, so not in server HTML; the landing page loads 448 KB of JavaScript against a 450 KB budget.

## Phase 2: Docs site on Bklit's level (~4 days)

The takeaways from the Bklit review:

- [x] **One page per component** (`/docs/components/<id>`): live preview, install, what it does for you (derived from its props), examples, a props table with builder defaults, field options. The shadcn install tab waits for Phase 3.
- [x] **Named examples on every component page**, each with Preview/Code tabs and an "On this page" entry: 53 presets across the 25 components (1–5 each, beyond the default), each showing a real option (compact numbers, axis ranges, totals, percentages, “Other” buckets, colour scales, thresholds, auto height…), translated de/fr; plus an automatic "Other" example where `xAxisMaxItems` exists, and loading/empty/error. Docs-only presets (`docsOnly`) stay out of the gallery so it remains one screen per group.
- [x] **"Copy Markdown"** on every docs page. ("Copy prompt" shipped with it and was removed on 18 Nov 2026: it was not clear what it was for.)
- [x] **Docs split into pages** (Getting started / Guides / Components) with ⌘K search, path routing and per-page titles.
- [x] **Sell the benefits:** a "Why EmKit" page (the same card on react-chartjs-2 vs here, and a 12-row comparison of what a chart library leaves to you), the same side-by-side on the landing page, and a "What it does for you" list on every component page.
- [ ] **Hosting (Phase 5):** deploy on emkit.embeddable.com with an SPA fallback. For search engines, prerender each route to static HTML and add per-page meta descriptions and OG images; per-page titles are done.

## Phase 3: shadcn compatibility (~3 days; hosting the registry waits for Phase 5)

**How Bklit "extends" shadcn.** shadcn/ui isn't an npm package. It's a CLI and a **registry format**: `npx shadcn add <item>` fetches a JSON registry item, copies its source files into your project, installs the npm dependencies it lists, and adds its CSS variables. Anyone can host a registry. Bklit hosts one under the `@bklit` namespace (`npx shadcn add @bklit/area-chart`), and its charts use shadcn's theme tokens (`--chart-1`…`--chart-5`, `--background`, `--border`, `--radius`). So they match any shadcn app out of the box. Bklit also ships an npm package (`@bklitui/ui/charts`) that the copied files import. It's a hybrid.

Our version of the same hybrid:

- [ ] **Token bridge:** a stylesheet mapping shadcn tokens onto our semantic tokens (`--chart-1` → `--em-sem-chart-color--1`, `--background`, `--foreground`, `--muted-foreground`, `--border`, `--radius`, `--font-sans`), including `.dark`. Our charts then pick up any shadcn theme and its dark mode with no configuration.
- [ ] **Registry items:** one per component. Each one installs our npm package, copies a small wrapper file the user owns (pre-themed, editable), and adds the token bridge. Build them with `shadcn build` and host them on the docs site.
- [ ] **Register the namespace** in shadcn's public registry directory, so `npx shadcn add @<name>/bar-chart` works and the shadcn MCP server can browse us.
- [ ] **"Open in v0" buttons** on docs examples. These come free once the registry items exist.

## Phase 4: Available through Claude and other agents (~4 days, plus a spike; publishing waits for Phase 5)

- [ ] **`llms.txt` and `llms-full.txt`** generated from the docs. Also submit to Context7, which many coding agents query for library docs.
- [ ] **Agent Skill:** "use <name>", covering the data contract, choosing a chart, theming and the AI spec. Ship it and the build-component skill (next item) in the package and as a **Claude Code plugin** in a GitHub-hosted marketplace. Then apply to Anthropic's plugin directory, if submissions are open (check).
- [ ] **Port the build-component skill** (todo, noted 18 Nov 2026): bring Remarkable's `build-component` skill (`remarkable-pro-boilerplate/.claude/skills/build-component/`) to EmKit, so a chart someone adds follows the same patterns as the built-in ones. It must be modified to build in nothing Embeddable-specific: no `*.emb.ts` descriptors, builder inputs, `loadData`, dashboard variables or events, `embeddable:push`, or its sandbox template. In their place: plain React props, `dimension()` / `measure()` / `results()`, `<ChartsProvider>` and the `em-kit/build` toolkit. The rules that make a component match the library carry over (theme formatter, gap filling, chart colours, card wrapper, reusing the primitives).
- [ ] **MCP server** (`@<name>/mcp` on npm): tools to list components, get a component's docs and props, get an example, and validate a `ChartSpec`. It works in Claude Code, Claude Desktop, Cursor and others.
- [ ] **Spike, ~2 days: interactive charts inside Claude chat.** The MCP Apps extension lets an MCP server return UI that the host renders. `ChartFromSpec` and the intent loop are already built for this. Check which Claude surfaces support it before committing.

## Phase 5: Name, package and publish (~3 days, last)

Deliberately last (decided 2026-11-11): build and refine everything first, then name and package it once we're happy. The name is EmKit and code samples import from `em-kit` (since 17 Nov 2026); the package is not published, and the docs site runs locally.

- [x] **Pick the npm name.** `em-kit` (free on npm on 2026-11-17, as was `emkit`). `rkit` was dropped: it is "A UI component kit for React" by someone else, dormant since 2022. Only npm was checked, not trademarks.
- [ ] **Rename and host.** Done: `site/config.ts` and `package.json`, and the GitHub repo `embeddable-hq/em-kit` (private). Left: connect the repo in Vercel (`vercel.json` is in the repo) and point emkit.embeddable.com at it.
- [ ] **Library build** (tsup or Vite library mode): ESM plus `.d.ts`, CSS modules compiled into one `styles.css`, SVG assets inlined, `sideEffects` limited to CSS.
- [ ] **Subpath exports:** `.`, `./ai`, `./build`, `./styles.css`. This unblocks the `em-kit/ai` and `em-kit/build` imports the docs already show.
- [ ] **Works in Next.js App Router:** `'use client'` banners and no `window`/DOM access at import time. Prove it with a Next.js fixture app in CI.
- [ ] **Widen React support:** test React 18. The peer dependency is `>=19.1.1` today, which cuts out a large share of apps.
- [ ] **Bundle size:** register Chart.js controllers and plugins per chart, and add a `size-limit` budget per component.
- [ ] **Release hygiene:** Changesets, npm provenance, `publint` and `are-the-types-wrong` in CI, plus a changelog page.

## Phase 6: Launch

- [ ] **Comparison page:** us vs shadcn charts vs Bklit vs Tremor, feature by feature (colour stability, gap filling, i18n, states, export, tables, AI spec).
- [ ] **Launch channels:** X, Hacker News (Show HN), Product Hunt, r/reactjs, the shadcn community, and newsletters such as React Status and Bytes.
- [ ] **Social proof:** add testimonials and a "used by" strip once real users exist.

---

## Later: Beyond React (~1 week each)

- [ ] Web-component build (`<x-bar-chart>`) for Vue, Svelte, Angular and plain HTML. It also enables a no-build CDN script via jsDelivr/unpkg.
- [ ] Starter templates: a Next.js dashboard and an AI chat app (Vercel AI SDK and Anthropic SDK).

## Running order

| # | Phase | Estimate | Blocked by |
|---|---|---|---|
| 0 | Secure the work | 1 h | — |
| 1 | Component intake | 2 d | — (done, upstream PRs in review) |
| 2 | Docs site | 4 d | — |
| 3 | shadcn compatibility | 3 d | — (registry hosting: Phase 5) |
| 4 | Claude and agents | 4 d + spike | Phase 2 for `llms.txt` (publishing: Phase 5) |
| 5 | Name, package, publish | 3 d | Being happy with 2–4; npm name |
| 6 | Launch | 2 d | Phase 5 |
| Later | Beyond React | 1 wk each | Phase 5 |

That's about 3–4 weeks to launch. Phases 2–4 need no name; the working name stays until Phase 5.
