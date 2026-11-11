import { IconArrowRight } from '@tabler/icons-react';
import { DocsLayout } from '../components/DocsLayout';
import { CopyButton } from '../components/CopyButton';
import { chartEntries, chartGroups } from '../catalog/registry';
import { BRAND } from '../config';
import { componentPath } from '../docs/nav';
import { useDocumentTitle } from '../router';

const slug = (group: string) => `group-${group.toLowerCase()}`;

const indexMarkdown = () =>
  [
    `# ${BRAND.name} components`,
    ...chartGroups.flatMap((group) => [
      `## ${group}`,
      chartEntries
        .filter((e) => e.group === group)
        .map((e) => `- **${e.name}** (\`<${String(e.exportName)} />\`): ${e.description}`)
        .join('\n'),
    ]),
  ].join('\n\n');

export const ComponentsIndex = ({ route }: { route: string }) => {
  useDocumentTitle('Components', BRAND.name);
  return (
    <DocsLayout route={route} toc={chartGroups.map((g) => ({ id: slug(g), title: g }))}>
      <header className="docs-head">
        <span className="docs-head__section">Components</span>
        <h1>Components</h1>
        <p className="lede">
          {chartEntries.length} finished components: charts, KPIs and tables. Each page has live examples, the props,
          and code and prompts to copy.
        </p>
        <div className="docs-head__actions">
          <CopyButton kind="markdown" label="Copy Markdown" getText={indexMarkdown} />
          <a className="button button--small" href="/charts">
            See them all live in the gallery
          </a>
        </div>
      </header>
      <div className="docs-content">
        {chartGroups.map((group) => (
          <section key={group} aria-labelledby={slug(group)}>
            <h2 id={slug(group)}>{group}</h2>
            <div className="component-cards">
              {chartEntries
                .filter((e) => e.group === group)
                .map((e) => (
                  <a key={e.id} className="component-card" href={componentPath(e.id)}>
                    <span className="component-card__name">
                      {e.name}
                      <IconArrowRight size={15} aria-hidden />
                    </span>
                    <code>{`<${String(e.exportName)} />`}</code>
                    <span className="component-card__text">{e.description}</span>
                  </a>
                ))}
            </div>
          </section>
        ))}
      </div>
    </DocsLayout>
  );
};
