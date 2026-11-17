import { IconArrowRight, IconCheck } from '@tabler/icons-react';
import { ComponentType, ReactNode, useEffect, useRef, useState } from 'react';
import { chartEntries } from '../catalog/registry';
import { useChunk, useChunkWhenReady } from '../chunks';
import { CodeBlock } from '../components/CodeBlock';
import { COPY_PAGE_LABEL, CopyButton } from '../components/CopyButton';
import { DocsLayout, TocItem } from '../components/DocsLayout';
import { InstallCommand } from '../components/InstallCommand';
import { BRAND } from '../config';
import { aiSchemaJson, comparisonRows, Guide, GuideBlock, guideMarkdown, headingId, LiveBlockId, markdownAnchor, providerNote } from '../content/guides';
import { useDocumentTitle } from '../router';
import { useCanvas } from '../settings';
import { ChartBlockId, fullMarkdown, guideChartDemos, isChartBlock } from './guideChunks';
import { lightMarkdown } from './guideMarkdown';

// An example from site/examples, running under the code that defines it. The
// frame takes the selected theme's canvas colour, as the component pages do.
const Demo = ({ children }: { children: ReactNode }) => {
  const canvas = useCanvas();
  return (
    <figure className={`guide-demo${canvas.dark ? ' is-dark' : ''}`} style={{ background: canvas.background }}>
      <figcaption className="guide-demo__label">Result</figcaption>
      {children}
    </figure>
  );
};

// The examples and the chart library are a chunk of their own (guideChunks.ts).
// A page opened on this guide has it before the first render (main.tsx), so
// the chart replaces its static HTML directly. After a click from another
// page the text shows at once, and the chart takes this space when it arrives.
const ChartDemo = ({ id }: { id: ChartBlockId }) => {
  const { value: demos, failed } = useChunkWhenReady(guideChartDemos);
  const Example = demos?.[id];
  if (Example) return <Example />;
  return (
    <div style={{ minHeight: 320 }} role="status" aria-label={failed ? undefined : 'Loading the chart'}>
      {failed && <p>The chart did not load. Reload the page to try again.</p>}
    </div>
  );
};

// Prose, drawn without the Markdown parser where it can be (guideMarkdown.tsx).
// A guide with other Markdown has the parser before it renders (guideChunks.ts).
const Prose = ({ md }: { md: string }) => {
  const light = lightMarkdown(md);
  return light ? <>{light}</> : <FullMarkdown md={md} />;
};

const FullMarkdown = ({ md }: { md: string }) => {
  const Markdown = useChunk(fullMarkdown);
  return <Markdown>{md}</Markdown>;
};

const AiSchema = () => {
  const [open, setOpen] = useState(false);
  return (
    <details className="ai-details" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        input_schema <span>{(aiSchemaJson.length / 1024).toFixed(1)} KB of JSON Schema. Select to expand</span>
      </summary>
      {open && <CodeBlock code={aiSchemaJson} label="json" maxHeight={440} />}
    </details>
  );
};

export const ComparisonTable = () => (
  <div className="doc-table-scroll">
    <table className="doc-table comparison-table">
      <thead>
        <tr>
          <th scope="col">What a dashboard needs</th>
          <th scope="col">With a chart library</th>
          <th scope="col">With {BRAND.name}</th>
        </tr>
      </thead>
      <tbody>
        {comparisonRows.map((row) => (
          <tr key={row.need}>
            <th scope="row">{row.need}</th>
            <td className="comparison-table__library">{row.library}</td>
            <td className="comparison-table__kit">
              <IconCheck size={15} stroke={2.5} aria-hidden />
              {row.kit}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const NextSteps = () => (
  <div className="next-steps">
    {[
      { title: 'Quick start', text: 'A first chart in three steps', path: '/docs/quick-start' },
      { title: `Why ${BRAND.name}`, text: 'What a chart library leaves to you', path: '/docs/why' },
      { title: 'Components', text: `All ${chartEntries.length}, live, with code and props`, path: '/docs/components' },
      { title: 'Use with AI', text: 'Point a coding assistant at these docs', path: '/docs/ai' },
    ].map((card) => (
      <a key={card.path} href={card.path} className="next-steps__card">
        <strong>{card.title}</strong>
        <span>{card.text}</span>
        <IconArrowRight size={16} aria-hidden />
      </a>
    ))}
  </div>
);

const live: Record<Exclude<LiveBlockId, ChartBlockId>, ComponentType> = {
  install: () => <InstallCommand />,
  'next-steps': NextSteps,
  comparison: ComparisonTable,
  'ai-schema': AiSchema,
};

// A heading's id is its Markdown anchor, so a link copied from the Markdown
// twin lands on the same heading here. The short id the site's own links use
// (`#nextjs`) is kept on an empty element at the start of the heading.
const Anchored = ({ id, alias, children }: { id: string; alias: string; children: ReactNode }) => (
  <>
    {alias !== id && <span id={alias} className="anchor-alias" aria-hidden="true" />}
    {children}
  </>
);

// A closed section of a guide. It opens when the address points at it, as a
// link to /docs/quick-start#nextjs does; its content is in the HTML either way.
const Disclosure = ({ block }: { block: Extract<GuideBlock, { details: string }> }) => {
  const ref = useRef<HTMLDetailsElement>(null);
  const anchor = markdownAnchor(block.details);
  useEffect(() => {
    const open = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (ref.current && (hash === anchor || hash === block.id)) {
        ref.current.open = true;
        ref.current.scrollIntoView();
      }
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, [anchor, block.id]);
  return (
    <details className="guide-details" id={anchor} ref={ref}>
      <summary>
        <Anchored id={anchor} alias={block.id}>
          {block.details}
        </Anchored>
      </summary>
      <div className="guide-details__body">
        {block.blocks.map((inner, i) => (
          <Block key={i} block={inner} />
        ))}
      </div>
    </details>
  );
};

const Block = ({ block }: { block: GuideBlock }) => {
  if ('h2' in block)
    return (
      <h2 id={markdownAnchor(block.h2)}>
        <Anchored id={markdownAnchor(block.h2)} alias={headingId(block)}>
          {block.h2}
        </Anchored>
      </h2>
    );
  if ('details' in block) return <Disclosure block={block} />;
  if ('h3' in block) return <h3>{block.h3}</h3>;
  if ('live' in block) {
    if (isChartBlock(block.live))
      return (
        <Demo>
          <ChartDemo id={block.live} />
        </Demo>
      );
    const Live = live[block.live];
    return <Live />;
  }
  if ('code' in block) {
    const lang = block.lang ?? 'tsx';
    return (
      <CodeBlock
        code={block.code}
        label={block.file ?? lang}
        plain={lang === 'text' || lang === 'md'}
        maxHeight={block.maxHeight}
      />
    );
  }
  return <Prose md={block.md} />;
};

export const DocPage = ({ guide, route }: { guide: Guide; route: string }) => {
  useDocumentTitle(guide.title, BRAND.name);
  const toc: TocItem[] = guide.blocks
    .filter((b): b is { h2: string; id?: string } => 'h2' in b)
    .map((b) => ({ id: markdownAnchor(b.h2), title: b.h2 }));

  return (
    <DocsLayout route={route} toc={toc}>
      <header className="docs-head">
        <span className="docs-head__section">{guide.section}</span>
        <h1>{guide.title}</h1>
        <p className="lede">{guide.description}</p>
        <div className="docs-head__actions">
          <CopyButton kind="markdown" label={COPY_PAGE_LABEL} getText={() => guideMarkdown(guide)} title="Copies this page as Markdown text, to paste into an AI assistant such as Claude or ChatGPT" />
        </div>
      </header>
      <div className={`docs-content guide guide--${guide.slug}`}>
        {providerNote(guide) && (
          <div className="guide-note">
            <Prose md={providerNote(guide)!} />
          </div>
        )}
        {guide.blocks.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>
    </DocsLayout>
  );
};
