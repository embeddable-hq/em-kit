// Name decided 2026-11-17: EmKit, npm package em-kit, at emkit.embeddable.com.
// "em" is the prefix of every theme variable (--em-*) and short for Embeddable.
export const BRAND = {
  name: 'EmKit',
  packageName: 'em-kit',
  // Where the site will be published: used for canonical links, llms.txt and the sitemap.
  url: 'https://emkit.embeddable.com',
  tagline: 'Finished React chart components for teams that already have a data layer. A chart library draws the chart; EmKit, by Embeddable, ships the whole card.',
  // Who makes it. Every page says so (header and footer), and so do llms.txt,
  // the Markdown home page, the README and package.json.
  maker: { name: 'Embeddable', url: 'https://embeddable.com' },
  // How EmKit relates to Embeddable and to Remarkable Pro, in one wording for
  // the Why page, llms.txt and the README. EmKit is the components on their
  // own; Remarkable Pro is their name inside Embeddable, and is only named there.
  relation:
    'EmKit is Embeddable’s chart components as a standalone React library: you bring the data. Inside Embeddable the same components are called Remarkable Pro.',
  // The way in to the platform, for teams that need what EmKit leaves out.
  platform: 'Embeddable adds the data layer, multi-tenant security and self-serve dashboards for your customers.',
};

// Tracking as embeddable.com does it (public-website repo, src/lib/analytics.ts):
// Consent Mode denied by default, the Usercentrics banner, then GTM once the
// banner sends UC_CONSENT. Only on BRAND.url's host, so previews and local
// builds send nothing. Links to the maker carry `outboundEvent` as
// data-gtm-event, which the container's click trigger matches.
export const TRACKING = {
  host: new URL(BRAND.url).hostname,
  gtmId: 'GTM-5JVQ8XW',
  gtmScript: 'https://t.embeddable.com/gtm.js',
  usercentricsRuleset: 'hqENIjhi_48l7t',
  usercentricsLoader: 'https://web.cmp.usercentrics.eu/ui/loader.js',
  outboundEvent: 'emkit_to_embeddable',
};

/** A link's data-gtm-event: set on links to the maker only. */
export const gtmEventFor = (href?: string) => (href?.startsWith(BRAND.maker.url) ? TRACKING.outboundEvent : undefined);

/** The maker as a Markdown link, and the platform sentence with the maker linked. */
export const makerLink = `[${BRAND.maker.name}](${BRAND.maker.url})`;
export const platformMarkdown = BRAND.platform.replace(BRAND.maker.name, makerLink);
