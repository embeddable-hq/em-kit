# For upstream (remarkable-ui and remarkable-pro)

Library fixes made in this repo through `contentRewrites` in `scripts/sync.mjs`,
written up so they can become upstream pull requests, plus library issues found
and not fixed here. Each rewrite that lands upstream can be deleted from
`scripts/sync.mjs` after the next sync. Later additions (17 Nov 2026), not yet
described below: the area chart merges theme options as their own argument
(any theme `scales` used to drop `stacked`); `GranularitySelectField` re-labels
when the language changes; the pivot table's `expandedRowKeys` and
`setExpandedRowKey` are optional; `measureValues` is in the bar and line click
payload types; table cell copy buttons show on focus; clickable heat-map cells
have an accessible name.

# Upstream changes from EmKit (server rendering, funnel labels)

EmKit carries these as `contentRewrites` in `scripts/sync.mjs`. Each one can be dropped once the matching change lands upstream.

## remarkable-ui: let `getStyleNumber` run without a DOM

File: `src/styles/styles.utils.ts`

`getStyleValue` already returns `''` when there is no `document`, but `getStyleNumber` then calls `getComputedStyle(document.documentElement)` unguarded to read the root font size. Any server render (Next.js App Router, Remix, Astro, `renderToString` in Node) throws `ReferenceError: getComputedStyle is not defined`. It throws at import, because remarkable-pro's `TableChartPaginated` calls `getStyleNumber` at module level, and in render, because many chart option builders call it too.

```diff
-  const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
+  const rootFontSize =
+    typeof document === 'undefined' ? 16 : parseFloat(getComputedStyle(document.documentElement).fontSize);
```

Nothing changes in a browser. On a server, `rem` fallbacks resolve against the default 16px root.

## remarkable-pro: no `navigator` at import

File: `src/theme/formatter/formatter.constants.ts`

```diff
-  locale: navigator.language,
+  locale: typeof navigator === 'undefined' ? 'en-US' : navigator.language,
```

Node 21+ has a `navigator`. Node 20 and some edge runtimes don't, so importing the package throws there. `getLocale` already falls back to `en-US` for an invalid locale.

## remarkable-pro: funnel value labels use the measure's formatting

File: `src/components/charts/funnel/FunnelChartPro/FunnelChartPro.utils.ts`

The tooltip formats the count with `themeFormatter.data(countMeasure, value)`, so prefix, currency, decimal places and the theme locale apply. The value labels used `value.toLocaleString()`: with `inputs: { prefix: '$', decimalPlaces: 2 }`, the labels read `1,300` while the tooltip read `$1,300.00`. Both label paths now use the tooltip's formatter:

- `getFunnelOptionsDatalabelsFormatter(config, formatValue = (v) => v.toLocaleString())` takes an optional value formatter. Section labels print `Leads: $1,300`.
- Without section labels, `getFunnelChartProOptions` sets `datalabels.formatter` to the same formatter. When `displayPercentages` is on, it leaves the remarkable-ui formatter in place, so percentages print as before.

```diff
 export const getFunnelOptionsDatalabelsFormatter =
-  (config: Partial<FunnelChartProProps>) => (value: number, context: Context) => {
+  (
+    config: Partial<FunnelChartProProps>,
+    formatValue: (value: number) => string = (value) => value.toLocaleString(),
+  ) =>
+  (value: number, context: Context) => {
 ...
-      : value.toLocaleString();
+      : formatValue(value);
 ...
-  if (!options.showSectionLabels) return base;
+  // Value labels use the measure's formatting, as the tooltip does.
+  const formatValue = (value: number) => themeFormatter.data(countMeasure, value);
+  if (!options.showSectionLabels) {
+    if (options.displayPercentages) return base;
+    return { ...base, plugins: { ...base.plugins, datalabels: { formatter: formatValue } } };
+  }
 ...
-        formatter: getFunnelOptionsDatalabelsFormatter(options),
+        formatter: getFunnelOptionsDatalabelsFormatter(options, formatValue),
```

remarkable-ui's own `getFunnelDatalabelFormatter` (`funnel.utils.ts`) still uses `toLocaleString()`. Standalone users of the UI `FunnelChart` would need a `valueFormatter` prop. EmKit does not need one: it only exports the Pro component.

## Proposed, not carried as rewrites

1. **HeatMap colours differ between server and browser.** `HeatMap` and `HeatMapPro` compute cell `background` and `color` during render, from `getStyle('--em-tablechart-heatmap-color', '#FF5400')` and from `resolveCssColorToHex`, which needs the DOM. A server render uses the `#FF5400` fallback, giving cells like `#ff7c3c`. The browser uses the theme colour, `#a683f8` with the default theme. React does not patch attribute mismatches when it hydrates, so the cells keep the server's colours. Seen in Chrome against plain-Node server HTML. Possible fixes:
   - Resolve the default colours after mount (state set in an effect).
   - Resolve them from the theme object instead of computed styles.
   - Accept that cells render without colour on the server.

   Hex `minColor`, `midColor` and `maxColor` already hydrate cleanly.
2. **Move `TableChartPaginated`'s module-level sizes into the component.** `headerHeight`, `rowHeight` and `footerHeight` are read at import, before any provider has injected the theme's CSS variables. A theme that changes `--em-tablechart-cell-height` or `--em-tablechart-pagination-height` is therefore never used for the rows-per-page calculation. Reading them in render, or in the resize hook, fixes that.
3. **Theme variables on the server.** `injectCssVariables` runs only in the browser. Server HTML is therefore styled by the CSS-module fallbacks until the client renders. A provider that also renders the variables as a `<style>` element, or a static stylesheet of the defaults, would remove that flash.
4. **Package entry.** Add `'use client'` to the published entry, so App Router users need it only on their own files.

## Round 3, accessibility and polish (carried as contentRewrites in scripts/sync.mjs)

Each one can be dropped once upstream has the change. Tests: `tests/libraryPolish.test.tsx`; the heat map is now in `tests/hydration.test.tsx`.

remarkable-ui:
- **KPI number and empty/error title**: `<div>` with a class (`styles.kpiChartValue`, `styles.title`) instead of `<h2>`; the CSS modules select the class. Replaces the earlier `role="presentation"` and `font-size: inherit` rewrites. Upstream: drop the h2s.
- **Heat map text colour** (`getCellColor`): white only where it reaches 4.5:1 on the cell, else `#212129`, else black. The YIQ cut-off put white 12px text on mid-tones at 3.7:1.
- **Horizontal bar labels**: `afterTickToLabelConversion` cuts y labels to the width Chart.js allows the axis, with "…". Upstream could offer it for every category axis.
- **Funnel width**: `scales.x.bounds: 'data'`, so the widest step spans the drawing area instead of ending at the next round tick.

remarkable-pro:
- **Card menu button** named `charts.menuLabel` ("Chart menu: {{title}}"); keys live in EmKit's `src/i18n/additions.ts` and `fr.ts`. Upstream: add the keys to en/de.
- **Canvas names**: ChartCard names every canvas in the card after title and description, with a MutationObserver (a donut mounts its canvas after the card). Upstream fix is cleaner: pass `aria-label` through the remarkable-ui chart components to `<Chart>` (react-chartjs-2 spreads it onto the canvas).
- **i18next**: `showSupportNotice: false`. Separately, the package calls `init` on i18next's default instance, which a host app using i18next shares; `i18n.createInstance()` would isolate it.
- **Comparison series label**: `charts.previousPeriodSeries` ("{{label}} (previous period)") instead of `common.compared` + label ("Compared Customers", "Verglichen Kunden").
- **Heat map default colour** from the theme object (following `var()`), with `getStyle` as the last fallback. Server and browser cells now match (checked: 12/12 identical in Chrome vs plain-Node HTML).
- **Percentages** (`getDatalabelPercentage`): `Intl.NumberFormat` percent in `theme.formatter.locale` ("31,8 %"), decimalPlaces kept exactly ("10.0%"); pies, bars and bar-line pass the locale.
- **Line clipping**: a pinned y range clipped all four sides (`clip: true`), halving the first and last markers; now `{ left: false, right: false, top: 0, bottom: 0 }` in the default, grouped and comparison lines.

## Still for upstream (not carried)

1. **A data summary for screen readers.** Canvases now have a name, not the values. Proposal: ChartCard renders a visually hidden table (or summary) from `data` and `dimensionsAndMeasures`, linked with `aria-describedby`; it already has both for CSV export.
2. **Empty heat map cells** still take `getStyle('--em-tablechart-cell-background', '#fff')` from the DOM: `#fff` on a server, the theme value in a browser, so a heat map with gaps can still mismatch on hydration.
3. **Other percentages ignore the locale**: funnel percentages (`funnel.utils.ts` and `FunnelChartPro.utils.ts`, `toFixed(1)%`), KPI change, pivot table and KPI-tab percentages. remarkable-ui has no locale; it needs a formatter prop.
4. **Other English-only or unnamed controls**: the card header tooltip button is `aria-label="Info"`; the ChartTabs scroll chevrons have no name; table sort and pagination labels are English.
5. **KPI tab hover background is a fixed colour.** `--em-charttabs-item-background--hover` is `#f7f7f8` (remarkable-pro), so on a dark theme a hovered tab is near-white under white text. EmKit sets it to `var(--em-sem-background--light)` in `src/theme.ts`; upstream could default it to that token.
