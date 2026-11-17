import type { DataResponse, Dimension, Measure } from '../../src';
import {
  ChartCard,
  LineChart,
  getLineChartProData,
  getLineChartProOptions,
  getStyle,
  getStyleNumber,
  i18nSetup,
  resolveI18nProps,
  useChartsTheme,
  useFillGaps,
} from '../../src/build';

type TargetLineChartProps = {
  xAxis: Dimension;
  measure: Measure;
  results: DataResponse;
  target: number;
  title?: string;
  description?: string;
};

// A line chart with a flat target line: the built-in line chart plus one
// extra dataset, assembled from the same toolkit the built-in charts use.
export const TargetLineChart = (props: TargetLineChartProps) => {
  const { xAxis, measure, target } = props;
  const theme = useChartsTheme();
  i18nSetup(theme);
  const { title, description } = resolveI18nProps(props);

  // Missing months become empty buckets instead of a line jumping across them.
  const results = useFillGaps({ results: props.results, dimension: xAxis });

  // Labels, values, colours and dashing exactly as <LineChart> does them.
  const data = getLineChartProData(
    { data: results.data, dimension: xAxis, measures: [measure], hasMinMaxYAxisRange: false },
    theme,
  );

  // The new part. A chrome colour (not a series colour) from a theme token,
  // so it follows the theme and dark mode.
  const targetColor = getStyle('--em-sem-text--muted', '#71717a');
  const dash = getStyleNumber('--em-linechart-line-dash', '0.25rem') ?? 4;
  data.datasets.push({
    label: 'Target',
    data: (data.labels ?? []).map(() => target),
    borderColor: targetColor,
    backgroundColor: targetColor,
    borderDash: [dash * 2, dash],
    pointRadius: 0,
    pointHoverRadius: 0,
  });

  // The value-formatting overlay. It formats each dataset with the measure at
  // the same index, so the target is listed twice to share its formatting.
  // <LineChart> merges this onto its own themed base options.
  const options = getLineChartProOptions(
    { data, dimension: xAxis, measures: [measure, measure] },
    theme,
  );

  return (
    <ChartCard
      data={results}
      dimensionsAndMeasures={[xAxis, measure]}
      errorMessage={results.error}
      title={title}
      description={description}
    >
      <LineChart data={data} options={options} showLegend showTooltips />
    </ChartCard>
  );
};
