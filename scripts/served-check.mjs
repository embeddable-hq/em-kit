// Fetches the built site over HTTP the way an agent with curl would: llms.txt,
// every link in it, and every link in every built .md (relative links and the
// site's own absolute URLs), checking each answer's status, content type and
// first line. Also checks that dist-site/_headers pins the content type of
// every .md and llms*.txt for the production host. Used by
// tests/served.test.ts and by `npm run site:check`.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseHeaders, startPreview } from './site-preview.mjs';

const MARKDOWN = 'text/markdown; charset=utf-8';
const TEXT = 'text/plain; charset=utf-8';
const HTML = 'text/html; charset=utf-8';

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));

/** What a URL path should come back as: its content type and a test for its first line. */
const expectFor = (path) => {
  if (path.endsWith('.md')) return { type: MARKDOWN, first: (line) => line.startsWith('# ') };
  if (path.endsWith('.txt')) return { type: TEXT, first: (line) => line.startsWith('# ') || line.startsWith('User-agent:') };
  if (path.endsWith('.xml')) return { type: 'application/xml; charset=utf-8', first: (line) => line.startsWith('<?xml') };
  return { type: HTML, first: (line) => /^<!doctype html>/i.test(line) };
};

/**
 * Serves `root` with scripts/site-preview.mjs on a free port and returns the
 * problems found (an empty list when every URL answers as it should), with the
 * number of URLs fetched.
 */
export const checkServed = async (root) => {
  const problems = [];
  const llmsFile = join(root, 'llms.txt');
  if (!existsSync(llmsFile)) return { problems: [`${root}: no llms.txt; run npm run site:build first`], fetched: 0 };

  // The origin the build wrote into its absolute URLs: llms.txt's first link.
  const llms = readFileSync(llmsFile, 'utf-8');
  const origin = new URL(llms.match(/^- \[[^\]]+\]\(([^)]+)\)/m)[1]).origin;

  // _headers: every Markdown twin and llms file, with its content type.
  const headersFile = join(root, '_headers');
  const rules = existsSync(headersFile) ? parseHeaders(readFileSync(headersFile, 'utf-8')) : {};
  if (!existsSync(headersFile)) problems.push('_headers: missing');
  const files = walk(root).map((file) => `/${relative(root, file).split('\\').join('/')}`);
  for (const path of files.filter((p) => p.endsWith('.md') || /^\/llms[\w-]*\.txt$/.test(p))) {
    const want = path.endsWith('.md') ? MARKDOWN : TEXT;
    if (rules[path]?.['Content-Type'] !== want) problems.push(`_headers: ${path} is not pinned to ${want}`);
  }

  // The URLs to fetch, each with where it was found.
  const targets = new Map([['/llms.txt', 'the index']]);
  const add = (url, from) => {
    const target = new URL(url, `${origin}/`);
    if (target.origin !== origin) return;
    if (!targets.has(target.pathname)) targets.set(target.pathname, from);
  };
  for (const [, url] of llms.matchAll(/^- \[[^\]]+\]\(([^)]+)\)/gm)) add(url, '/llms.txt');
  for (const path of files.filter((p) => p.endsWith('.md'))) {
    // Links outside code; the site's absolute URLs anywhere but in code blocks (a table cell's `…/llms.txt` too).
    const text = readFileSync(join(root, path), 'utf-8').replace(/```[\s\S]*?```/g, '');
    for (const [, url] of text.replace(/`[^`\n]*`/g, '').matchAll(/\]\(([^)\s]+)\)/g)) add(url.split('#')[0] || path, path);
    const escaped = origin.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    for (const [url] of text.matchAll(new RegExp(`${escaped}/[^\\s)\\]<>"'\`,]*`, 'g'))) add(url.replace(/[.:;]+$/, ''), path);
  }

  const { server, port } = await startPreview({ root, port: 0 });
  try {
    for (const [path, from] of targets) {
      const response = await fetch(`http://localhost:${port}${path}`, { redirect: 'manual' });
      const body = await response.text();
      const want = expectFor(path);
      const where = `${path} (linked from ${from})`;
      if (response.status !== 200) problems.push(`${where}: status ${response.status}`);
      else if (response.headers.get('content-type') !== want.type) problems.push(`${where}: content type ${response.headers.get('content-type')}, not ${want.type}`);
      else if (!want.first(body.split('\n')[0] ?? '')) problems.push(`${where}: first line is ${JSON.stringify(body.split('\n')[0]?.slice(0, 60))}`);
    }
  } finally {
    await new Promise((done) => server.close(done));
  }
  return { problems, fetched: targets.size };
};
