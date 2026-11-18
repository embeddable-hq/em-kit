# Site standards

What the EmKit site has to do, and how it is scored. The standards come from a
review of 20 chart and component library sites (16 November 2026); the source
of each rule is in brackets. The site passes when the weighted score is 9.0 or
more and no category is below 8.

Readers, in priority order:

1. A developer deciding whether to use EmKit (2 minutes on the landing page).
2. A developer building with it (looking things up, copying code).
3. An LLM or coding agent doing either job over plain HTTP, with no JavaScript.

## How to score

Score each category 0 to 10 against its checks. A check is pass, partial or
fail. 10 means every check passes and nothing on the page gets in the way;
9 means one minor partial; 8 means one fail or two partials on minor checks;
6 means a check marked **must** fails; below 5 means several do.

| # | Category | Weight |
|---|---|---|
| A | Landing page: the pitch | 15% |
| B | How the charts are shown | 15% |
| C | Time to first chart | 10% |
| D | Component pages | 15% |
| E | Navigation and structure | 10% |
| F | Concision | 10% |
| G | LLMs and agents | 15% |
| H | Craft | 10% |

## A. Landing page: the pitch

- **Must:** the headline and one sentence under it say what EmKit is, who it is
  for and why it differs from a chart library. No jargon. [Tremor, Recharts]
- **Must:** a live, interactive chart is visible without scrolling on a
  1440×900 screen. [Recharts, Tremor]
- **Must:** the install command, with a copy button, is on the landing page
  above the fold. [Victory, Bklit]
- **Must:** every benefit claim is backed on the page by something the visitor
  can see: a live demo, code, or a number that can be checked. No unsourced
  metrics, no "beautiful", "powerful", "effortless". [Avoid: Highcharts' claims
  without code, MUI's "Users 144k", Ant's "truly good by default"]
- The page shows the range of chart types, live, within two screens of the top.
  [shadcn /charts, MUI overview]
- The main differentiator (finished components against a raw chart library) is
  told as what each component handles for you, each item in a sentence or two
  that says exactly what is done, with a live card whose states the visitor
  can switch. The pitch is that every card is finished, and finished the same
  way; the landing page gives no line counts. The side-by-side with real code,
  and its line counts, are on the "why" page, one click away. [Owner's review,
  18 Nov 2026: robustness sells it, not line counts. Test app, 17 Nov 2026:
  built both ways, a four-card dashboard came to about as many lines; what
  differed was the finish. Bklit benchmarks as proof]
- No more than seven sections. Each has one job and one call to action at most.
  [Avoid: Highcharts' and Tremor's long pages, Chart.js' changelog as landing]
- Two calls to action in the hero: get started, and see the components.

## B. How the charts are shown

- **Must:** every chart on the site is the real component, rendering live, with
  tooltips and clicks working. No screenshots. [Avoid: Ant Design's images]
- **Must:** one page shows every component as a live preview, grouped by type,
  with the count per group, and each preview is one click from its docs and its
  code. [shadcn /charts, Recharts examples, MUI overview]
- Sample data looks like real product data (named regions, plans, months,
  currency), not `foo`, `uv`, `pv`. [Avoid: Recharts' uv/pv, Mantine's one
  dataset everywhere]
- Previews are sized to their content: no card that is mostly empty space, no
  rotated or clipped labels in a default preview.
- The visitor can change theme, language and dataset and watch every chart
  follow, because that is the claim being sold. [MUI playground controls]
- Loading, empty and error states can be seen, not only described. [Bklit
  loading state]
- Each preview has "copy code" within reach. [shadcn "Copy" / "View Code" on
  each card]

## C. Time to first chart

- **Must:** install is one command, shown for npm, pnpm, yarn and bun, with
  peer dependencies stated. [shadcn, Bklit, Evil Charts]
- **Must:** the quick start reaches a working chart in three steps or fewer,
  and the first chart is on the quick start page itself. [Avoid: Mantine's
  getting started with no chart, MUI's chart after four sections]
- **Must:** every code example runs as pasted: imports, sample data and render
  together. No pseudo-code, no `...`. [Geist, Chart.js]
- The first example uses nothing optional. [Avoid: Recharts' devtools import
  in step 1]
- Setup mistakes are named by their symptom ("charts render unstyled: you
  missed the provider"). [Mantine's "Do not forget to import styles"]
- One install path. No second, conflicting way to install. [Avoid: Tremor Raw
  against @tremor/react]

## D. Component pages

- **Must:** the same order on every page: title and one-line purpose, live
  preview, usage code, examples, props. [Bklit, Chakra, Tremor]
- **Must:** props are a table of name, type, default and description, on the
  page itself, complete and generated from the types. [Bklit, MUI API pages.
  Avoid: Chakra and Tremor delegating props to Recharts]
- **Must:** each example has a short descriptive title, a live preview and its
  code, with a copy button. [Tremor, Chakra, Mantine]
- Examples show one feature each, in 10 to 25 lines, ordered basic to advanced.
  [Mantine. Avoid: Mantine's 40 flat sections, Tremor's 300-line dumps]
- Prose is one to three sentences per section. [MUI, Mantine]
- "Copy page as Markdown" on every page, once. [Bklit, shadcn, Mantine "LLM
  documentation"]
- Previous and next links at the foot, and an "On this page" list. [shadcn,
  Bklit, Chakra]
- Accessibility (keyboard, screen reader) is documented where it applies.
  [Mantine key table, ECharts]

## E. Navigation and structure

- **Must:** a visitor reaches any component's docs in two clicks from the home
  page. [Bklit, Tremor: 2. shadcn: 3]
- **Must:** search opens with ⌘K and finds components, examples and guide
  sections. [shadcn, Bklit, Chakra, Mantine]
- **Must:** every page has one home in the navigation. No two pages do the same
  job (for example a gallery and a components index). [Avoid: Tremor's two
  install models]
- Top navigation has five items or fewer. [Tremor, Chakra]
- The sidebar has three levels at most, in the order a newcomer needs: getting
  started, guides, components by type. [Recharts' guide by task, MUI]
- Pages follow one of four types and do not mix them: tutorial (quick start),
  how-to guide, reference (component pages), explanation (why). [Diátaxis]
- URLs are stable, lower-case and predictable from the component name. Old
  URLs redirect.
- Works at 390px wide: navigation reachable, no sideways scrolling.

## F. Concision

- **Must:** no block of content appears on more than one page. A second page
  links to the first. [Diátaxis. Avoid: shadcn and Recharts re-pasting the
  whole chart at each tutorial step]
- **Must:** no boilerplate section repeated on every component page beyond the
  fixed skeleton (preview, usage, examples, props).
- A benefit is stated once on the landing page, in a sentence or two. The
  "why" page holds the comparison with a chart library, need by need and in code.
- No button or control appears twice on one page.
- Landing page copy is under 600 words outside code (the benefits section
  carries the detail). A component page's prose
  is under 250 words outside code and tables.
- No status clutter: no roadmap lists, "coming soon" or changelog on pages that
  sell or teach. [Avoid: MUI's 13 planned charts, Tremor's "Updating Soon"]

## G. LLMs and agents

Tested with `curl`, no JavaScript.

- **Must:** `/llms.txt` follows llmstxt.org: an H1, a blockquote summary, H2
  sections of `- [name](url): description`, and a final `## Optional`. The
  sections mirror the sidebar. [shadcn, Bklit, Mantine]
- **Must:** every link in `/llms.txt` returns 200 and is Markdown, not HTML.
  [Stripe, Mantine. Avoid: MUI's 404 and wrong-content `.md`]
- **Must:** every docs page has a Markdown twin at the same URL plus `.md`.
  [Geist, Stripe, llmstxt.org]
- **Must:** the HTML of every page contains its real content without
  JavaScript: prose, code, install command, prop names. [Avoid: visx's empty
  body, Evil Charts' 328 characters]
- **Must:** a component's Markdown page is self-contained: purpose, install,
  a complete example with imports and data, and the full props table.
- `/llms-full.txt` holds every page as Markdown, each with its title and URL.
  [Mantine, Chakra, Anthropic]
- Each HTML page has `<link rel="alternate" type="text/markdown">`, a
  canonical URL, a unique title and a meta description. [llmstxt.org]
- `sitemap.xml` and `robots.txt` exist and list or allow the docs.
- A "Use with AI" page tells a developer how to point Claude Code, Cursor and
  ChatGPT at the docs, in one command or link each. [shadcn MCP page, Chakra
  "AI tip", Stripe]
- A check in the test suite fetches or builds every `.md` URL and every
  `llms.txt` link, so they cannot go stale. [Avoid: MUI]
- Nice to have: an MCP server, a shadcn-style registry. Not scored yet; both
  are on the roadmap.

## H. Craft

- **Must:** no visible bug in any default view: wrong font, clipped text,
  overlapping labels, blank chart, console error.
- **Must:** keyboard reachable throughout, visible focus, a skip link, one H1
  per page, headings in order, WCAG AA contrast.
- Consistent type, spacing and component styles across landing, docs and
  gallery.
- Fast: the first screen does not wait on every chart on the page.
- Dates, counts and commands on the site are correct and agree with each other
  (component count, package name, versions). [Avoid: Bklit's two registry
  hosts, Tremor's two copyright years]

## Settled conflicts between checks

- **Component pages: HTML for people, Markdown for agents.** The HTML page
  holds the fixed skeleton (preview, usage, examples, props) and one inline
  install command; setup (peer dependencies, provider, height, frameworks,
  states, field options) lives once, on the quick start and the guides, and the
  HTML page links there. The Markdown twin is self-contained, so it carries that
  setup too (G). An HTML page holding less setup prose than its twin is
  correct, not a G failure. Code, prop names and example notes must be in both.
- **Library defaults count.** A crowded or unclear chart in a default preview
  (too many ticks, a one-entry legend) is a B or H finding even when it comes
  from the library, because the site sells those defaults. Fix it in the
  package's own default theme (`src/theme.ts`) or through a sync rewrite, not
  by overriding it on the site.

- **Phones tilt, desktops do not.** Below 768px wide, a chart may tilt long
  category labels (Chart.js does so rather than hide them). At desktop widths
  no default preview tilts a label.
- **The audit is the gate for the musts it can measure.** `npm run audit`
  checks console errors, sideways scroll, headings, contrast, accessible names,
  keyboard stops, the skip link and chart axes on every page. A reviewer's
  score is not final while the audit reports a finding.

## Known and out of scope

- There is no "Copy prompt" button. It was on every component page until 18
  November 2026 and was removed after the owner's review: it was not clear what
  it was for. "Copy page as Markdown" is the one way to hand a page to an
  agent. Do not mark its absence down, and do not add it back.

- The npm package name in code samples is `em-kit`, not yet published. The display
  name is EmKit. Do not mark this down.
- There are no customer logos, stars or download counts to show before launch.
  Do not invent them. Proof comes from live demos and code.
