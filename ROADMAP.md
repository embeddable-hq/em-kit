# Roadmap: a standalone chart library that competes with shadcn charts and Bklit

Goal: Remarkable's components, freed from Embeddable, published everywhere a developer or an agent looks for charts. The pitch is **behaviour you don't have to build**: stable colour per value, date gap filling, granularity switching, comparison periods, number/date localisation, loading/empty/error states, CSV/XLSX/PNG export, and pivot and heat-map tables. shadcn charts give you Recharts and leave the wiring to you; Bklit gives you good-looking composable primitives. We give you the finished chart.

Work top to bottom. Each phase can ship on its own. Estimates assume one person.

---

## Decisions needed first (blocking)

1. ~~**Licence.**~~ Decided 2026-11-10: **MIT.** The upstream remarkable-pro and remarkable-ui repos are already public under MIT, so a no-resale licence on this package couldn't stop anyone reselling the same components taken from upstream. It would only add friction for users.
2. **Public name.** Gates npm, the GitHub repo, the shadcn namespace and the domain. Mason UI is a candidate. Avoid "remarkable" because of the reMarkable trademark.
3. **Embeddable's place in the brand.** Options: none, a "by Embeddable" footer, or an "upgrade to Embeddable for hosted data" path.
4. **Scope v1.** Charts and tables only, or also the standalone-safe editors (date range pickers, granularity and comparison-period selects)? Bklit has no editors, so these pair well with the charts.

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
- [ ] **Upstream fix loop:** open PRs on embeddable-hq/remarkable-pro and remarkable-ui (all rechecked against the 2026-11-10 sync, all still present). Each fix removes a workaround here.
  1. CSS variables are read from `document.documentElement` (`styles.utils.ts` `getStyleValue`), so a nested `ChartsProvider` can't restyle chart.js colours/fonts. (remarkable-ui)
  2. `hideMenu` hides the whole card header, title included. (remarkable-pro `ChartCard.tsx`)
  3. `TableScrollable` shows its first page twice under React StrictMode in dev (confirmed: 112 rows, 62 unique). (remarkable-pro)
  4. `TableChartPaginated` reads row/header heights at import time, so theme overrides are ignored. It no longer throws without a DOM. (remarkable-pro)
  5. KPI change percentages use `toFixed`, so German shows `+7.4%` instead of `+7,4%`. (remarkable-ui `KpiChartChange.tsx`)
  6. Scatter value and point labels are forced on, ignoring `showValueLabels`/`showPointLabels` (content rewrite here). (remarkable-pro)
  7. A host page's global `h2` font-size pins the KPI number and defeats auto-sizing (content rewrite here). (remarkable-ui)
  8. Not rechecked: y-axis labels clip their first character when a locale widens numbers (French `$7 000`).
- [x] **Builder defaults:** the sync found upstream's export menu is now opt-in, with its default set only in Embeddable's builder input, so standalone users silently lost CSV/PNG export. Fixed generally: the sync records every input's `defaultValue` from the definitions, and each exported component applies the ones that are props (`withDefaults`, type-checked with `satisfies`). Standalone charts now match Embeddable's out-of-the-box look, including value labels on bar, line, pie and scatter charts.
- [ ] **Editors (if in scope):** extend the shim so the standalone-safe editors sync. The Embeddable-bound pickers (dimension/measure selects, filter builder) stay excluded.

## Phase 2: A real npm package (~3 days)

- [ ] **Library build** (tsup or Vite library mode): ESM plus `.d.ts`, CSS modules compiled into one `styles.css`, SVG assets inlined, `sideEffects` limited to CSS.
- [ ] **Subpath exports:** `.`, `./ai`, `./build`, `./styles.css`. This unblocks the `charts-ui/ai` and `charts-ui/build` imports the docs already show.
- [ ] **Works in Next.js App Router:** `'use client'` banners and no `window`/DOM access at import time. Prove it with a Next.js fixture app in CI.
- [ ] **Widen React support:** test React 18. The peer dependency is `>=19.1.1` today, which cuts out a large share of apps.
- [ ] **Bundle size:** register Chart.js controllers and plugins per chart, and add a `size-limit` budget per component.
- [ ] **Release hygiene:** Changesets, npm provenance, `publint` and `are-the-types-wrong` in CI, plus a changelog page.

## Phase 3: shadcn compatibility (~3 days)

**How Bklit "extends" shadcn.** shadcn/ui isn't an npm package. It's a CLI and a **registry format**: `npx shadcn add <item>` fetches a JSON registry item, copies its source files into your project, installs the npm dependencies it lists, and adds its CSS variables. Anyone can host a registry. Bklit hosts one under the `@bklit` namespace (`npx shadcn add @bklit/area-chart`), and its charts use shadcn's theme tokens (`--chart-1`…`--chart-5`, `--background`, `--border`, `--radius`). So they match any shadcn app out of the box. Bklit also ships an npm package (`@bklitui/ui/charts`) that the copied files import. It's a hybrid.

Our version of the same hybrid:

- [ ] **Token bridge:** a stylesheet mapping shadcn tokens onto our semantic tokens (`--chart-1` → `--em-sem-chart-color--1`, `--background`, `--foreground`, `--muted-foreground`, `--border`, `--radius`, `--font-sans`), including `.dark`. Our charts then pick up any shadcn theme and its dark mode with no configuration.
- [ ] **Registry items:** one per component. Each one installs our npm package, copies a small wrapper file the user owns (pre-themed, editable), and adds the token bridge. Build them with `shadcn build` and host them on the docs site.
- [ ] **Register the namespace** in shadcn's public registry directory, so `npx shadcn add @<name>/bar-chart` works and the shadcn MCP server can browse us.
- [ ] **"Open in v0" buttons** on docs examples. These come free once the registry items exist.

## Phase 4: Docs site on Bklit's level (~4 days)

The takeaways from the Bklit review:

- [ ] **One page per component:** preview, install (npm and shadcn tabs), usage, then a props table generated from `site/generated/props.ts`.
- [ ] **Named variants on every chart page** (Stacked, Comparison, Loading, Empty, …), each with its own code, plus an "On this page" sidebar.
- [ ] **"Copy prompt" beside "Copy code"** on every example, and **"Copy Markdown"** on every docs page.
- [ ] **Docs split into pages** (Getting started / Guides / Components) with ⌘K search.
- [ ] **Hosting:** deploy on the new domain with OG images and per-page titles, so search engines index each chart.

## Phase 5: Available through Claude and other agents (~4 days, plus a spike)

- [ ] **`llms.txt` and `llms-full.txt`** generated from the docs. Also submit to Context7, which many coding agents query for library docs.
- [ ] **Agent Skill:** "use <name>", covering the data contract, choosing a chart, theming and the AI spec. Port remarkable-pro's build-component skill alongside it. Ship both in the package and as a **Claude Code plugin** in a GitHub-hosted marketplace. Then apply to Anthropic's plugin directory, if submissions are open (check).
- [ ] **MCP server** (`@<name>/mcp` on npm): tools to list components, get a component's docs and props, get an example, and validate a `ChartSpec`. It works in Claude Code, Claude Desktop, Cursor and others.
- [ ] **Spike, ~2 days: interactive charts inside Claude chat.** The MCP Apps extension lets an MCP server return UI that the host renders. `ChartFromSpec` and the intent loop are already built for this. Check which Claude surfaces support it before committing.

## Phase 6: Beyond React (later, ~1 week each)

- [ ] Web-component build (`<x-bar-chart>`) for Vue, Svelte, Angular and plain HTML. It also enables a no-build CDN script via jsDelivr/unpkg.
- [ ] Starter templates: a Next.js dashboard and an AI chat app (Vercel AI SDK and Anthropic SDK).

## Phase 7: Launch

- [ ] **Comparison page:** us vs shadcn charts vs Bklit vs Tremor, feature by feature (colour stability, gap filling, i18n, states, export, tables, AI spec).
- [ ] **Launch channels:** X, Hacker News (Show HN), Product Hunt, r/reactjs, the shadcn community, and newsletters such as React Status and Bytes.
- [ ] **Social proof:** add testimonials and a "used by" strip once real users exist.

---

## Running order

| # | Phase | Estimate | Blocked by |
|---|---|---|---|
| 0 | Secure the work | 1 h | — |
| 1 | Component intake | 2 d | — |
| 2 | npm package | 3 d | Name, licence |
| 3 | shadcn registry | 3 d | Phase 2 |
| 4 | Docs site | 4 d | Phase 2 for install commands |
| 5 | Claude and agents | 4 d + spike | Phases 2 and 4 |
| 6 | Beyond React | 1 wk each | Phase 2 |
| 7 | Launch | 2 d | Phases 2–5 |

That's about 3–4 weeks to launch. Phase 1 can start now, while the name and licence are decided.
