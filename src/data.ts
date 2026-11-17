import {
  DIMENSION_TYPE,
  MEASURE_TYPE,
  DataResponse,
  Dimension,
  DimensionSubInputs,
  Granularity,
  Measure,
  NativeDataType,
} from './runtime/core';
import type { FieldInputs } from './fieldInputs';


type FieldOptions = {
  name: string;
  title?: string;
  type?: NativeDataType;
  description?: string;
  meta?: object;
  inputs?: FieldInputs;
};

// Row keys: components read `results.data[i][name]`. For a time dimension with
// a granularity, grouping charts read `${name}.${granularity}` instead, so
// supply the value under both keys. Time values must be ISO strings without a
// zone suffix: `YYYY-MM-DDTHH:mm:ss.sss`.
//
// A time dimension's granularity can be given at the top level or in `inputs`;
// both end up in `inputs.granularity`, which is where the charts read it. The
// top-level value wins when both are set.
export const dimension = ({
  name,
  title,
  type = 'string',
  description,
  meta,
  inputs,
  granularity,
}: FieldOptions & { granularity?: Granularity }): Dimension => {
  const bucket = granularity ?? inputs?.granularity;
  return {
    name,
    title: title ?? name,
    nativeType: type,
    description,
    meta,
    __type__: DIMENSION_TYPE,
    inputs: bucket || inputs ? ({ ...inputs, granularity: bucket } as DimensionSubInputs) : undefined,
  };
};

export const measure = ({ name, title, type = 'number', description, meta, inputs }: FieldOptions): Measure => ({
  name,
  title: title ?? name,
  nativeType: type,
  description,
  meta,
  __type__: MEASURE_TYPE,
  inputs,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const results = (data: Record<string, any>[] | undefined, extra?: Partial<DataResponse>): DataResponse => ({
  isLoading: data === undefined,
  data,
  ...extra,
});
