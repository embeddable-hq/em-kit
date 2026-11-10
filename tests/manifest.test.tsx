import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain .mjs shared with the sync scripts
import { components } from '../scripts/components.manifest.mjs';
import * as Library from '../src';
import { ChartsProvider, dimension, measure, results } from '../src';
import { withDefaults } from '../src/withDefaults';
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

describe('builder defaults', () => {
  const Probe = (props: { label?: string; show?: boolean }) => (
    <span>{`${props.label}:${String(props.show)}`}</span>
  );
  const Defaulted = withDefaults(Probe, { label: 'default', show: true }, 'Probe');

  it('fills unset props', () => {
    expect(renderToString(<Defaulted />)).toContain('default:true');
  });

  it('treats undefined as unset, but keeps explicit values', () => {
    expect(renderToString(<Defaulted label={undefined} show={false} />)).toContain('default:false');
  });

  it('gives an exported chart the export menu without a menuOptions prop', () => {
    const html = renderToString(
      <ChartsProvider>
        <Library.BarChart
          title="Menu"
          dimension={dimension({ name: 'region', title: 'Region' })}
          measures={[measure({ name: 'revenue', title: 'Revenue' })]}
          results={results([{ region: 'Europe', revenue: 1 }])}
        />
      </ChartsProvider>,
    );
    expect(html).toContain('tabler-icon-dots-vertical');
  });
});
