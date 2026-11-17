import { BRAND } from '../../config';
import { RevenueByRegion } from '../../examples/RevenueByRegion';
import kitSource from '../../examples/RevenueByRegion.tsx?raw';
import rawSource from '../../examples/RevenueByRegionChartJs.tsx?raw';

// One revenue card, written on a chart library and on this one. Both are real
// files in site/examples, so the code type-checks and the line counts are
// theirs. The landing page runs the second (LiveCard.tsx) and says how long
// each is; the Why page prints both (site/content/guides.ts).
//
// The second file is imported twice, as a module and as text, and handed out
// from here as a pair: the card on the landing page is that code, running.

export { RevenueByRegion };

/** The file as printed: its only edit is the package name in place of the path into this repo. */
export const kitComparisonCode = kitSource.replaceAll("from '../../src'", `from '${BRAND.packageName}'`).trim();

export const rawComparisonCode = rawSource.trim();

/** Lines as an editor numbers them: every line of the file, blank ones too. */
export const codeLines = (code: string) => code.split('\n').length;
