// Every component remarkable-pro publishes to Embeddable (a directory with a
// `*.emb.ts` file) must be listed here, exported or skipped with a reason.
// `npm run sync` fails when upstream gains a component this file doesn't list,
// or loses one it does, so a new Remarkable component always forces a decision.
//
//   status: 'exported'  generated into src/components.generated.ts under `name`
//                       (props type re-exported as `${name}Props`)
//           'wrapped'   exported by a hand-written wrapper in src/ instead
//           'skipped'   not part of the public API; `reason` says why
//
// `path` is relative to remarkable-pro's src/.

export const components = [
  // Bars
  { path: 'components/charts/bars/BarChartDefaultPro', status: 'exported', name: 'BarChart' },
  { path: 'components/charts/bars/BarChartDefaultHorizontalPro', status: 'exported', name: 'BarChartHorizontal' },
  { path: 'components/charts/bars/BarChartGroupedPro', status: 'exported', name: 'BarChartGrouped' },
  { path: 'components/charts/bars/BarChartGroupedHorizontalPro', status: 'exported', name: 'BarChartGroupedHorizontal' },
  { path: 'components/charts/bars/BarChartStackedPro', status: 'exported', name: 'BarChartStacked' },
  { path: 'components/charts/bars/BarChartStackedHorizontalPro', status: 'exported', name: 'BarChartStackedHorizontal' },

  // Combo
  { path: 'components/charts/combo/BarLineChartPro', status: 'exported', name: 'BarLineChart' },

  // Funnel
  { path: 'components/charts/funnel/FunnelChartPro', status: 'exported', name: 'FunnelChart' },

  // Lines
  { path: 'components/charts/lines/LineChartDefaultPro', status: 'exported', name: 'LineChart' },
  { path: 'components/charts/lines/LineChartGroupedPro', status: 'exported', name: 'LineChartGrouped' },
  { path: 'components/charts/lines/LineChartComparisonDefaultPro', status: 'exported', name: 'LineChartComparison' },
  { path: 'components/charts/lines/LineChartWithKpiTabsPro', status: 'exported', name: 'LineChartWithKpiTabs' },
  { path: 'components/charts/lines/LineChartComparisonWithKpiTabsPro', status: 'exported', name: 'LineChartComparisonWithKpiTabs' },
  { path: 'components/charts/lines/AreaChartPro', status: 'exported', name: 'AreaChart' },

  // Pies
  { path: 'components/charts/pies/PieChartPro', status: 'exported', name: 'PieChart' },
  { path: 'components/charts/pies/DonutChartPro', status: 'exported', name: 'DonutChart' },
  { path: 'components/charts/pies/DonutLabelChartPro', status: 'exported', name: 'DonutLabelChart' },

  // Scatter
  { path: 'components/charts/scatter/ScatterChartPro', status: 'exported', name: 'ScatterChart' },
  { path: 'components/charts/scatter/BubbleChartPro', status: 'exported', name: 'BubbleChart' },

  // KPIs
  { path: 'components/charts/kpis/KpiChartNumberPro', status: 'exported', name: 'KpiNumber' },
  { path: 'components/charts/kpis/KpiChartNumberComparisonPro', status: 'exported', name: 'KpiNumberComparison' },

  // Tables
  { path: 'components/charts/tables/HeatMapPro', status: 'exported', name: 'HeatMap' },
  { path: 'components/charts/tables/PivotTablePro', status: 'exported', name: 'PivotTable' },
  { path: 'components/charts/tables/TableChartPaginated', status: 'exported', name: 'TablePaginated' },
  { path: 'components/charts/tables/TableScrollable', status: 'wrapped', name: 'TableScrollable', reason: 'src/TableScrollable.tsx replaces the Embeddable dataset prop with resetKey' },

  // Controls. The host's own state wires one to a chart: `value` in, `onChange` out.
  { path: 'components/editors/ComparisonPeriodSelectFieldPro', status: 'exported', name: 'ComparisonPeriodSelect', props: 'DateComparisonSelectFieldPro' },
  { path: 'components/editors/GranularitySelectFieldPro', status: 'exported', name: 'GranularitySelect' },
  { path: 'components/editors/MultiSelectFieldPro', status: 'exported', name: 'MultiSelect' },
  { path: 'components/editors/SingleSelectFieldPro', status: 'exported', name: 'SingleSelect' },
  { path: 'components/editors/TextFieldPro', status: 'exported', name: 'TextField' },
  { path: 'components/editors/dates/DateRangePickerCustomPro', status: 'exported', name: 'DateRangePickerCustom' },
  { path: 'components/editors/dates/DateRangePickerPresetsPro', status: 'exported', name: 'DateRangePicker' },
  { path: 'components/editors/DimensionOrMeasureMultiSelectFieldPro', status: 'exported', name: 'DimensionOrMeasureMultiSelect' },
  { path: 'components/editors/DimensionSingleSelectFieldPro', status: 'exported', name: 'DimensionSelect' },
  { path: 'components/editors/MeasureMultiSelectFieldPro', status: 'exported', name: 'MeasureMultiSelect' },
  { path: 'components/editors/MeasureSingleSelectFieldPro', status: 'exported', name: 'MeasureSelect' },
  { path: 'components/editors/filters/FilterBuilderPro', status: 'wrapped', name: 'FilterBuilder', reason: 'src/FilterBuilder.tsx keeps its state and loads value options through loadOptions' },
  { path: 'components/editors/filters/FilterBuilderWithGroupingPro', status: 'wrapped', name: 'FilterBuilderWithGrouping', reason: 'src/FilterBuilder.tsx keeps its state and loads value options through loadOptions' },

  // Layout blocks and builder-only editors
  { path: 'components/shared/EmptyContainerPro', status: 'skipped', reason: 'dashboard layout block, not a chart' },
  { path: 'components/shared/HorizontalDividerPro', status: 'skipped', reason: 'dashboard layout block, not a chart' },
  { path: 'components/shared/MarkdownPro', status: 'skipped', reason: 'dashboard layout block, not a chart' },
  { path: 'editors/ColorEditor', status: 'skipped', reason: 'Embeddable builder editor' },
  { path: 'editors/MarkdownEditor', status: 'skipped', reason: 'Embeddable builder editor' },
];

// Directories under remarkable-pro's src/ that hold an Embeddable component.
export const discoverUpstreamComponents = (relFiles) =>
  [
    ...new Set(
      relFiles
        .filter((rel) => rel.endsWith('.emb.ts') && !rel.endsWith('.type.emb.ts'))
        .map((rel) => rel.slice(0, rel.lastIndexOf('/'))),
    ),
  ].sort();

// Errors when the manifest and upstream disagree.
export const checkManifest = (upstreamDirs) => {
  const errors = [];
  const listed = new Set(components.map((c) => c.path));
  const upstream = new Set(upstreamDirs);
  for (const dir of upstreamDirs) {
    if (listed.has(dir)) continue;
    const suggested = dir.split('/').pop().replace(/Pro$/, '');
    errors.push(
      `new upstream component ${dir}: add it to scripts/components.manifest.mjs, e.g.\n` +
        `    { path: '${dir}', status: 'exported', name: '${suggested}' },\n` +
        `  then add a gallery entry in site/catalog/registry.tsx (or skip it with a reason)`,
    );
  }
  for (const { path } of components) {
    if (!upstream.has(path)) errors.push(`manifest lists ${path}, which upstream no longer has`);
  }
  const names = components.filter((c) => c.name).map((c) => c.name);
  for (const name of names.filter((n, i) => names.indexOf(n) !== i)) errors.push(`manifest uses the name ${name} twice`);
  for (const c of components) {
    if (c.status === 'skipped' && !c.reason) errors.push(`manifest skips ${c.path} without a reason`);
    if (c.status !== 'skipped' && !c.name) errors.push(`manifest exports ${c.path} without a name`);
  }
  return errors;
};
