// @vitest-environment node
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
// @ts-expect-error: a plain .mjs script, shared with `npm run site:check`
import { checkServed } from '../scripts/served-check.mjs';

// The built site, served by scripts/site-preview.mjs on a free port and read
// over HTTP as an agent with curl reads it: llms.txt, every link in it, and
// every link in every .md, each checked for its status, content type and first
// line, plus the _headers file that pins those content types in production.
// It reads dist-site (npm run site:build). A copy is served, so a build running
// at the same time cannot pull files out from under the requests.

const built = join(__dirname, '../dist-site');
const hasBuild = existsSync(join(built, 'llms.txt'));
const copy = hasBuild ? mkdtempSync(join(tmpdir(), 'rkit-site-')) : '';
if (hasBuild) cpSync(built, copy, { recursive: true });
afterAll(() => {
  if (copy) rmSync(copy, { recursive: true, force: true });
});

describe.skipIf(!hasBuild)('the built site over HTTP (needs npm run site:build)', () => {
  it('answers every llms.txt link and every link in every .md with 200, the right type and a real first line', { timeout: 60_000 }, async () => {
    const { problems, fetched } = (await checkServed(copy)) as { problems: string[]; fetched: number };
    expect(problems).toEqual([]);
    // The index, its 40-odd links and the pages they lead to, at least.
    expect(fetched).toBeGreaterThan(45);
  });
});
