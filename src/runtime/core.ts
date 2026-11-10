// Data contract for the components. Shapes are structurally identical to
// @embeddable.com/core so upstream source compiles unchanged against them.

export const DIMENSION_TYPE = 'dimension';
export const MEASURE_TYPE = 'measure';

export const CUBE_DIMENSION_TYPE_STRING = 'string';
export const CUBE_DIMENSION_TYPE_NUMBER = 'number';
export const CUBE_DIMENSION_TYPE_BOOLEAN = 'boolean';
export const CUBE_DIMENSION_TYPE_GEO = 'geo';
export const CUBE_DIMENSION_TYPE_TIME = 'time';

export const CUBE_MEASURE_TYPE_STRING = 'string';
export const CUBE_MEASURE_TYPE_TIME = 'time';
export const CUBE_MEASURE_TYPE_BOOLEAN = 'boolean';
export const CUBE_MEASURE_TYPE_NUMBER = 'number';
export const CUBE_MEASURE_TYPE_COUNT = 'count';
export const CUBE_MEASURE_TYPE_COUNT_DISTINCT = 'count_distinct';
export const CUBE_MEASURE_TYPE_COUNT_DISTINCT_APPROX = 'count_distinct_approx';
export const CUBE_MEASURE_TYPE_SUM = 'sum';
export const CUBE_MEASURE_TYPE_AVG = 'avg';
export const CUBE_MEASURE_TYPE_MIN = 'min';
export const CUBE_MEASURE_TYPE_MAX = 'max';

export type TCubeDimensionType = 'string' | 'number' | 'time' | 'boolean' | 'geo';
export type TCubeMeasureType =
  | 'string'
  | 'time'
  | 'boolean'
  | 'number'
  | 'count'
  | 'count_distinct'
  | 'count_distinct_approx'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max';

export const NativeDataType = {
  string: 'string',
  number: 'number',
  time: 'time',
  boolean: 'boolean',
} as const;
export type NativeDataType = keyof typeof NativeDataType;

export type Granularity = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';

export type DataResponse = {
  isLoading: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: { [attr: string]: any }[];
  error?: string;
  total?: number;
};

export type DimensionSubInputs = {
  granularity?: Granularity;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export type Dimension = {
  name: string;
  title: string;
  nativeType: TCubeDimensionType;
  description?: string;
  meta?: object;
  __type__: typeof DIMENSION_TYPE;
  inputs?: DimensionSubInputs;
};

export type Measure = {
  name: string;
  title: string;
  nativeType: TCubeMeasureType;
  description?: string;
  meta?: object;
  __type__: typeof MEASURE_TYPE;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputs?: Record<string, any>;
};

export type DimensionOrMeasure = Dimension | Measure;

export type TimeDimension = {
  dimension: string;
  granularity?: Granularity;
  title?: string;
  dateRange?: string | [Date, Date] | [string, string];
};

export const isDimension = (d: DimensionOrMeasure | undefined): d is Dimension =>
  d?.__type__ === DIMENSION_TYPE;

export const isMeasure = (d: DimensionOrMeasure | undefined): d is Measure =>
  d?.__type__ === MEASURE_TYPE;

export const isDimensionOrMeasure = (d: DimensionOrMeasure | undefined): d is DimensionOrMeasure =>
  isDimension(d) || isMeasure(d);

export const isTimeDimension = (
  d: DimensionOrMeasure | TimeDimension | undefined,
): d is TimeDimension => !!d && 'dimension' in d;

export type TimeDeserializedValue = { date: Date | undefined; relativeTimeString: string | undefined };
export type TimeRangeDeserializedValue = {
  from: Date | undefined;
  to: Date | undefined;
  relativeTimeString: string | undefined;
};
export type Time = TimeDeserializedValue;
export type TimeRange = TimeRangeDeserializedValue | undefined;

export const FilterOperator = {
  equals: 'equals',
  notEquals: 'notEquals',
  contains: 'contains',
  notContains: 'notContains',
  startsWith: 'startsWith',
  endsWith: 'endsWith',
  gt: 'gt',
  gte: 'gte',
  lt: 'lt',
  lte: 'lte',
  notNull: 'set',
  isNull: 'notSet',
  inDateRange: 'inDateRange',
  notInDateRange: 'notInDateRange',
  beforeDate: 'beforeDate',
  afterDate: 'afterDate',
  measureFilter: 'measureFilter',
} as const;
export type FilterOperator = keyof typeof FilterOperator;

export type Dataset = {
  embeddableId: string;
  datasetId: string;
  inputName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variableValues: Record<string, any>;
};

export type OrderDirection = 'asc' | 'desc';
export type OrderBy = { property: DimensionOrMeasure; direction: OrderDirection };

// Builder type registration has no meaning outside Embeddable.
export type EmbeddableType = { typeName: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const defineType = (typeName: string, _config?: unknown): any => ({ typeName });
export const defineOption = (_type: unknown, _option: unknown): void => {};
