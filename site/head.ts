import { useEffect } from 'react';
import { BRAND } from './config';
import { getVariant } from './catalog/registry';
import { markdownPath, sitePages } from './content/pages';
import { getEntryBySlug } from './content/routes';

// Per-page head tags: title, description, canonical URL, the Markdown twin and
// Open Graph. headFor() is pure so the prerender step can write the same
// values into static HTML.

export type Head = {
  title: string;
  description: string;
  canonical: string;
  markdown: string;
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
  /** The social card: one image for the whole site (site/public/og.png, 1200 × 630). */
  ogImage: string;
  /** A page that should not be indexed (the not-found page): no canonical, no Markdown twin, `robots: noindex`. */
  noindex?: boolean;
};

// "Why RKit" already names the site; every other title gets it once, at the end.
const withSite = (title: string) => (title.includes(BRAND.name) ? title : `${title} · ${BRAND.name}`);

/** The social card's size and its text, as og:image:* says them. */
export const OG_IMAGE = { path: '/og.png', width: 1200, height: 630, alt: `${BRAND.name}: React charts for your own data` };

export const headFor = (path: string, origin: string = BRAND.url): Head => {
  const abs = (p: string) => `${origin.replace(/\/+$/, '')}${p}`;
  const ogImage = abs(OG_IMAGE.path);
  const page = sitePages().find((p) => p.path === path);

  let title: string;
  let description: string;
  let markdown = markdownPath(path);
  const playground = path.match(/^\/docs\/components\/([\w-]+)\/playground(?:\/[\w-]+)?$/);
  const entry = playground ? getEntryBySlug(playground[1]!) : undefined;

  if (page) {
    title = path === '/' ? page.title : withSite(page.title);
    description = page.description;
  } else if (entry) {
    // A playground has no Markdown of its own: point at the component's page.
    const variant = getVariant(entry, path.split('/')[5]);
    title = withSite(`${variant?.name ?? entry.name} playground`);
    description = `Try ${entry.name} with live data, switch its options and copy the code.`;
    markdown = markdownPath(`/docs/components/${playground![1]}`);
  } else {
    title = withSite('Page not found');
    description = BRAND.tagline;
    return { title, description, canonical: '', markdown: '', ogTitle: title, ogDescription: description, ogUrl: '', ogImage, noindex: true };
  }

  return {
    title,
    description,
    canonical: abs(path),
    markdown: abs(markdown),
    ogTitle: title,
    ogDescription: description,
    ogUrl: abs(path),
    ogImage,
  };
};

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The head tags as HTML, for static pages. A tag with no value is left out. */
export const headTags = (head: Head) =>
  [
    `<title>${escapeHtml(head.title)}</title>`,
    `<meta name="description" content="${escapeHtml(head.description)}" />`,
    head.noindex && `<meta name="robots" content="noindex" />`,
    head.canonical && `<link rel="canonical" href="${escapeHtml(head.canonical)}" />`,
    head.markdown && `<link rel="alternate" type="text/markdown" href="${escapeHtml(head.markdown)}" />`,
    `<meta property="og:title" content="${escapeHtml(head.ogTitle)}" />`,
    `<meta property="og:description" content="${escapeHtml(head.ogDescription)}" />`,
    head.ogUrl && `<meta property="og:url" content="${escapeHtml(head.ogUrl)}" />`,
    `<meta property="og:image" content="${escapeHtml(head.ogImage)}" />`,
    `<meta property="og:image:width" content="${OG_IMAGE.width}" />`,
    `<meta property="og:image:height" content="${OG_IMAGE.height}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(OG_IMAGE.alt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ]
    .filter(Boolean)
    .join('\n    ');

/** Replaces the template's default title and tags with the page's own (no duplicates). */
export const applyHead = (template: string, head: Head) =>
  template
    .replace(/\s*<title>[\s\S]*?<\/title>/g, '')
    .replace(/\s*<meta name="description"[^>]*>/g, '')
    .replace(/\s*<meta property="og:(title|description|url|image(:\w+)?)"[^>]*>/g, '')
    .replace(/\s*<meta name="twitter:card"[^>]*>/g, '')
    .replace(/\s*<link rel="canonical"[^>]*>/g, '')
    .replace(/\s*<link rel="alternate" type="text\/markdown"[^>]*>/g, '')
    .replace(/\s*<meta name="robots"[^>]*>/g, '')
    .replace('</head>', () => `  ${headTags(head)}\n  </head>`);

const upsert = (selector: string, create: () => HTMLElement, attr: string, value: string) => {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
};

const meta = (key: 'name' | 'property', name: string, content: string) =>
  upsert(
    `meta[${key}="${name}"]`,
    () => {
      const el = document.createElement('meta');
      el.setAttribute(key, name);
      return el;
    },
    'content',
    content,
  );

const link = (rel: string, href: string, type?: string) =>
  upsert(
    `link[rel="${rel}"]${type ? `[type="${type}"]` : ''}`,
    () => {
      const el = document.createElement('link');
      el.setAttribute('rel', rel);
      if (type) el.setAttribute('type', type);
      return el;
    },
    'href',
    href,
  );

const remove = (selector: string) => document.head.querySelector(selector)?.remove();

export const useHead = (route: string) => {
  useEffect(() => {
    const head = headFor(route);
    document.title = head.title;
    meta('name', 'description', head.description);
    meta('property', 'og:title', head.ogTitle);
    meta('property', 'og:description', head.ogDescription);
    meta('property', 'og:image', head.ogImage);
    if (head.noindex) meta('name', 'robots', 'noindex');
    else remove('meta[name="robots"]');
    if (head.ogUrl) meta('property', 'og:url', head.ogUrl);
    else remove('meta[property="og:url"]');
    if (head.canonical) link('canonical', head.canonical);
    else remove('link[rel="canonical"]');
    if (head.markdown) link('alternate', head.markdown, 'text/markdown');
    else remove('link[rel="alternate"][type="text/markdown"]');
  }, [route]);
};
