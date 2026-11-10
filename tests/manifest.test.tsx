import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain .mjs shared with the sync scripts
import { components } from '../scripts/components.manifest.mjs';
import * as Library from '../src';
import { chartEntries } from '../site/catalog/registry';

type ManifestEntry = { path: string; status: 'exported' | 'wrapped' | 'skipped'; name?: string; reason?: string };
const manifest = components as ManifestEntry[];
const published = manifest.filter((c) => c.status !== 'skipped');

// The manifest is the list of public components. Each one must be exported
// from the package and have a gallery entry, which also puts it in the smoke
// suite (tests/components.test.tsx renders every gallery entry).
describe('component manifest', () => {
  it.each(published.map((c) => [c.name!]))('%s is exported from the package', (name) => {
    expect(Library).toHaveProperty(name);
  });

  it.each(published.map((c) => [c.name!]))('%s has a gallery entry', (name) => {
    expect(chartEntries.map((e) => e.exportName)).toContain(name);
  });
});
