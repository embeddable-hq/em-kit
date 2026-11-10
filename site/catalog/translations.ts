import type { Dataset } from './datasets';
import type { LanguageId } from './themes';

// Site content (titles, field names, dimension values) translated through the
// library's own i18n: titles are "key|fallback" strings, field titles resolve
// from measure.<name> / dimension.<name>, values from dimension.<name>.<value>.

type Translated = Exclude<LanguageId, 'en'>;
type Dict = Record<string, Record<Translated, string>>;

const fields: Dict = {
  revenue: { de: 'Umsatz', fr: 'Chiffre d’affaires' },
  customers: { de: 'Kunden', fr: 'Clients' },
  seats: { de: 'Plätze', fr: 'Licences' },
  region: { de: 'Region', fr: 'Région' },
  plan: { de: 'Tarif', fr: 'Offre' },
  'subscriptions.started_at': { de: 'Startdatum', fr: 'Date de début' },
  sessions: { de: 'Sitzungen', fr: 'Sessions' },
  conversions: { de: 'Conversions', fr: 'Conversions' },
  bounce_rate: { de: 'Absprungrate', fr: 'Taux de rebond' },
  channel: { de: 'Kanal', fr: 'Canal' },
  device: { de: 'Gerät', fr: 'Appareil' },
  'sessions.visited_at': { de: 'Besuchsdatum', fr: 'Date de visite' },
  sales: { de: 'Umsatz', fr: 'Ventes' },
  units: { de: 'Einheiten', fr: 'Unités' },
  margin: { de: 'Marge', fr: 'Marge' },
  product_category: { de: 'Kategorie', fr: 'Catégorie' },
  store: { de: 'Filiale', fr: 'Magasin' },
  'orders.ordered_at': { de: 'Bestelldatum', fr: 'Date de commande' },
  deal_stage: { de: 'Phase', fr: 'Étape' },
  funnel_step: { de: 'Funnel-Schritt', fr: 'Étape du tunnel' },
  order_stage: { de: 'Bestellschritt', fr: 'Étape de commande' },
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
    Flagship: { de: 'Flagship-Store', fr: 'Boutique phare' },
    Outlet: { de: 'Outlet', fr: 'Magasin d’usine' },
  },
};

// Keyed by chart entry id; English lives in the registry as the fallback.
const chartTitles: Dict = {
  kpi: { de: 'Letzte 30 Tage', fr: '30 derniers jours' },
  'kpi-comparison': { de: 'Letzte 30 Tage', fr: '30 derniers jours' },
  bar: { de: 'Nach Kategorie', fr: 'Par catégorie' },
  'bar-horizontal': { de: 'Nach Wert sortiert', fr: 'Classé par valeur' },
  'bar-stacked': { de: 'Zusammensetzung', fr: 'Composition' },
  'bar-stacked-horizontal': { de: 'Zusammensetzung', fr: 'Composition' },
  'bar-grouped': { de: 'Im Vergleich', fr: 'Côte à côte' },
  'bar-grouped-horizontal': { de: 'Im Vergleich', fr: 'Côte à côte' },
  'bar-line': { de: 'Im Zeitverlauf', fr: 'Dans le temps' },
  line: { de: 'Trend', fr: 'Tendance' },
  'line-grouped': { de: 'Trend nach Segment', fr: 'Tendance par segment' },
  'line-comparison': { de: 'Gegenüber dem Vorzeitraum', fr: 'Par rapport à la période précédente' },
  'line-with-kpi-tabs': { de: 'Trend nach Kennzahl', fr: 'Tendance par mesure' },
  'line-comparison-with-kpi-tabs': { de: 'Vorzeitraum nach Kennzahl', fr: 'Période précédente par mesure' },
  area: { de: 'Anteil im Zeitverlauf', fr: 'Contribution dans le temps' },
  pie: { de: 'Anteil am Gesamtwert', fr: 'Part du total' },
  funnel: { de: 'Trichter', fr: 'Entonnoir' },
  donut: { de: 'Anteil am Gesamtwert', fr: 'Part du total' },
  'donut-label': { de: 'Anteil am Gesamtwert', fr: 'Part du total' },
  scatter: { de: 'Korrelation', fr: 'Corrélation' },
  bubble: { de: 'Drei Kennzahlen auf einmal', fr: 'Trois mesures à la fois' },
  table: { de: 'Aufschlüsselung', fr: 'Répartition' },
  'table-scrollable': { de: 'Tagesdetails', fr: 'Détail quotidien' },
  pivot: { de: 'Kreuztabelle', fr: 'Tableau croisé' },
  // Gallery presets, keyed `${entry}--${variant}`.
  'bar--monthly': { de: 'Monatlich', fr: 'Mensuel' },
  'bar--growth': { de: 'Monatliches Wachstum', fr: 'Croissance mensuelle' },
  'line--filled': { de: 'Volumen im Zeitverlauf', fr: 'Volume dans le temps' },
  'line--dashed-labels': { de: 'Monat für Monat', fr: 'Mois par mois' },
  'line-grouped--filled': { de: 'Segmente im Zeitverlauf', fr: 'Segments dans le temps' },
  'pivot--summary-stats': { de: 'Durchschnitt, Min. und Max.', fr: 'Moyenne, min. et max.' },
  'pivot--share': { de: 'Anteil am Gesamtwert', fr: 'Part du total' },
  heatmap: { de: 'Brennpunkte', fr: 'Points chauds' },
};

const labels: Dict = {
  total: { de: 'Gesamt', fr: 'Total' },
};

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

// Chart titles and descriptions used by the sample app page.
const app: Record<string, Record<LanguageId, (c: HeroCopy) => string>> = {
  last12: {
    en: (c) => `${c.metric} · Last 12 months`,
    de: (c) => `${c.metric} · Letzte 12 Monate`,
    fr: (c) => `${c.metric} · 12 derniers mois`,
  },
  filterHint: {
    en: () => 'Click a segment to filter the whole dashboard',
    de: () => 'Segment anklicken, um das gesamte Dashboard zu filtern',
    fr: () => 'Cliquez sur un segment pour filtrer tout le tableau de bord',
  },
};

export type AppKey = keyof typeof app;

const fieldTitle = (name: string, fallback: string, lang: LanguageId) =>
  lang === 'en' ? fallback : (fields[name]?.[lang] ?? fallback);

const heroCopy = (ds: Dataset, lang: LanguageId): HeroCopy => ({
  metric: fieldTitle(ds.specs.primary.name, ds.specs.primary.title, lang),
  group: fieldTitle(ds.specs.group.name, ds.specs.group.title, lang),
});

export const chartTitleKey = (ds: Dataset, entryId: string, fallback: string) =>
  `titles.${ds.id}.${entryId}|${ds.specs.primary.title} · ${fallback}`;

export const heroKey = (ds: Dataset, key: HeroKey) => `hero.${ds.id}.${key}|${hero[key]!.en(heroCopy(ds, 'en'))}`;

export const appKey = (ds: Dataset, key: AppKey) => `app.${ds.id}.${key}|${app[key]!.en(heroCopy(ds, 'en'))}`;

export const labelKey = (key: keyof typeof labels) => `labels.${key}|${key.charAt(0).toUpperCase()}${key.slice(1)}`;

const titleFor = (ds: Dataset, entryId: string, lang: Translated) =>
  `${fieldTitle(ds.specs.primary.name, ds.specs.primary.title, lang)} · ${chartTitles[entryId]?.[lang] ?? ''}`;

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
          Object.fromEntries(Object.entries(app).map(([k, f]) => [k, f[lang](heroCopy(ds, lang))])),
        ]),
      ),
      labels: Object.fromEntries(Object.entries(labels).map(([k, t]) => [k, t[lang]])),
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
  return {
    titles: { [`${ds.id}.${entryId}`]: titleFor(ds, entryId, lang) },
    ...(Object.keys(measure).length ? { measure } : {}),
    ...(Object.keys(dimension).length ? { dimension } : {}),
  };
};
