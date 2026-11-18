import { ChartFromSpec } from '../../../src';
import { BRAND } from '../../config';
import { getEntry } from '../../catalog/registry';
import { componentPath } from '../../content/routes';
import { useCanvas } from '../../state';
import { CodeBlock } from '../CodeBlock';
import { LazyMount } from './LazyMount';
import { regionSpec, regionSpecJson } from './regions';

// A component page to use as the example of a Markdown twin.
const example = getEntry('bar');
const exampleMarkdown = `${componentPath(example?.id ?? 'bar')}.md`;

// What exists for coding agents (Markdown docs) and for models in a product
// (charts from a JSON spec). Only things that are on the site are listed: the
// three files are links, and so is the guide, which leads on to the one for models.
export const AgentDocs = () => {
  const canvas = useCanvas();
  return (
    <div className="lp-agents">
      <div className="lp-agents__col">
        <h3>Docs an agent can read</h3>
        <dl className="lp-agents__list">
          <div>
            <dt>
              {/* Files, not pages of the app: target="_self" keeps the router from handling the click. */}
              <a className="lp-agents__path" href="/llms.txt" target="_self">
                /llms.txt
              </a>
            </dt>
            <dd>An index of every docs page.</dd>
          </div>
          <div>
            <dt>
              <a className="lp-agents__path" href="/llms-full.txt" target="_self">
                /llms-full.txt
              </a>
            </dt>
            <dd>Every docs page in one Markdown file.</dd>
          </div>
          <div>
            <dt>
              <a className="lp-agents__path" href={exampleMarkdown} target="_self">
                {exampleMarkdown}
              </a>
            </dt>
            <dd>Any page as Markdown: add .md to its URL.</dd>
          </div>
        </dl>
        <a className="text-link" href="/docs/ai">
          Use {BRAND.name} with AI →
        </a>
      </div>

      <div className="lp-agents__col">
        <h3>Charts from a model</h3>
        <p className="lp-agents__text">
          A model returns this JSON as a tool call. <code>ChartFromSpec</code> renders it.
        </p>
        <div className="lp-spec">
          <CodeBlock code={regionSpecJson} label="json" />
          <div className={`lp-spec__chart${canvas.dark ? ' is-dark' : ''}`} style={{ background: canvas.background }}>
            <LazyMount className="lp-spec__fill">
              <ChartFromSpec spec={regionSpec} />
            </LazyMount>
          </div>
        </div>
      </div>
    </div>
  );
};
