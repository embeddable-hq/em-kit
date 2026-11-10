import type { GeneratedFieldInputs } from './fieldInputs.generated';

/**
 * Options set on a dimension's or measure's `inputs`. Which ones a chart reads
 * is listed under "Field options" on its docs page.
 */
export type FieldInputs = GeneratedFieldInputs & {
  /** Rendered in place of null/undefined values. */
  displayNullAs?: string;
};
