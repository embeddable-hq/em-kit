import { describe, expect, it } from 'vitest';
import { chartEntries } from '../site/catalog/registry';
import { guides } from '../site/content/guides';
import { canonicalPath, componentPath, componentSlug, getEntryBySlug, playgroundPath } from '../site/content/routes';

// One URL per page, predictable from the component's export name, and every
// URL from earlier versions of the site still lands somewhere.

describe('component URLs', () => {
  it('are the kebab-case of the export name', () => {
    expect(componentPath('bar')).toBe('/docs/components/bar-chart');
    expect(componentPath('bar-stacked')).toBe('/docs/components/bar-chart-stacked');
    expect(componentPath('kpi')).toBe('/docs/components/kpi-number');
    expect(playgroundPath('bar', 'monthly')).toBe('/docs/components/bar-chart/playground/monthly');
  });

  it('are unique and resolve back to their component', () => {
    const slugs = chartEntries.map(componentSlug);
    expect(new Set(slugs).size).toBe(chartEntries.length);
    for (const entry of chartEntries) expect(getEntryBySlug(componentSlug(entry))).toBe(entry);
  });
});

describe('redirects', () => {
  it.each([
    ['/docs', '/docs/quick-start'],
    ['/charts', '/docs/components'],
    ['/gallery', '/docs/components'],
    ['/charts/bar', '/docs/components/bar-chart/playground'],
    ['/charts/bar/monthly', '/docs/components/bar-chart/playground/monthly'],
    ['/docs/components/bar', '/docs/components/bar-chart'],
    ['/docs/components/BarChart', '/docs/components/bar-chart'],
    ['/docs/components/horizontal-bar-chart', '/docs/components/bar-chart-horizontal'],
    ['/docs/components/kpi/playground', '/docs/components/kpi-number/playground'],
    ['/docs/data', '/docs/describing-your-data'],
    ['/docs/quick-start/', '/docs/quick-start'],
  ])('%s → %s', (from, to) => {
    expect(canonicalPath(from)).toBe(to);
  });

  it('leaves canonical URLs alone', () => {
    for (const entry of chartEntries) expect(canonicalPath(componentPath(entry.id))).toBe(componentPath(entry.id));
    for (const guide of guides) expect(canonicalPath(`/docs/${guide.slug}`)).toBe(`/docs/${guide.slug}`);
  });
});
