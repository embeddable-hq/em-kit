# Site quality push: progress

Goal (set 16 Nov 2026): raise the docs and marketing site to 9/10 or better
against `site/STANDARDS.md`, clear for developers, readable by LLMs and agents,
not repetitive, with a clean navigation structure. Nothing here is committed
yet.

## Where it stands

| Step | State |
|---|---|
| Research: 20 chart and component library sites | Done. Findings are the bracketed sources in `site/STANDARDS.md`. |
| Standards and scoring rubric | Done: `site/STANDARDS.md` (8 categories, pass = 9.0 weighted and none below 8). |
| Baseline score by two independent reviewers | Done: 4.4/10 overall. Developer lens 5.0 (A 4.5, B 6.5, C 3.5, D 6.5, E 5.5, F 3.0, H 4.5). Agents (G) 1.0. |
| URL structure | Done. See below. |
| Round 1 fixes | Done: seven agents, one area each (agent endpoints and static build, navigation, component pages, landing, guides, code samples, chart quality). |
| Static build with prerendered HTML | Done: `npm run site:build` writes `dist-site/` (44 pages, 75 playground pages, `.md` twins, llms.txt, llms-full.txt, sitemap, robots, redirects, 404). `npm run site:check` asserts it and is part of `npm run check`. `npm run site:preview` serves it on port 5311. |
| Integration after round 1 | Done: 3,370 tests pass, `tsc` clean, `site:check` clean. 700 lines of dead CSS removed from `site/site.css`. |
| Round 2 score | Done: 7.7/10 overall. A 7.8, B 7.0, C 8.2 (8.0 agent's view), D 7.8, E 8.7, F 8.0, G 7.8, H 6.3. Reports: `r2-developer-lens.md`, `r2-agent-lens.md` in the session scratchpad. |
| Round 2 fixes, wave 1 | Done: docs accuracy (provider error, field defaults, `inputs.granularity`, exported payload types, table export), guides and agent files (Getting started is now Quick start, Why, Troubleshooting), landing (like-for-like comparison, proof on the page), search (props indexed) and wayfinding, route-level code splitting. 3,745 tests pass. |
| Round 2 fixes, wave 2 | Done: chart previews (KPI comparison, funnel, pivot, KPI tabs, donut), example code (no line over 90 characters, excerpts with "Show full code", rows printed = rows shown, keyboard tables). Sample time fields renamed to `startDate`, `visitDate`, `orderDate`. |
| Round 3 score | Done: about 8.1/10. A 8.7, B 8.0, C 8.8 (7.0 agent's view), D 8.5, E 8.7, F 8.5, G 8.2, H 6.0. Reports: `r3-developer-lens.md`, `r3-agent-lens.md`. Biggest finds: the package throws on import outside a browser (breaks Next.js server rendering); search overlay trapped in the header; heat-map text contrast; unnamed chart menu buttons. |
| Round 3 fixes | Done: the package now imports and server-renders without a browser (Next.js App Router works with `'use client'` files and a pinned locale; HeatMap needs hex colours); funnel labels use field formatting; payload types printed from the real types; component HTML carries all of its Markdown; `_headers`, og:image, served-site check; search overlay fix; text-only guides load 145 KB of JS (was 428); chart menus and canvases named; heat-map contrast; palette; translations; clipped markers; funnel width. 4,900 tests pass. |
| Round 4 score | Done: about 8.0/10. A 8.7, B 7.5, C 8.8, D 8.0, E 9.0, F 6.5, G 8.7, H 6.8. Every agent-lens **must** passes. Concision fell because round 3 put setup blocks on all 25 component pages; the conflict is now settled in `site/STANDARDS.md` ("Settled conflicts between checks"). |
| Round 4 fixes (agents) | Stopped on 17 Nov at Henry's request: scores had plateaued at about 8 because each fresh reviewer found new issues and parallel fixes undid each other. |
| Direct fixes to reach 9 | Done by the main session, no new review rounds: (1) component pages: skeleton plus one install line, setup only on the quick start; (2) library defaults in `src/theme.ts` and sync rewrites: six-tick axes, no one-entry legends, date axes skip labels instead of tilting, readable KPI tabs, focus-visible table copy buttons, named heat-map cells, picker relabels on language change, optional pivot and date-range props, click payload types that match what is passed; (3) landing, chrome, previews: comparison full width, gap demo, skip link, View-code panel, consistent example data; (4) docs accuracy: prop notes corrected at source, Markdown redirects, Next.js path, troubleshooting; (5) `npm run audit` (below). 4,906 tests pass. |
| Audit | `npm run audit` (add `-- --themes` for German with the Mono theme): headless Chrome over every built page at 1440 and 390 px, checking console errors, sideways scroll, headings, AA contrast, accessible names, keyboard stops, the skip link and chart axes. First run: 9 findings; after fixes: 45 pages clean. |
| Confirming review (r5) | Done, scored by the standard's own scale with derivations: A 9.5, B 9.5, C 10 (developer) / 9.0 (agent), D 9.0, E 9.5, F 10, G 9.0, H 6.0. H failed on two bugs introduced by the new chart defaults in `src/theme.ts`: the stacked area chart no longer stacked, and scatter and bubble y-axes took the x-axis's options. Reports: `r5-developer-lens.md`, `r5-agent-lens.md`. |
| After the review | Both bugs fixed (an axis object per axis; a sync rewrite so the area chart deep-merges theme options) and guarded by `tests/chartDefaults.test.tsx`, which draws every chart with and without the defaults and requires everything but ticks and one-entry legends to be identical (it fails on 8 charts with the bugs put back). Also fixed from the review: troubleshooting width entry, server-render exceptions (both donuts), accessibility guide, threshold notes, old preset URLs redirecting, examples header. |
| Final scores | **9.5 weighted, no category below 9.0.** A 10, B 10, C 9.0 (agent's view; 10 developer's), D 9.0, E 9.5, F 10, G 9.0, H 9.5. The developer reviewer re-verified the two bug fixes and re-derived H (6.0 to 9.5) in a follow-up appended to `r5-developer-lens.md`. Checks on the final state: `tsc` clean, 4,985 tests, `site:check`, `npm run audit -- --themes` clean on 45 pages. Baseline was 4.4. |

| Henry's review (18 Nov) | Done: a new visit always opens in English (the language choice now lasts for the browser session only); `charts-ui` replaced by `rkit` everywhere; "Copy Markdown" is now "Copy page as Markdown" and says what it is for once clicked; the theme switcher is Default, Cool, Mono and Uluru from embeddable.com; the landing's "Done for you" section is eight detailed items with the live state-switch card, and the two-file code comparison moved to the Why page. |
| Henry's second review (17 Nov, later) | Done: Uluru is a dark theme, with the values embeddable.com's panel sets (all ten colours, backgrounds, text); every site button shows the pointer cursor; `npm run audit -- --themes` also visits chart pages in Uluru. Open: the npm name. `rkit` is taken (checked again 17 Nov); `@embeddable.com/rkit` is free. |
| Henry's third review (17 Nov) | Done: a hovered KPI tab keeps a dark background on a dark theme (the hover colour was a fixed light grey; it now follows the theme, in `src/theme.ts`); a stray "window is not defined" error between hydration tests is gone; `vercel.json` added (build command, output folder, content types). Vercel does not read `_redirects`: old URLs are still covered by the redirect pages the build writes, as page redirects rather than 301s. Open: the npm name (`remarkable-kit` and `@embeddable.com/rkit` are both free), then rename, push to `embeddable-hq`, connect Vercel. |
| Name and repo (17 Nov) | Done: renamed to EmKit (`em-kit`, emkit.embeddable.com) across the site, package, storage keys, share image and notes. Rows above that say RKit or `rkit` record the name at the time. |

## Decisions made on the way

- **One page per job.** The Gallery (`/charts`) is merged into the components
  index (`/docs/components`). The playground moved under each component:
  `/docs/components/<slug>/playground`. Old URLs redirect.
- **Component URLs** are the kebab-case export name: `BarChartStacked` →
  `/docs/components/bar-chart-stacked`. Old ids (`/docs/components/bar`), export
  names and display names redirect. Logic and redirects: `site/content/routes.ts`,
  tested in `tests/routes.test.ts`.
- **Guide slugs** renamed to match their titles (`data` → `describing-your-data`,
  `time` → `time-series`, `states` → `loading-empty-and-errors`, `build` →
  `build-your-own-chart`), with redirects.
- `site/docs/` is now `site/content/`: the old folder name collided with the
  `/docs/...` routes, so the dev server served source files to non-browser
  requests.
- **Card titles are `<h3>`**, not `<h1>` (a page of charts had many H1s). Done as
  four content rewrites in `scripts/sync.mjs`, applied to the generated files by
  hand so no sync was needed. The KPI number and empty/error titles keep their
  tag but lose heading semantics. Worth proposing a `headingLevel` option upstream.
- The site URL for canonical links, llms.txt and the sitemap is `BRAND.url` in
  `site/config.ts` (`https://emkit.embeddable.com`).
- **The name is EmKit** (Henry, 17 Nov): npm package `em-kit`, site emkit.embeddable.com, repo
  `embeddable-hq/em-kit`. It replaces RKit, dropped because `rkit` on npm is someone else's
  React UI kit. Name, package name and URL are `BRAND` in `site/config.ts`.
- **Component pages carry the install command once, inline** in the usage line
  (no Installation section). The Markdown twin has the full install block.
- **Docs examples leave out event handlers** (`omitHandlers` in
  `site/catalog/build.ts`); the playground keeps them beside its event log.
- **Playgrounds are real static pages** in the build (one per component and
  preset), so a plain static host answers 200. They have no Markdown twin and
  are not in the sitemap.
- **The package's default look** (`src/theme.ts`, applied in
  `src/ChartsProvider.tsx`): upstream's colours (the "Default" palette on
  embeddable.com) on a white card with a hairline border, plus the font
  fallback stack, the KPI number cap, AA-contrast axis labels and KPI change
  colour, and the chart defaults (six ticks, no one-entry legend). Pasted code
  renders what the previews show. The violet palette tried earlier is gone
  (Henry, 18 Nov).
- The site's theme switcher is Default, Cool, Mono and Uluru, the palettes of
  the "Style your charts" panel on embeddable.com (`site/catalog/themes.ts`).
  That panel shows five colours a palette; colours six to ten are derived here.
- **Landing page:** the differentiator is told as what each component handles
  (eight items, a sentence or two each), with one live card whose state can be
  switched. The code comparison is on `/docs/why`. The word limit for the
  landing is 600 (`site/STANDARDS.md`).
- **Field option defaults are documented as the package applies them**, not as
  the Embeddable builder does (for example `connectGaps`). The alternative,
  applying the builder's defaults in the package, is open. **Confirm with Henry.**
- **Export libraries load on demand.** `exportXLSX` and `exportPNG` in the
  generated sources now use `await import()` for `xlsx` and
  `dom-to-image-more`, through four `contentRewrites` in `scripts/sync.mjs`
  (applied by hand, no sync run). The library's cost on load fell from about
  422 KB to 256 KB gzipped. Worth proposing upstream. Markdown (49 KB) still
  loads up front: the upstream component renders it synchronously.
- **Site pages are route chunks** (`site/App.tsx`); `site:check` enforces a
  450 KB gzipped budget per page. `npm run size` measures the library.
- `scripts/site-build.mjs` uses its own Vite cache (`node_modules/.vite-site-build`):
  sharing the dev server's cache made every build break the dev server.
- The peer dependency is stated as "React 19.1.1 or later" everywhere, matching
  `package.json`.

## Found in the library, for upstream (remarkable-ui / remarkable-pro)

- German funnel labels print `4,820` and pie percentages `31.8%`: not localised.
- The chart card leaves its 36px menu only the card's padding, so with smaller
  padding a long title runs under the menu.
- The donut's centre total is sized from the line-height token and can shrink
  until it touches the ring (German totals on small cards).
- `exportXLSX` / `exportPNG` could use `await import()` upstream (done here with
  sync rewrites); the Markdown renderer (49 KB gzipped) could load lazily too.
- Card titles as `<h1>` and KPI values as `<h2>`: worth a `headingLevel` option.
- A heat map with an empty cell mismatches on hydration (`#fff` on the server,
  the token's colour in the browser).
- The default scatter chart's value labels squeeze the plot in a small card.
- The KPI comparison renders its change line twice (a hidden copy used to
  measure the auto-sized number); a screen reader may read it twice.
- All library fixes made here through `scripts/sync.mjs` rewrites are written
  up for upstream in `UPSTREAM.md` at the repo root.

## For Henry to decide or tidy

- **EmKit's place in Tom's Claude Code plan** (17 Nov): EmKit, not Remarkable Pro,
  is the installable library the plan needs. Before the site goes public: add
  "by Embeddable" and a bridge page to the platform, and ask Tom to have the
  probe count EmKit. Package build, README and the Claude Code plugin come later.
- `site/catalog/aiSnippets.ts`: `aiLandingSpec` is no longer used by the landing
  (only by its test); an edit to it was also blocked by the permission check.

## Left as minor (each named by the last review, none blocks the score)

- Cool and Mono are palette-only on the package's white card. On embeddable.com (light mode) they also tint the card and text, and their first colours differ (Cool `#2a34b2`, `#4650c8`; Mono `#181818`); the panel sets every value as `--em-*` variables on `<html>`. Uluru was matched in full; these two were left as Henry approved them.

- KPI-tab line charts: the top tick label sits 3px under the tab border.
- Pivot "Sub-rows on demand" shows its whole 66-line module (no excerpt).
- Search opens a prop's result at `#props`, not at the prop's row.
- In German, a stacked bar chart's date labels tilt at desktop width.
- `results` is shown as required on six grouped and stacked pages where the
  type has it optional (deliberate: without it the card is empty).

## Not done on purpose

- No sync from upstream was run. Upstream `origin/main` has moved since the last
  sync (11 Nov); run `npm run sync` separately.
- No MCP server or shadcn registry (roadmap phases 3 and 4). The standards mark
  them "nice to have, not scored yet".
