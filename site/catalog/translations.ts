import type { Dataset, ExtraSlot, FieldSpec } from './datasets';
import type { LanguageId } from './themes';

// Site content (titles, field names, dimension values) translated through the
// library's own i18n: titles are "key|fallback" strings, field titles resolve
// from measure.<name> / dimension.<name>, values from dimension.<name>.<value>.

type Translated = Exclude<LanguageId, 'en'>;
type Dict = Record<string, Record<Translated, string>>;

const fields: Dict = {
  revenue: { de: 'Umsatz', fr: 'Revenus' },
  customers: { de: 'Kunden', fr: 'Clients' },
  seats: { de: 'Plätze', fr: 'Licences' },
  region: { de: 'Region', fr: 'Région' },
  plan: { de: 'Tarif', fr: 'Offre' },
  startDate: { de: 'Startdatum', fr: 'Date de début' },
  sessions: { de: 'Sitzungen', fr: 'Sessions' },
  conversions: { de: 'Conversions', fr: 'Conversions' },
  bounce_rate: { de: 'Absprungrate', fr: 'Taux de rebond' },
  channel: { de: 'Kanal', fr: 'Canal' },
  device: { de: 'Gerät', fr: 'Appareil' },
  visitDate: { de: 'Besuchsdatum', fr: 'Date de visite' },
  sales: { de: 'Umsatz', fr: 'Ventes' },
  units: { de: 'Einheiten', fr: 'Unités' },
  margin: { de: 'Marge', fr: 'Marge' },
  product_category: { de: 'Kategorie', fr: 'Catégorie' },
  store: { de: 'Filiale', fr: 'Magasin' },
  orderDate: { de: 'Bestelldatum', fr: 'Date de commande' },
  deal_stage: { de: 'Phase', fr: 'Étape' },
  funnel_step: { de: 'Schritt', fr: 'Étape' },
  order_stage: { de: 'Phase', fr: 'Étape' },
  industry: { de: 'Branche', fr: 'Secteur' },
  billing: { de: 'Abrechnung', fr: 'Facturation' },
  signups: { de: 'Anmeldungen', fr: 'Inscriptions' },
  churn_rate: { de: 'Kündigungsrate', fr: 'Taux d’attrition' },
  deals: { de: 'Deals', fr: 'Affaires' },
  account: { de: 'Konto', fr: 'Compte' },
  tickets: { de: 'Tickets', fr: 'Tickets' },
  browser: { de: 'Browser', fr: 'Navigateur' },
  visitor: { de: 'Besucher', fr: 'Visiteur' },
  page_views: { de: 'Seitenaufrufe', fr: 'Pages vues' },
  visitors: { de: 'Besucher', fr: 'Visiteurs' },
  page: { de: 'Seite', fr: 'Page' },
  page_type: { de: 'Seitentyp', fr: 'Type de page' },
  load_time: { de: 'Ladezeit', fr: 'Temps de chargement' },
  age_group: { de: 'Altersgruppe', fr: 'Tranche d’âge' },
  customer: { de: 'Kunde', fr: 'Client' },
  orders: { de: 'Bestellungen', fr: 'Commandes' },
  return_rate: { de: 'Retourenquote', fr: 'Taux de retour' },
  shoppers: { de: 'Käufer', fr: 'Acheteurs' },
  product: { de: 'Produkt', fr: 'Produit' },
  price: { de: 'Preis', fr: 'Prix' },
};

const values: Record<string, Dict> = {
  region: {
    'North America': { de: 'Nordamerika', fr: 'Amérique du Nord' },
    Europe: { de: 'Europa', fr: 'Europe' },
    'Asia Pacific': { de: 'Asien-Pazifik', fr: 'Asie-Pacifique' },
    'Latin America': { de: 'Lateinamerika', fr: 'Amérique latine' },
    'Middle East': { de: 'Naher Osten', fr: 'Moyen-Orient' },
  },
  plan: {
    Starter: { de: 'Starter', fr: 'Découverte' },
    Growth: { de: 'Wachstum', fr: 'Croissance' },
    Enterprise: { de: 'Enterprise', fr: 'Entreprise' },
  },
  channel: {
    'Organic search': { de: 'Organische Suche', fr: 'Recherche organique' },
    Direct: { de: 'Direkt', fr: 'Direct' },
    'Paid search': { de: 'Bezahlte Suche', fr: 'Recherche payante' },
    Social: { de: 'Soziale Medien', fr: 'Réseaux sociaux' },
    Email: { de: 'E-Mail', fr: 'E-mail' },
    Referral: { de: 'Verweise', fr: 'Référents' },
  },
  device: {
    Mobile: { de: 'Mobil', fr: 'Mobile' },
    Desktop: { de: 'Desktop', fr: 'Ordinateur' },
    Tablet: { de: 'Tablet', fr: 'Tablette' },
  },
  product_category: {
    Apparel: { de: 'Bekleidung', fr: 'Vêtements' },
    Footwear: { de: 'Schuhe', fr: 'Chaussures' },
    Home: { de: 'Wohnen', fr: 'Maison' },
    Accessories: { de: 'Accessoires', fr: 'Accessoires' },
    Beauty: { de: 'Beauty', fr: 'Beauté' },
  },
  deal_stage: {
    Lead: { de: 'Lead', fr: 'Prospect' },
    Qualified: { de: 'Qualifiziert', fr: 'Qualifié' },
    Proposal: { de: 'Angebot', fr: 'Proposition' },
    Negotiation: { de: 'Verhandlung', fr: 'Négociation' },
    Won: { de: 'Gewonnen', fr: 'Gagné' },
  },
  funnel_step: {
    'Landing page': { de: 'Landingpage', fr: 'Page d’accueil' },
    'Product page': { de: 'Produktseite', fr: 'Page produit' },
    'Add to cart': { de: 'In den Warenkorb', fr: 'Ajout au panier' },
    Checkout: { de: 'Kasse', fr: 'Paiement' },
    Purchase: { de: 'Kauf', fr: 'Achat' },
  },
  order_stage: {
    Browsed: { de: 'Angesehen', fr: 'Consulté' },
    'Added to basket': { de: 'Im Warenkorb', fr: 'Ajouté au panier' },
    Checkout: { de: 'Kasse', fr: 'Paiement' },
    Paid: { de: 'Bezahlt', fr: 'Payé' },
    Kept: { de: 'Behalten', fr: 'Conservé' },
  },
  store: {
    Online: { de: 'Online', fr: 'En ligne' },
    Flagship: { de: 'Flagship', fr: 'Flagship' },
    Outlet: { de: 'Outlet', fr: 'Outlet' },
  },
  billing: {
    Monthly: { de: 'Monatlich', fr: 'Mensuelle' },
    Annual: { de: 'Jährlich', fr: 'Annuelle' },
  },
  visitor: {
    New: { de: 'Neu', fr: 'Nouveau' },
    Returning: { de: 'Wiederkehrend', fr: 'Récurrent' },
  },
  customer: {
    New: { de: 'Neu', fr: 'Nouveau' },
    Returning: { de: 'Wiederkehrend', fr: 'Récurrent' },
  },
  industry: {
    Health: { de: 'Medizin', fr: 'Santé' },
    Media: { de: 'Medien', fr: 'Médias' },
    Retail: { de: 'Handel', fr: 'Détail' },
    Tech: { de: 'Tech', fr: 'Tech' },
  },
  page_type: {
    Marketing: { de: 'Marketing', fr: 'Marketing' },
    Product: { de: 'Produkt', fr: 'Produit' },
    Content: { de: 'Inhalte', fr: 'Contenu' },
  },
};

// A chart's title says what it plots, so it is built from the fields the
// preview uses: a sentence pattern and the slots that fill it. Every dataset
// and language then gets a title that matches its own data.
export type TitleField = keyof Dataset['specs'] | ExtraSlot;
type Sentence = Record<LanguageId, string>;

const sentences = {
  last30: { en: '{a}, last 30 days', de: '{a}, letzte 30 Tage', fr: '{a}, 30 derniers jours' },
  yearToDate: { en: '{a}, year to date', de: '{a}, seit Jahresbeginn', fr: '{a}, depuis le début de l’année' },
  by: { en: '{a} by {b}', de: '{a} nach {b}', fr: '{a} par {b}' },
  byTwo: { en: '{a} by {b} and {c}', de: '{a} nach {b} und {c}', fr: '{a} par {b} et {c}' },
  byDay: { en: '{a} by day', de: '{a} nach Tag', fr: '{a} par jour' },
  byMonth: { en: '{a} by month', de: '{a} nach Monat', fr: '{a} par mois' },
  byMonthAnd: { en: '{a} by month and {b}', de: '{a} nach Monat und {b}', fr: '{a} par mois et {b}' },
  and: { en: '{a} and {b}', de: '{a} und {b}', fr: '{a} et {b}' },
  andByDay: { en: '{a} and {b} by day', de: '{a} und {b} nach Tag', fr: '{a} et {b} par jour' },
  andByMonth: { en: '{a} and {b} by month', de: '{a} und {b} nach Monat', fr: '{a} et {b} par mois' },
  andBy: { en: '{a} and {b} by {c}', de: '{a} und {b} nach {c}', fr: '{a} et {b} par {c}' },
  andVsPrevious: {
    en: '{a} and {b} vs previous period',
    de: '{a} und {b} ggü. Vorzeitraum',
    fr: '{a} et {b} vs période précédente',
  },
  overTime: { en: '{a} over time', de: '{a} im Zeitverlauf', fr: '{a} dans le temps' },
  byOverTime: { en: '{a} by {b} over time', de: '{a} nach {b} im Zeitverlauf', fr: '{a} par {b} dans le temps' },
  vsPrevious: { en: '{a} vs previous period', de: '{a} ggü. Vorzeitraum', fr: '{a} vs période précédente' },
  vs: { en: '{a} vs {b}', de: '{a} vs. {b}', fr: '{a} vs {b}' },
  vsSized: { en: '{a} vs {b}, sized by {c}', de: '{a} vs. {b}, Größe nach {c}', fr: '{a} vs {b}, taille selon {c}' },
  byShareOfSteps: {
    en: '{a} by {b}, as a share of all steps',
    de: '{a} nach {b}, Anteil an allen Stufen',
    fr: '{a} par {b}, part du total des étapes',
  },
  growth: { en: '{a} growth, month on month', de: '{a}: Wachstum zum Vormonat', fr: '{a} : croissance mensuelle' },
} satisfies Record<string, Sentence>;

type TitleSpec = [keyof typeof sentences, TitleField, TitleField?, TitleField?];

// Keyed by chart entry id, and by `${entry}--${preset}` for a preset.
const chartTitles: Record<string, TitleSpec> = {
  kpi: ['last30', 'secondary'],
  'kpi-comparison': ['last30', 'primary'],
  bar: ['by', 'secondary', 'segment'],
  'bar-horizontal': ['by', 'secondary', 'category'],
  'bar-stacked': ['byMonthAnd', 'primary', 'group'],
  'bar-stacked-horizontal': ['byTwo', 'secondary', 'category', 'group'],
  'bar-grouped': ['byTwo', 'primary', 'segment', 'pair'],
  'bar-grouped-horizontal': ['byTwo', 'secondary', 'group', 'pair'],
  'bar-line': ['andBy', 'secondary', 'rate', 'group'],
  line: ['overTime', 'activity'],
  'line-grouped': ['byOverTime', 'primary', 'group'],
  'line-comparison': ['vsPrevious', 'secondary'],
  'line-with-kpi-tabs': ['and', 'primary', 'secondary'],
  'line-comparison-with-kpi-tabs': ['andVsPrevious', 'activity', 'secondary'],
  area: ['byOverTime', 'secondary', 'group'],
  pie: ['by', 'primary', 'segment'],
  donut: ['by', 'secondary', 'group'],
  'donut-label': ['by', 'primary', 'category'],
  funnel: ['by', 'funnel', 'stage'],
  scatter: ['vs', 'y', 'x'],
  bubble: ['vsSized', 'y', 'x', 'bubble'],
  table: ['andBy', 'primary', 'secondary', 'category'],
  'table-scrollable': ['andByDay', 'primary', 'secondary'],
  pivot: ['byTwo', 'primary', 'category', 'group'],
  heatmap: ['byTwo', 'secondary', 'segment', 'group'],
  // Presets. One that plots other data than its component's default names it;
  // the rest restyle the same data, so they keep its title.
  'kpi--compact': ['yearToDate', 'primary'],
  'kpi--fixed-size': ['last30', 'secondary'],
  'kpi-comparison--percentage-change': ['last30', 'primary'],
  'kpi-comparison--lower-is-better': ['last30', 'rate'],
  'kpi-comparison--precise': ['last30', 'primary'],
  'bar--monthly': ['byMonth', 'primary'],
  'bar--growth': ['growth', 'primary'],
  'bar--axis-titles': ['by', 'secondary', 'segment'],
  'bar--fixed-range': ['by', 'secondary', 'segment'],
  'bar--other-bucket': ['by', 'ranked', 'entity'],
  'bar-horizontal--truncated': ['by', 'secondary', 'category'],
  'bar-grouped--labelled': ['byTwo', 'primary', 'segment', 'pair'],
  'bar-grouped--axis-titles': ['byTwo', 'primary', 'segment', 'pair'],
  'bar-grouped-horizontal--labelled': ['byTwo', 'secondary', 'group', 'pair'],
  'bar-stacked--totals': ['byMonthAnd', 'primary', 'group'],
  'bar-stacked--segment-labels': ['byMonthAnd', 'primary', 'group'],
  'bar-stacked-horizontal--totals': ['byTwo', 'secondary', 'category', 'group'],
  'bar-line--axis-titles': ['andBy', 'secondary', 'rate', 'group'],
  'line--filled': ['overTime', 'activity'],
  'line--dashed-labels': ['overTime', 'activity'],
  'line--fitted-axis': ['overTime', 'activity'],
  'line--granularity-picker': ['overTime', 'activity'],
  'line-grouped--filled': ['byOverTime', 'primary', 'group'],
  'line-comparison--comparison-axis': ['vsPrevious', 'secondary'],
  'line-comparison--styled': ['vsPrevious', 'secondary'],
  'line-with-kpi-tabs--filled': ['and', 'primary', 'secondary'],
  'line-comparison-with-kpi-tabs--comparison-axis': ['andVsPrevious', 'activity', 'secondary'],
  'area--axis-titles': ['byOverTime', 'secondary', 'group'],
  'pie--percentages': ['by', 'primary', 'segment'],
  'pie--other': ['by', 'primary', 'segment'],
  'donut--percentages': ['by', 'secondary', 'group'],
  'donut--minimal': ['by', 'secondary', 'group'],
  'donut-label--percentages': ['by', 'primary', 'category'],
  'donut-label--compact': ['by', 'secondary', 'category'],
  'funnel--step-labels': ['by', 'funnel', 'stage'],
  'funnel--percentages': ['byShareOfSteps', 'funnel', 'stage'],
  'funnel--proportional': ['by', 'funnel', 'stage'],
  'funnel--colours': ['by', 'funnel', 'stage'],
  'funnel--small-card': ['by', 'funnel', 'stage'],
  'scatter--point-labels': ['vs', 'y', 'x'],
  'scatter--single-colour': ['vs', 'y', 'x'],
  'bubble--point-labels': ['vsSized', 'y', 'x', 'bubble'],
  'bubble--size-range': ['vsSized', 'y', 'x', 'bubble'],
  'table--formatted': ['andBy', 'primary', 'secondary', 'category'],
  'table-scrollable--auto-height': ['andByMonth', 'primary', 'secondary'],
  'pivot--summary-stats': ['byTwo', 'primary', 'category', 'group'],
  'pivot--share': ['byTwo', 'primary', 'category', 'group'],
  'pivot--compact': ['byTwo', 'primary', 'category', 'group'],
  'heatmap--colours': ['byTwo', 'secondary', 'segment', 'group'],
  'heatmap--thresholds': ['byTwo', 'secondary', 'segment', 'group'],
  'heatmap--colours-only': ['byTwo', 'secondary', 'segment', 'group'],
};

const labels: Dict = {
  total: { de: 'Gesamt', fr: 'Total' },
};

// The library writes a German quarter out in full ("3. Quartal 2025"), which
// is too wide for four of them to sit level under a small chart. The short
// form reads the same in a business chart.
const quarterLabel: Partial<Record<Translated, string>> = { de: 'Q{{quarter}} {{year}}' };

type HeroCopy = { metric: string; group: string };
const hero: Record<string, Record<LanguageId, (c: HeroCopy) => string>> = {
  last24: {
    en: () => 'Last 24 hours',
    de: () => 'Letzte 24 Stunden',
    fr: () => 'Dernières 24 heures',
  },
  thisHour: {
    en: () => 'This hour, and counting',
    de: () => 'Diese Stunde, laufend',
    fr: () => 'Cette heure, en cours',
  },
  peak: {
    en: () => 'Peak hour',
    de: () => 'Spitzenstunde',
    fr: () => 'Heure de pointe',
  },
  main: {
    en: (c) => `${c.metric} by ${c.group.toLowerCase()} · last 48 hours`,
    de: (c) => `${c.metric} nach ${c.group} · letzte 48 Stunden`,
    fr: (c) => `${c.metric} par ${c.group.toLowerCase()} · dernières 48 heures`,
  },
  mainDescription: {
    en: () => 'Streaming in as it happens',
    de: () => 'Live, während es passiert',
    fr: () => 'En direct, au fil de l’eau',
  },
  share: {
    en: (c) => `Share by ${c.group.toLowerCase()}`,
    de: (c) => `Anteil nach ${c.group}`,
    fr: (c) => `Répartition par ${c.group.toLowerCase()}`,
  },
  shareDescription: {
    en: () => 'Last 24 hours',
    de: () => 'Letzte 24 Stunden',
    fr: () => 'Dernières 24 heures',
  },
};

export type HeroKey = keyof typeof hero;

// Descriptions used by the example dashboard.
const app: Record<string, Record<LanguageId, (c: HeroCopy) => string>> = {
  filterHint: {
    en: () => 'Click a segment to filter the whole dashboard',
    de: () => 'Segment anklicken, um das gesamte Dashboard zu filtern',
    fr: () => 'Cliquez sur un segment pour filtrer tout le tableau de bord',
  },
};

// The example dashboard's chart titles, built like the previews' titles.
const appTitles = {
  last30: ['last30', 'primary'],
  // January to June, the half-year the trend beside it plots.
  yearToDate: ['yearToDate', 'primary'],
  share: ['by', 'primary', 'group'],
  trend: ['overTime', 'primary'],
  byCategory: ['by', 'primary', 'category'],
  breakdown: ['andBy', 'primary', 'secondary', 'category'],
} satisfies Record<string, TitleSpec>;

export type AppKey = keyof typeof app | keyof typeof appTitles;

const fieldTitle = (name: string, fallback: string, lang: LanguageId) =>
  lang === 'en' ? fallback : (fields[name]?.[lang] ?? fallback);

const heroCopy = (ds: Dataset, lang: LanguageId): HeroCopy => ({
  metric: fieldTitle(ds.specs.primary.name, ds.specs.primary.title, lang),
  group: fieldTitle(ds.specs.group.name, ds.specs.group.title, lang),
});

const specOf = (ds: Dataset, field: TitleField): FieldSpec =>
  field in ds.specs ? ds.specs[field as keyof Dataset['specs']] : ds.extra[field as ExtraSlot];

// A field's name opens the sentence as written and is lower-cased inside it,
// except in German, where nouns keep their capital.
const fill = (ds: Dataset, [sentence, ...refs]: TitleSpec, lang: LanguageId) => {
  const names = refs.map((field) => {
    if (!field) return '';
    const spec = specOf(ds, field);
    return fieldTitle(spec.name, spec.title, lang);
  });
  return sentences[sentence][lang].replace(/\{([abc])\}/g, (_, slot: string) => {
    const index = 'abc'.indexOf(slot);
    const name = names[index] ?? '';
    return index === 0 || lang === 'de' ? name : name.charAt(0).toLowerCase() + name.slice(1);
  });
};

/** A chart's title for a dataset, e.g. "Customers by company size"; undefined for an id with no title. */
export const chartTitle = (ds: Dataset, entryId: string, lang: LanguageId = 'en') => {
  const spec = chartTitles[entryId];
  return spec ? fill(ds, spec, lang) : undefined;
};

export const chartTitleKey = (ds: Dataset, entryId: string, fallback: string) =>
  `titles.${ds.id}.${entryId}|${chartTitle(ds, entryId) ?? fallback}`;

export const heroKey = (ds: Dataset, key: HeroKey) => `hero.${ds.id}.${key}|${hero[key]!.en(heroCopy(ds, 'en'))}`;

const appText = (ds: Dataset, key: AppKey, lang: LanguageId) =>
  key in appTitles ? fill(ds, appTitles[key as keyof typeof appTitles], lang) : app[key]![lang](heroCopy(ds, lang));

export const appKey = (ds: Dataset, key: AppKey) => `app.${ds.id}.${key}|${appText(ds, key, 'en')}`;

export const labelKey = (key: keyof typeof labels) => `labels.${key}|${key.charAt(0).toUpperCase()}${key.slice(1)}`;

const titleFields = (ds: Dataset) => [...Object.keys(ds.specs), ...Object.keys(ds.extra)] as TitleField[];

/** A field's own name as a translatable string, for axis titles. */
export const fieldLabelKey = (ds: Dataset, field: TitleField) => `fieldLabels.${ds.id}.${field}|${specOf(ds, field).title}`;

const titleFor = (ds: Dataset, entryId: string, lang: Translated) => chartTitle(ds, entryId, lang) ?? '';

const fieldAndValueKeys = (lang: Translated) => {
  const measure: Record<string, string> = {};
  const dimension: Record<string, string> = {};
  for (const [name, t] of Object.entries(fields)) {
    measure[name] = t[lang];
    dimension[name] = t[lang];
  }
  for (const [name, vals] of Object.entries(values)) {
    for (const [value, t] of Object.entries(vals)) dimension[`${name}.${value}`] = t[lang];
  }
  return { measure, dimension };
};

export const siteTranslations = (datasets: Dataset[]) => {
  const build = (lang: Translated) => ({
    translation: {
      titles: Object.fromEntries(
        datasets.map((ds) => [ds.id, Object.fromEntries(Object.keys(chartTitles).map((id) => [id, titleFor(ds, id, lang)]))]),
      ),
      hero: Object.fromEntries(
        datasets.map((ds) => [
          ds.id,
          Object.fromEntries(Object.entries(hero).map(([k, f]) => [k, f[lang](heroCopy(ds, lang))])),
        ]),
      ),
      app: Object.fromEntries(
        datasets.map((ds) => [
          ds.id,
          Object.fromEntries(
            [...Object.keys(app), ...Object.keys(appTitles)].map((k) => [k, appText(ds, k as AppKey, lang)]),
          ),
        ]),
      ),
      labels: Object.fromEntries(Object.entries(labels).map(([k, t]) => [k, t[lang]])),
      ...(quarterLabel[lang] ? { granularity: { quarter: quarterLabel[lang] } } : {}),
      fieldLabels: Object.fromEntries(
        datasets.map((ds) => [
          ds.id,
          Object.fromEntries(
            titleFields(ds).map((field) => {
              const spec = specOf(ds, field);
              return [field, fieldTitle(spec.name, spec.title, lang)];
            }),
          ),
        ]),
      ),
      ...fieldAndValueKeys(lang),
    },
  });
  return { de: build('de'), fr: build('fr') };
};

// The subset of translations one chart needs, for the generated code.
export const snippetTranslations = (
  ds: Dataset,
  entryId: string,
  fieldNames: { name: string; kind: 'dimension' | 'measure' }[],
  lang: LanguageId,
) => {
  if (lang === 'en') return null;
  const measure: Record<string, string> = {};
  const dimension: Record<string, string> = {};
  for (const { name, kind } of fieldNames) {
    const t = fields[name]?.[lang];
    if (!t) continue;
    if (kind === 'measure') measure[name] = t;
    else {
      dimension[name] = t;
      for (const [value, vt] of Object.entries(values[name] ?? {})) dimension[`${name}.${value}`] = vt[lang];
    }
  }
  // A chart that plots quarters carries the site's short quarter label too.
  const quarters = /Quarter/.test(chartTitles[entryId]?.[0] ?? '') ? quarterLabel[lang] : undefined;
  return {
    titles: { [`${ds.id}.${entryId}`]: titleFor(ds, entryId, lang) },
    ...(quarters ? { granularity: { quarter: quarters } } : {}),
    ...(Object.keys(measure).length ? { measure } : {}),
    ...(Object.keys(dimension).length ? { dimension } : {}),
  };
};
