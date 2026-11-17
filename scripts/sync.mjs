#!/usr/bin/env node
// Pulls remarkable-pro and remarkable-ui source at a git ref, strips the
// Embeddable layer, and rewrites Embeddable imports onto this package's own
// runtime and the mirrored remarkable-ui tree. After a sync, no
// @embeddable.com import may remain anywhere.
//
//   REMARKABLE_PRO_DIR  path to a remarkable-pro checkout (default ../remarkable-pro)
//   REMARKABLE_PRO_REF  git ref to sync from (default origin/main, fetched first;
//                       uncommitted work is never synced)
//   REMARKABLE_UI_DIR   path to a remarkable-ui checkout (default ../remarkable-ui)
//   REMARKABLE_UI_REF   git ref to sync from (default origin/main, fetched first)
//   SYNC_NO_FETCH=1     use the refs as they are locally, without fetching

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkManifest, discoverUpstreamComponents } from './components.manifest.mjs';
import {
  builderDefaults,
  extractDefinitionMetas,
  extractFieldInputs,
  writeBuilderDefaults,
  writeFieldInputs,
} from './extract-field-inputs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNTIME_DIR = path.join(ROOT, 'src/runtime');
const UI_OUT = path.join(ROOT, 'src/generated-ui');

const EXCLUDE_PRO = [
  // Embeddable component registration and builder metadata
  /\.emb\.ts$/,
  /(^|\/)definition\.ts$/,
  /^editors\//,
  /^index\.ts$/,
  /^components\/component\.(sub)?inputs\.constants\.ts$/,
  /^components\/preview\.data\.constants\.ts$/,
  /\.loadData\.utils\.ts$/,
  // Editors bound to Embeddable's dimension/measure model
  /^components\/editors\/filters\//,
  /^components\/editors\/(DimensionOrMeasureMultiSelectFieldPro|DimensionSingleSelectFieldPro|MeasureMultiSelectFieldPro|MeasureSingleSelectFieldPro)\//,
  /^components\/editors\/shared\/DimensionAndMeasureSingleSelectField\//,
  // Tests run against Embeddable mocks upstream
  /\.test\.tsx?$/,
  /(^|\/)test-utils\//,
  /\.stories\.tsx?$/,
  /^vitest\.d\.ts$/,
];

const EXCLUDE_UI = [
  /\.test\.tsx?$/,
  /\.stories\.tsx?$/,
  /(^|\/)test-utils\//,
  /^storybook\.constants\.tsx$/,
  /^vitest\.d\.ts$/,
];

// *.type.emb.ts files carry runtime option constants that chart code imports;
// keep them, minus the ".emb" suffix.
const KEEP_OVERRIDE_PRO = [/\.type\.emb\.ts$/];

const SOURCES = [
  {
    name: 'remarkable-ui',
    dir: path.resolve(ROOT, process.env.REMARKABLE_UI_DIR ?? '../remarkable-ui'),
    ref: process.env.REMARKABLE_UI_REF ?? 'origin/main',
    out: UI_OUT,
    exclude: EXCLUDE_UI,
    keep: [],
    importRewrites: {},
    contentRewrites: [
      // Heading levels. Upstream renders every card title as <h1> and the KPI
      // number and state titles as <h2>, which suits one chart in an iframe but
      // gives a page of charts many H1s, and H2s under H3 card titles. Card
      // titles become <h3>; the KPI number and the empty/error title become a
      // <div> with a class, which their CSS selects instead of h2, so they look
      // the same and a host page's h2 rule no longer reaches them.
      {
        file: 'components/shared/Card/Card.tsx',
        from: '{title && <h1>{title}</h1>}',
        to: '{title && <h3>{title}</h3>}',
        why: 'a card title is not the page title; propose a headingLevel option upstream',
      },
      {
        file: 'components/charts/tables/Table/components/TableBody/TableBody.module.css',
        from: '.tableBody td:hover .copyButton {',
        to: '.tableBody td:hover .copyButton,\n.tableBody td:focus-within .copyButton {',
        why: 'the copy button takes keyboard focus while invisible; show it whenever focus is in its cell',
      },
      {
        file: 'components/shared/Card/Card.module.css',
        from: '.card .cardHeader .cardHeaderTitle h1 {',
        to: '.card .cardHeader .cardHeaderTitle h3 {',
        why: 'matches the card title tag change above',
      },
      {
        file: 'components/shared/Card/CardFeedback/CardFeedback.tsx',
        from: '<h2>{title}</h2>',
        to: '<div className={styles.title}>{title}</div>',
        why: 'an empty or error message is not a section heading',
      },
      {
        file: 'components/shared/Card/CardFeedback/CardFeedback.module.css',
        from: '.feedback h2 {',
        to: '.feedback .title {',
        why: 'matches the state title tag change above',
      },
      {
        file: 'components/shared/Card/CardFeedback/CardFeedback.module.css',
        from: '.feedback.error h2,',
        to: '.feedback.error .title,',
        why: 'matches the state title tag change above',
      },
      {
        file: 'components/charts/kpis/KpiChart.tsx',
        from: '<h2 title={displayValue?.toString()} style={{ fontSize: valueFontSize }}>\n            {displayValue}\n          </h2>',
        to: '<div className={styles.kpiChartValue} title={displayValue?.toString()} style={{ fontSize: valueFontSize }}>\n            {displayValue}\n          </div>',
        why: 'a KPI number is not a section heading',
      },
      {
        file: 'components/charts/kpis/KpiChart.module.css',
        from: '.kpiChartValueContainer h2 {',
        to: '.kpiChartValueContainer .kpiChartValue {',
        why: 'matches the KPI number tag change above',
      },
      // Heat map cell text is white only where white reaches 4.5:1 (WCAG AA) on
      // the cell; upstream's brightness cut-off put white 12px numbers on
      // mid-tone cells at 3.7:1. Otherwise '#212129', or black on the few
      // mid-tones where '#212129' falls short too (black or white always
      // reaches 4.58:1).
      {
        file: 'components/charts/tables/HeatMap/HeatMap.tsx',
        from: '                      role={onCellClick ? \'button\' : undefined}\n                      tabIndex={onCellClick ? 0 : undefined}\n',
        to: '                      role={onCellClick ? \'button\' : undefined}\n                      tabIndex={onCellClick ? 0 : undefined}\n                      aria-label={\n                        onCellClick\n                          ? `${rowDimension.format ? rowDimension.format(rv) : rv}, ${columnDimension.format ? columnDimension.format(cv) : cv}: ${getCellDisplayValue(value, true, measure) ?? \'\'}`\n                          : undefined\n                      }\n',
        why: 'a clickable cell is a button; with values hidden it had no name. Row, column and value name it',
      },
      {
        file: 'components/charts/tables/HeatMap/HeatMap.utils.ts',
        from: "/** YIQ perceived brightness, used to pick white/black text. */\nconst getBrightness = (color: string) => {\n  const { r, g, b } = hexToRgb(color);\n  return (r * 299 + g * 587 + b * 114) / 1000;\n};\n\n/** Returns '#FFFFFF' for dark backgrounds, '#212129' for light ones. */\nexport const getCellColor = (backgroundColor: string) => {\n  return getBrightness(backgroundColor) < 150 ? '#FFFFFF' : '#212129';\n};\n",
        to: "/** WCAG relative luminance, 0 (black) to 1 (white). */\nconst getLuminance = (color: string) => {\n  const { r, g, b } = hexToRgb(color);\n  const linear = (channel: number) => {\n    const c = channel / 255;\n    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;\n  };\n  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);\n};\n\n/** WCAG contrast ratio of two colours, 1 to 21. */\nconst getContrast = (a: string, b: string) => {\n  const la = getLuminance(a);\n  const lb = getLuminance(b);\n  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);\n};\n\n/** White where it reaches 4.5:1 on the cell, else '#212129', else black. */\nexport const getCellColor = (backgroundColor: string) => {\n  if (getContrast(backgroundColor, '#FFFFFF') >= 4.5) return '#FFFFFF';\n  return getContrast(backgroundColor, '#212129') >= 4.5 ? '#212129' : '#000000';\n};\n",
        why: 'heat map text must reach 4.5:1 on its cell; remove once remarkable-ui picks the text colour by contrast',
      },
      // Horizontal bar charts cut long category labels to the width Chart.js
      // gives the y axis (at most half the chart), with an ellipsis, instead of
      // drawing them past the canvas edge ("echerche organique" in a narrow
      // card). maxCharacters still applies first; tooltips show the full label.
      {
        file: 'components/charts/bars/bars.utils.ts',
        from: "import { ChartData, ChartOptions } from 'chart.js';\n",
        to: "import { CartesianScaleOptions, ChartData, ChartOptions, FontSpec, Scale } from 'chart.js';\nimport { toFont, toPadding } from 'chart.js/helpers';\n",
        why: 'types and font helpers for fitLabelsToAxisWidth (see below)',
      },
      {
        file: 'components/charts/bars/bars.utils.ts',
        from: 'const getBarHorizontalChartOptions = (\n',
        to: "const fitLabelsToAxisWidth = (scale: Scale): void => {\n  const { ticks, grid, title } = scale.options as unknown as CartesianScaleOptions;\n  const ctx = scale.ctx;\n  if (!ticks.display || ticks.mirror || !ctx) return;\n  const fallback = scale.chart.options.font as Partial<FontSpec>;\n  const titleHeight = title.display\n    ? toFont(title.font as Partial<FontSpec>, fallback).lineHeight + toPadding(title.padding as Parameters<typeof toPadding>[0]).height\n    : 0;\n  const maxWidth =\n    scale.maxWidth - (grid.drawTicks ? (grid.tickLength ?? 0) : 0) - titleHeight - ticks.padding * 2;\n  if (!(maxWidth > 0)) return;\n  ctx.save();\n  ctx.font = toFont(ticks.font as Partial<FontSpec>, fallback).string;\n  for (const tick of scale.ticks) {\n    if (typeof tick.label !== 'string' || ctx.measureText(tick.label).width <= maxWidth) continue;\n    let text = tick.label;\n    while (text.length > 1 && ctx.measureText(`${text}…`).width > maxWidth) text = text.slice(0, -1);\n    tick.label = `${text.trimEnd()}…`;\n  }\n  ctx.restore();\n};\n\nconst getBarHorizontalChartOptions = (\n",
        why: 'y-axis labels of horizontal bars fit the axis; remove once remarkable-ui truncates them',
      },
      {
        file: 'components/charts/bars/bars.utils.ts',
        from: '        reverse: config.reverseYAxis,\n',
        to: '        reverse: config.reverseYAxis,\n        afterTickToLabelConversion: fitLabelsToAxisWidth,\n',
        why: 'applies fitLabelsToAxisWidth to the category axis of horizontal bars (see above)',
      },
      // The funnel's widest step spans the drawing area. Its value scale ended
      // on the next round tick (4,820 became 6,000), so the top step used only
      // 80-88% of the card's width. With indexAxis 'y', x is the value scale.
      {
        file: 'components/charts/funnel/funnel.utils.ts',
        from: "  const funnelChartOptions: Partial<ChartOptions<'funnel'>> = {\n    indexAxis: 'y',\n",
        to: "  const funnelChartOptions: Partial<ChartOptions<'funnel'>> = {\n    indexAxis: 'y',\n    scales: { x: { bounds: 'data' } },\n",
        why: 'the value scale ends at the largest value; remove once remarkable-ui sets it',
      },
      // Server rendering (Next.js, Remix, Astro): with no DOM, getStyleNumber
      // threw on getComputedStyle, at import (TableChartPaginated reads three
      // sizes at module level) and in render. It now assumes the browser's
      // default 16px root; in a browser nothing changes.
      {
        file: 'styles/styles.utils.ts',
        from: '  const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);\n',
        to: "  const rootFontSize =\n    typeof document === 'undefined' ? 16 : parseFloat(getComputedStyle(document.documentElement).fontSize);\n",
        why: 'getStyleNumber must not need a DOM; remove once remarkable-ui guards it',
      },
    ],
  },
  {
    name: 'remarkable-pro',
    dir: path.resolve(ROOT, process.env.REMARKABLE_PRO_DIR ?? '../remarkable-pro'),
    ref: process.env.REMARKABLE_PRO_REF ?? 'origin/main',
    out: path.join(ROOT, 'src/generated'),
    exclude: EXCLUDE_PRO,
    keep: KEEP_OVERRIDE_PRO,
    importRewrites: {
      // Longer specifiers first: replacement is exact (quoted) per specifier.
      '@embeddable.com/remarkable-ui/styles': path.join(UI_OUT, 'styles/index'),
      '@embeddable.com/remarkable-ui': path.join(UI_OUT, 'index'),
      '@embeddable.com/core': path.join(RUNTIME_DIR, 'core'),
      '@embeddable.com/react': path.join(RUNTIME_DIR, 'react'),
    },
    // Targeted source edits that must keep applying; the sync fails when one
    // stops matching so upstream drift surfaces here instead of at runtime.
    contentRewrites: [
      {
        file: 'components/charts/bars/bars.types.ts',
        from: 'export type BarChartProOptionsClickArg = {\n  dimensionValue: string | number | undefined;\n  dimensionTimeRange: TimeRange | undefined;\n};',
        to: 'export type BarChartProOptionsClickArg = {\n  dimensionValue: string | number | undefined;\n  dimensionTimeRange: TimeRange | undefined;\n  measureValues?: Record<string, unknown>;\n};',
        why: 'createSimpleClickHandler passes measureValues (each measure’s value at the click); the type left it out',
      },
      {
        file: 'components/charts/lines/lines.types.ts',
        from: '  dimensionTimeRange: TimeRange | undefined;\n  measureValue?: number;\n};',
        to: '  dimensionTimeRange: TimeRange | undefined;\n  measureValue?: number;\n  measureValues?: Record<string, unknown>;\n};',
        why: 'LineChart passes measureValues (createSimpleClickHandler); the comparison chart sets measureValue',
      },
      {
        file: 'components/charts/lines/AreaChartPro/AreaChartPro.utils.ts',
        from: '    interaction: { mode: \'index\' as const, intersect: false },\n    ...(theme.charts?.areaChartPro?.options || {}),\n  });',
        to: '    interaction: { mode: \'index\' as const, intersect: false },\n  }, theme.charts?.areaChartPro?.options || {});',
        why: 'spreading the theme options into the same literal let any theme scales replace `scales.y.stacked`, so a themed area chart stopped stacking; merge them as their own argument',
      },
      {
        file: 'components/charts/tables/PivotTablePro/index.tsx',
        from: '  expandedRowKeys: string[];\n  setExpandedRowKey: (expandedRowKeys: string) => void;\n} & ChartCardHeaderProps;',
        to: '  expandedRowKeys?: string[];\n  setExpandedRowKey?: (expandedRowKeys: string) => void;\n} & ChartCardHeaderProps;',
        why: 'without sub-rows the two props do nothing, so a pivot with no subRowDimension should not need them',
      },
      {
        file: 'components/charts/tables/PivotTablePro/index.tsx',
        from: 'const PivotTablePro = (props: PivotTableProProps) => {',
        to: 'const NO_EXPANDED_ROWS: string[] = [];\n\nconst PivotTablePro = (props: PivotTableProProps) => {',
        why: 'a stable default for expandedRowKeys (it is an effect dependency)',
      },
      {
        file: 'components/charts/tables/PivotTablePro/index.tsx',
        from: '    expandedRowKeys,\n    setExpandedRowKey,\n  } = props;',
        to: '    expandedRowKeys = NO_EXPANDED_ROWS,\n    setExpandedRowKey,\n  } = props;',
        why: 'defaults expandedRowKeys now that it is optional',
      },
      {
        file: 'components/charts/tables/PivotTablePro/index.tsx',
        from: '    setExpandedRowKey(rowKey);',
        to: '    setExpandedRowKey?.(rowKey);',
        why: 'setExpandedRowKey is optional now',
      },
      {
        file: 'components/editors/shared/GranularitySelectField/GranularitySelectField.tsx',
        from: '}, [primaryTimeRange, granularities]);',
        to: '}, [primaryTimeRange, granularities, theme.i18n.language]);',
        why: 'the option labels are translated inside this memo; without the language they stay in the first one',
      },
      {
        file: 'theme/styles/styles.utils.ts',
        from: "const STORAGE_KEY = 'embeddable';",
        to: "const STORAGE_KEY = 'rkit';",
        why: 'colour assignments persist under a neutral key',
      },
      {
        file: 'components/charts/scatter/ScatterChartPro/ScatterChartPro.utils.ts',
        from: "          value: {\n            display: 'auto',\n",
        to: '          value: {\n',
        why: "upstream forces value labels on, overriding showValueLabels; remove once fixed in remarkable-pro",
      },
      {
        file: 'components/charts/scatter/ScatterChartPro/ScatterChartPro.utils.ts',
        from: "          caption: {\n            display: 'auto',\n",
        to: '          caption: {\n',
        why: "upstream forces point labels on, overriding showPointLabels; remove once fixed in remarkable-pro",
      },
      // Export libraries load when an export is chosen, not with every chart:
      // xlsx is about 110 KB gzipped and dom-to-image-more about 9 KB, and most
      // visitors never export. The card menu already waits on the returned
      // promise (ChartCardMenuPro's startAction), with its spinner showing.
      {
        file: 'theme/utils/export.utils.ts',
        from: "import * as XLSX from 'xlsx';\nimport domtoimage from 'dom-to-image-more';\n",
        to: '',
        why: 'xlsx and dom-to-image-more are imported inside exportXLSX and exportPNG instead; remove once remarkable-pro loads them on demand',
      },
      {
        file: 'theme/utils/export.utils.ts',
        from: 'export function exportXLSX({',
        to: 'export async function exportXLSX({',
        why: 'exportXLSX awaits the xlsx import (see above)',
      },
      {
        file: 'theme/utils/export.utils.ts',
        from: '  const worksheet = XLSX.utils.aoa_to_sheet(xlsxData);',
        to: "  const XLSX = await import('xlsx');\n  const worksheet = XLSX.utils.aoa_to_sheet(xlsxData);",
        why: 'xlsx loads when an XLSX export is chosen (see above)',
      },
      {
        file: 'theme/utils/export.utils.ts',
        from: '    const dataUrl = await withChartsAtPixelRatio<string>(element, PNG_EXPORT_SCALE, () =>',
        to: "    const { default: domtoimage } = await import('dom-to-image-more');\n    const dataUrl = await withChartsAtPixelRatio<string>(element, PNG_EXPORT_SCALE, () =>",
        why: 'dom-to-image-more loads when a PNG export is chosen (see above)',
      },
      {
        file: 'theme/formatter/formatter.constants.ts',
        from: '  locale: navigator.language,\n',
        to: "  locale: typeof navigator === 'undefined' ? 'en-US' : navigator.language,\n",
        why: 'read at import; Node before 21 and some edge runtimes have no navigator; remove once remarkable-pro guards it',
      },
      // Funnel value labels format the count measure as the tooltip does, with
      // its prefix, currency, decimal places and the provider locale, instead
      // of value.toLocaleString(). Percentages keep remarkable-ui's formatter.
      {
        file: 'components/charts/funnel/FunnelChartPro/FunnelChartPro.utils.ts',
        from: '  (config: Partial<FunnelChartProProps>) => (value: number, context: Context) => {\n',
        to: '  (\n    config: Partial<FunnelChartProProps>,\n    formatValue: (value: number) => string = (value) => value.toLocaleString(),\n  ) =>\n  (value: number, context: Context) => {\n',
        why: 'the section-label formatter takes a value formatter; remove once remarkable-pro formats funnel labels',
      },
      {
        file: 'components/charts/funnel/FunnelChartPro/FunnelChartPro.utils.ts',
        from: '      : value.toLocaleString();\n',
        to: '      : formatValue(value);\n',
        why: 'section labels print the formatted value (see above)',
      },
      {
        file: 'components/charts/funnel/FunnelChartPro/FunnelChartPro.utils.ts',
        from: '  if (!options.showSectionLabels) return base;\n',
        to: "  // Value labels use the measure's formatting, as the tooltip does.\n  const formatValue = (value: number) => themeFormatter.data(countMeasure, value);\n  if (!options.showSectionLabels) {\n    if (options.displayPercentages) return base;\n    return { ...base, plugins: { ...base.plugins, datalabels: { formatter: formatValue } } };\n  }\n",
        why: 'value labels without section labels print the formatted value (see above)',
      },
      {
        file: 'components/charts/funnel/FunnelChartPro/FunnelChartPro.utils.ts',
        from: '        formatter: getFunnelOptionsDatalabelsFormatter(options),\n',
        to: '        formatter: getFunnelOptionsDatalabelsFormatter(options, formatValue),\n',
        why: 'section labels pass the formatter in (see above)',
      },
      // Accessible names. The card's ⋮ menu button had none, and each chart
      // canvas is role="img" with none. The button is named after the card
      // ("Chart menu: Revenue by region", translated through the provider's
      // i18n; the keys are in src/i18n). Each canvas is named after the title
      // and description, including canvases a chart mounts after the card
      // (a donut waits for its size), so a MutationObserver watches the card.
      {
        file: 'components/charts/shared/ChartCard/ChartCardMenuPro/ChartCardMenuPro.tsx',
        from: 'triggerComponent={isLoading ? <ChartCardLoading /> : <ActionIcon icon={IconDotsVertical} />}',
        to: "triggerComponent={\n        isLoading ? (\n          <ChartCardLoading />\n        ) : (\n          <ActionIcon\n            icon={IconDotsVertical}\n            aria-label={\n              props.title\n                ? i18n.t('charts.menuLabel', { title: props.title })\n                : i18n.t('charts.menuLabelUntitled')\n            }\n          />\n        )\n      }",
        why: 'the menu button needs an accessible name; remove once remarkable-pro names it',
      },
      {
        file: 'components/charts/shared/ChartCard/ChartCard.tsx',
        from: '  const [showMaximizedDialog, setShowMaximizedDialog] = useState(false);\n',
        to: "  const [showMaximizedDialog, setShowMaximizedDialog] = useState(false);\n\n  const canvasLabel = [title, description].filter(Boolean).join('. ');\n  React.useEffect(() => {\n    const card = cardRef.current;\n    if (!card || !canvasLabel || typeof MutationObserver === 'undefined') return;\n    const nameCanvases = () =>\n      card.querySelectorAll('canvas').forEach((canvas) => {\n        if (canvas.getAttribute('aria-label') !== canvasLabel) canvas.setAttribute('aria-label', canvasLabel);\n      });\n    nameCanvases();\n    const observer = new MutationObserver(nameCanvases);\n    observer.observe(card, { childList: true, subtree: true });\n    return () => observer.disconnect();\n  }, [canvasLabel, showMaximizedDialog]);\n",
        why: 'each chart canvas needs an accessible name; remove once remarkable-ui passes one to the canvas',
      },
      {
        file: 'theme/i18n/i18n.ts',
        from: '    interpolation: {\n      escapeValue: false,\n    },\n  });\n',
        to: '    interpolation: {\n      escapeValue: false,\n    },\n    showSupportNotice: false,\n  });\n',
        why: "i18next logs a Locize advert in every host app's console unless told not to; remove once remarkable-pro sets it",
      },
      // The comparison series reads "Customers (previous period)", not
      // "Compared Customers" ("Verglichen Kunden" in German).
      {
        file: 'components/charts/lines/LineChartComparisonDefaultPro/LineChartComparisonDefaultPro.utils.ts',
        from: "    label: (isPreviousPeriod ? `${i18n.t('common.compared')} ` : '') + rawLabel,\n",
        to: "    label: isPreviousPeriod ? i18n.t('charts.previousPeriodSeries', { label: rawLabel }) : rawLabel,\n",
        why: 'a translatable label template instead of a prefixed word; remove once remarkable-pro has one',
      },
      // Heat map default colours come from the theme object, following var()
      // references, instead of computed styles: a server has no DOM, so it
      // used the #FF5400 fallback while the browser used the theme colour, and
      // React kept the server's cell colours when it hydrated.
      {
        file: 'components/charts/tables/HeatMapPro/index.tsx',
        from: 'const HeatMapPro = (props: HeatMapProProps) => {\n',
        to: "const getThemeColor = (theme: Theme, name: string): string | undefined => {\n  const styles = theme.styles as Record<string, string | undefined>;\n  let value = styles[name];\n  for (let depth = 0; value?.startsWith('var(') && depth < 10; depth++) {\n    value = styles[value.slice(4, -1).split(',')[0]!.trim()];\n  }\n  return value || undefined;\n};\n\nconst HeatMapPro = (props: HeatMapProProps) => {\n",
        why: 'resolves a theme colour without the DOM (see above); remove once remarkable-pro does',
      },
      {
        file: 'components/charts/tables/HeatMapPro/index.tsx',
        from: "        midColor={midColor ?? getStyle('--em-tablechart-heatmap-color', '#FF5400')}\n",
        to: "        midColor={\n          midColor ??\n          getThemeColor(theme, '--em-tablechart-heatmap-color') ??\n          getStyle('--em-tablechart-heatmap-color', '#FF5400')\n        }\n",
        why: 'the default mid colour is the same on the server and in the browser (see above)',
      },
      // Percentages in value labels and tooltips follow the provider's locale
      // ("31,8 %" in German, not "31.8%"), and a measure's decimalPlaces is kept
      // exactly ("10.0%", not "10%"). Without decimalPlaces: up to two decimals.
      {
        file: 'components/charts/charts.utils.ts',
        from: "  decimalPlaces = 2,\n): string => {\n  // eslint-disable-next-line @typescript-eslint/no-explicit-any\n  const total = data.reduce((sum: number, v: any) => sum + Number.parseFloat(v), 0);\n  if (total === 0) return '0%';\n  return `${Number.parseFloat(((value / total) * 100).toFixed(decimalPlaces))}%`;\n};\n",
        to: "  decimalPlaces?: number,\n  locale?: string,\n): string => {\n  // eslint-disable-next-line @typescript-eslint/no-explicit-any\n  const total = data.reduce((sum: number, v: any) => sum + Number.parseFloat(v), 0);\n  const options: Intl.NumberFormatOptions = {\n    style: 'percent',\n    minimumFractionDigits: decimalPlaces ?? 0,\n    maximumFractionDigits: decimalPlaces ?? 2,\n  };\n  let format: Intl.NumberFormat;\n  try {\n    format = new Intl.NumberFormat(locale, options);\n  } catch {\n    format = new Intl.NumberFormat('en-US', options);\n  }\n  return format.format(total === 0 ? 0 : value / total);\n};\n",
        why: 'percentages are formatted in the theme locale; remove once remarkable-pro formats them',
      },
      {
        file: 'components/charts/pies/pies.utils.ts',
        from: 'context.dataset.data, decimalPlaces)',
        to: 'context.dataset.data, decimalPlaces, theme.formatter.locale)',
        why: 'pie percentages pass the theme locale (see above)',
      },
      {
        file: 'components/charts/bars/bars.utils.ts',
        from: 'context.dataset.data, measure.inputs?.decimalPlaces)',
        to: 'context.dataset.data, measure.inputs?.decimalPlaces, theme.formatter.locale)',
        why: 'bar percentages pass the theme locale (see above)',
      },
      {
        file: 'components/charts/bars/bars.utils.ts',
        from: '                  context.dataset.data,\n                  measure.inputs?.decimalPlaces,\n',
        to: '                  context.dataset.data,\n                  measure.inputs?.decimalPlaces,\n                  theme.formatter.locale,\n',
        why: 'bar percentages pass the theme locale (see above)',
      },
      {
        file: 'components/charts/combo/BarLineChartPro/BarLineChartPro.utils.ts',
        from: 'context.dataset.data, measure.inputs?.decimalPlaces)',
        to: 'context.dataset.data, measure.inputs?.decimalPlaces, theme.formatter.locale)',
        why: 'bar-line percentages pass the theme locale (see above)',
      },
      {
        file: 'components/charts/combo/BarLineChartPro/BarLineChartPro.utils.ts',
        from: '                  context.dataset.data,\n                  measure.inputs?.decimalPlaces,\n',
        to: '                  context.dataset.data,\n                  measure.inputs?.decimalPlaces,\n                  theme.formatter.locale,\n',
        why: 'bar-line percentages pass the theme locale (see above)',
      },
      // A pinned y range (yAxisRangeMin/Max) set clip: true on each line,
      // which clips all four sides, so the first and last point markers drew
      // cut in half. Lines are now clipped at the top and bottom only, where
      // the pinned range cuts off values; Chart.js takes false per side.
      {
        file: 'components/charts/lines/LineChartDefaultPro/LineChartDefaultPro.utils.ts',
        from: '        clip: props.hasMinMaxYAxisRange,\n',
        to: '        clip: props.hasMinMaxYAxisRange ? { left: false, right: false, top: 0, bottom: 0 } : false,\n',
        why: 'edge points draw whole with a pinned y range; remove once remarkable-pro clips the y axis only',
      },
      {
        file: 'components/charts/lines/LineChartComparisonDefaultPro/LineChartComparisonDefaultPro.utils.ts',
        from: '    clip: hasMinMaxYAxisRange,\n',
        to: '    clip: hasMinMaxYAxisRange ? { left: false, right: false, top: 0, bottom: 0 } : false,\n',
        why: 'edge points draw whole with a pinned y range (see above)',
      },
      {
        file: 'components/charts/lines/LineChartGroupedPro/LineChartGroupedPro.utils.ts',
        from: '      clip: hasMinMaxYAxisRange,\n',
        to: '      clip: hasMinMaxYAxisRange ? { left: false, right: false, top: 0, bottom: 0 } : false,\n',
        why: 'edge points draw whole with a pinned y range (see above)',
      },
    ],
    // definition.ts files are excluded above, but the per-field options they
    // declare (prefix, decimalPlaces, columnAggregation, …) are public API
    // here, and their input defaults become the components' defaults.
    afterExtract: async (srcRoot, errors) => {
      // Every upstream component must be exported or skipped in the manifest.
      errors.push(...checkManifest(discoverUpstreamComponents(walk(srcRoot))).map((e) => `remarkable-pro: ${e}`));
      const metas = await extractDefinitionMetas(srcRoot);
      writeFieldInputs(await extractFieldInputs(srcRoot, metas));
      writeBuilderDefaults(builderDefaults(metas));
    },
  },
];

const isExcluded = (source, rel) =>
  !source.keep.some((re) => re.test(rel)) && source.exclude.some((re) => re.test(rel));

const renameOutput = (rel) => rel.replace(/\.type\.emb\.ts$/, '.type.ts');

const toImportPath = (fromFile, target) => {
  let rel = path.relative(path.dirname(fromFile), target).split(path.sep).join('/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
};

const applyContentRewrites = (source, code, relFile, errors) => {
  let result = code;
  for (const rewrite of source.contentRewrites) {
    if (rewrite.file !== relFile) continue;
    if (!result.includes(rewrite.from)) {
      errors.push(`${source.name}/${relFile}: content rewrite no longer matches (${rewrite.why}): ${rewrite.from}`);
      continue;
    }
    result = result.replaceAll(rewrite.from, rewrite.to);
  }
  return result;
};

const rewriteSource = (source, code, relFile, outFile, errors) => {
  let result = code;
  for (const [specifier, target] of Object.entries(source.importRewrites)) {
    const importPath = toImportPath(outFile, target);
    result = result.replaceAll(`'${specifier}'`, `'${importPath}'`).replaceAll(`"${specifier}"`, `"${importPath}"`);
  }
  result = applyContentRewrites(source, result, relFile, errors);
  return result.replace(/(['"])([^'"]+\.type)\.emb\1/g, '$1$2$1');
};

const walk = (dir, base = dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full, base) : [path.relative(base, full).split(path.sep).join('/')];
  });

const syncSource = async (source, errors) => {
  if (!process.env.SYNC_NO_FETCH && source.ref.startsWith('origin/')) {
    execSync(`git -C "${source.dir}" fetch --quiet origin`);
  }
  const sha = execSync(`git -C "${source.dir}" rev-parse ${source.ref}`).toString().trim();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rkit-sync-'));
  execSync(`git -C "${source.dir}" archive ${sha} src | tar -x -C "${tmp}"`);
  const srcRoot = path.join(tmp, 'src');

  fs.rmSync(source.out, { recursive: true, force: true });

  let kept = 0;
  let skipped = 0;

  for (const rel of walk(srcRoot)) {
    if (isExcluded(source, rel)) {
      skipped++;
      continue;
    }
    const outFile = path.join(source.out, renameOutput(rel));
    fs.mkdirSync(path.dirname(outFile), { recursive: true });

    if (/\.(ts|tsx)$/.test(rel)) {
      const code = rewriteSource(source, fs.readFileSync(path.join(srcRoot, rel), 'utf8'), rel, outFile, errors);
      for (const match of code.matchAll(/['"](@embeddable\.com\/[^'"]+)['"]/g)) {
        errors.push(`${source.name}/${rel}: unmapped Embeddable import ${match[1]}`);
      }
      fs.writeFileSync(outFile, code);
    } else if (source.contentRewrites.some((rewrite) => rewrite.file === rel)) {
      const text = fs.readFileSync(path.join(srcRoot, rel), 'utf8');
      fs.writeFileSync(outFile, applyContentRewrites(source, text, rel, errors));
    } else {
      fs.copyFileSync(path.join(srcRoot, rel), outFile);
    }
    kept++;
  }

  for (const rewrite of source.contentRewrites) {
    if (!fs.existsSync(path.join(srcRoot, rewrite.file))) {
      errors.push(`${source.name}/${rewrite.file}: content rewrite target no longer exists (${rewrite.why})`);
    }
  }

  await source.afterExtract?.(srcRoot, errors);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`Synced ${source.name}@${sha.slice(0, 8)}: ${kept} files kept, ${skipped} excluded.`);
  return { ref: source.ref, sha, syncedAt: new Date().toISOString() };
};

const main = async () => {
  const errors = [];
  const state = {};
  for (const source of SOURCES) state[source.name] = await syncSource(source, errors);

  if (errors.length) {
    console.error(`Sync failed:\n  ${errors.join('\n  ')}`);
    process.exit(1);
  }

  fs.writeFileSync(path.join(ROOT, 'sync-state.json'), `${JSON.stringify({ sources: state }, null, 2)}\n`);
};

await main();
