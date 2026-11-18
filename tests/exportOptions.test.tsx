import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  BarChart,
  ChartsProvider,
  TablePaginated,
  defaultTheme,
  dimension,
  measure,
  results,
  type ChartsProviderProps,
  type Theme,
} from '../src';
import type { ChartCardMenuOption } from '../src';
import { CopyJsonMenu } from '../site/examples/CopyJsonMenu';
import { CustomDownloads } from '../site/examples/CustomDownloads';

// What someone using the package can do to the card menu (the ⋮ on a chart):
// add an entry of their own, change what a built-in entry does, and take
// entries away. Everything here uses the package's public exports only.

// Chart.js needs a canvas, which jsdom does not have.
vi.mock('react-chartjs-2', () => {
  const chart = () => () => null;
  return {
    getElementAtEvent: () => [],
    getElementsAtEvent: () => [],
    getDatasetAtEvent: () => [],
    Bar: chart(),
    Line: chart(),
    Pie: chart(),
    Doughnut: chart(),
    Scatter: chart(),
    Bubble: chart(),
    Chart: chart(),
  };
});

// The PNG download draws the card to an image, which jsdom cannot.
const { toPng } = vi.hoisted(() => ({
  toPng: vi.fn(async (_element: HTMLElement, _options: { bgcolor?: string }) => 'data:image/png;base64,iVBORw0KGgo='),
}));
vi.mock('dom-to-image-more', () => ({ default: { toPng } }));

// The exported name and the theme's own type are the same thing.
type MenuOption = ChartCardMenuOption;
const _sameType: Theme['defaults']['chartMenuOptions'][number] = {} as MenuOption;
void _sameType;
type MenuArgs = Parameters<MenuOption['onClick']>[0];

const builtIn = defaultTheme.defaults.chartMenuOptions;
const region = dimension({ name: 'region', title: 'Region' });
const revenue = measure({ name: 'revenue', title: 'Revenue' });
const rows = [
  { region: 'Europe', revenue: 120 },
  { region: 'Asia', revenue: 80 },
];

const downloads: Blob[] = [];
const realCreate = URL.createObjectURL;
const realRevoke = URL.revokeObjectURL;
const realClick = HTMLAnchorElement.prototype.click;
const realRect = Element.prototype.getBoundingClientRect;
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.getBoundingClientRect = () =>
    ({ x: 0, y: 0, left: 0, top: 0, right: 600, bottom: 400, width: 600, height: 400, toJSON: () => ({}) }) as DOMRect;
  URL.createObjectURL = (blob: Blob) => {
    downloads.push(blob);
    return 'blob:download';
  };
  URL.revokeObjectURL = () => {};
  HTMLAnchorElement.prototype.click = () => {};
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect;
  URL.createObjectURL = realCreate;
  URL.revokeObjectURL = realRevoke;
  HTMLAnchorElement.prototype.click = realClick;
});

let unmountLast = () => {};
afterEach(() => {
  unmountLast();
  unmountLast = () => {};
  downloads.length = 0;
});

const mount = (theme: ChartsProviderProps['theme'], node: React.ReactNode) => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <ChartsProvider theme={theme}>
        <div style={{ height: 400 }}>{node}</div>
      </ChartsProvider>,
    ),
  );
  unmountLast = () => {
    act(() => root.unmount());
    container.remove();
  };
  return container;
};

const waitFor = async (check: () => boolean, ms = 3000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (check()) return true;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
  return check();
};

const trigger = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-no-export] [aria-haspopup="menu"]');
// While an entry's function is running, the trigger is a spinner, not a button.
const ready = (container: HTMLElement) => trigger(container)?.tagName === 'BUTTON';

const openMenu = (container: HTMLElement) => {
  act(() => {
    trigger(container)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  return [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
};

const choose = (container: HTMLElement, label: string) => {
  const item = openMenu(container).find((el) => el.textContent === label);
  expect(item, `no "${label}" in the menu`).toBeDefined();
  act(() => item!.click());
};

const chart = (menuOptions?: string[]) => (
  <BarChart title="Revenue by region" dimension={region} measures={[revenue]} results={results(rows)} menuOptions={menuOptions} />
);

describe('custom card menu entries', () => {
  // First in the file on purpose: see the last test in this block.
  it('labels an entry from a translation the theme adds', () => {
    const container = mount(
      {
        defaults: {
          chartMenuOptions: [...builtIn, { value: 'json', labelKey: 'charts.menuOptions.copyJSON', onClick: () => {} }],
        },
        i18n: { translations: { en: { translation: { charts: { 'menuOptions.copyJSON': 'Copy as JSON' } } } } },
      },
      chart(['csv', 'json']),
    );
    expect(openMenu(container).map((el) => el.textContent)).toEqual(['Download CSV', 'Copy as JSON']);
  });

  it('adds an entry, which gets the chart’s title, rows and fields', async () => {
    const calls: MenuArgs[] = [];
    const json: MenuOption = { value: 'json', labelKey: 'Copy as JSON', onClick: (args) => void calls.push(args) };
    const container = mount({ defaults: { chartMenuOptions: [...builtIn, json] } }, chart(['csv', 'json']));

    // A label with no translation is shown as written.
    const items = openMenu(container);
    expect(items.map((el) => el.textContent)).toEqual(['Download CSV', 'Copy as JSON']);
    act(() => items[1]!.click());
    expect(await waitFor(() => calls.length === 1)).toBe(true);

    const args = calls[0]!;
    expect(args.title).toBe('Revenue by region');
    expect(args.data).toEqual(rows);
    expect(args.dimensionsAndMeasures?.map((field) => field.name)).toEqual(['region', 'revenue']);
    expect(args.theme.defaults.chartMenuOptions.map((option) => option.value)).toContain('json');
    expect(args.containerRef?.current).toBeInstanceOf(HTMLElement);
    expect(args.cardRef?.current).toBeInstanceOf(HTMLElement);
    expect(downloads).toHaveLength(0);
  });

  it('keeps an entry out of a chart that does not list it', () => {
    const json: MenuOption = { value: 'json', labelKey: 'Copy as JSON', onClick: () => {} };
    const container = mount({ defaults: { chartMenuOptions: [...builtIn, json] } }, chart());
    expect(openMenu(container).map((el) => el.textContent)).toEqual([
      'Download CSV',
      'Download XLSX',
      'Download PNG',
      'Maximize',
    ]);
  });

  it('shows the theme’s order, not the order of the menuOptions prop', () => {
    const json: MenuOption = { value: 'json', labelKey: 'Copy as JSON', onClick: () => {} };
    const container = mount({ defaults: { chartMenuOptions: [json, ...builtIn] } }, chart(['png', 'json']));
    expect(openMenu(container).map((el) => el.textContent)).toEqual(['Copy as JSON', 'Download PNG']);
  });

  it('replaces what a built-in entry does', async () => {
    const mine = vi.fn();
    const options = builtIn.map((option) => (option.value === 'csv' ? { ...option, onClick: mine } : option));
    const container = mount({ defaults: { chartMenuOptions: options } }, chart());
    choose(container, 'Download CSV');
    expect(await waitFor(() => mine.mock.calls.length === 1)).toBe(true);
    expect(downloads).toHaveLength(0);
  });

  it('wraps a built-in entry: its own download still runs', async () => {
    const before = vi.fn();
    const options = builtIn.map((option) =>
      option.value === 'csv'
        ? {
            ...option,
            onClick: (args: MenuArgs) => {
              before(args.title);
              return option.onClick(args);
            },
          }
        : option,
    );
    const container = mount({ defaults: { chartMenuOptions: options } }, chart());
    choose(container, 'Download CSV');
    expect(await waitFor(() => downloads.length === 1)).toBe(true);
    expect(before).toHaveBeenCalledWith('Revenue by region');
    expect(await downloads[0]!.text()).toBe('Region,Revenue\r\nEurope,120\r\nAsia,80');
  });

  it('hands an entry its own settings', async () => {
    const calls: MenuArgs[] = [];
    const options = builtIn.map((option) =>
      option.value === 'png'
        ? { ...option, options: { pngBackgroundColor: '#ffffff', captureFullCard: true }, onClick: (args: MenuArgs) => void calls.push(args) }
        : option,
    );
    const container = mount({ defaults: { chartMenuOptions: options } }, chart());
    choose(container, 'Download PNG');
    expect(await waitFor(() => calls.length === 1)).toBe(true);
    expect(calls[0]!.options).toEqual({ pngBackgroundColor: '#ffffff', captureFullCard: true });
  });

  it('a list without the built-in entries removes them', () => {
    const json: MenuOption = { value: 'json', labelKey: 'Copy as JSON', onClick: () => {} };
    const listed = mount({ defaults: { chartMenuOptions: [json] } }, chart(['csv', 'json']));
    expect(openMenu(listed).map((el) => el.textContent)).toEqual(['Copy as JSON']);
    unmountLast();
    // No entry left for this chart: the ⋮ button is not drawn at all.
    const none = mount({ defaults: { chartMenuOptions: [json] } }, chart());
    expect(trigger(none)).toBeNull();
  });

  it('shows the spinner until an async entry settles', async () => {
    let finish = () => {};
    const slow: MenuOption = {
      value: 'slow',
      labelKey: 'Send to warehouse',
      onClick: () => new Promise<void>((resolve) => (finish = resolve)),
    };
    const container = mount({ defaults: { chartMenuOptions: [...builtIn, slow] } }, chart(['slow']));
    choose(container, 'Send to warehouse');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    expect(ready(container)).toBe(false);
    finish();
    expect(await waitFor(() => ready(container))).toBe(true);
  });

  it('gives the menu back when an entry throws', async () => {
    // The error is not swallowed: it reaches the page as an unhandled
    // rejection, which Vitest would report as a failure of its own.
    const vitestListeners = process.listeners('unhandledRejection');
    process.removeAllListeners('unhandledRejection');
    const unhandled: unknown[] = [];
    process.on('unhandledRejection', (reason) => unhandled.push(reason));
    try {
      const broken: MenuOption = {
        value: 'broken',
        labelKey: 'Broken',
        onClick: () => {
          throw new Error('entry failed');
        },
      };
      const container = mount({ defaults: { chartMenuOptions: [broken] } }, chart(['broken']));
      choose(container, 'Broken');
      expect(await waitFor(() => unhandled.length === 1)).toBe(true);
      expect((unhandled[0] as Error).message).toBe('entry failed');
      expect(await waitFor(() => ready(container))).toBe(true);
    } finally {
      process.removeAllListeners('unhandledRejection');
      vitestListeners.forEach((listener) => process.on('unhandledRejection', listener));
    }
  });

  it('runs an instant entry at once, with no spinner', () => {
    const mine = vi.fn();
    const instant: MenuOption = { value: 'open', labelKey: 'Open report', isInstantAction: true, onClick: mine };
    const container = mount({ defaults: { chartMenuOptions: [instant] } }, chart(['open']));
    choose(container, 'Open report');
    expect(mine).toHaveBeenCalledTimes(1);
    expect(ready(container)).toBe(true);
  });

  it('draws an entry’s icon from an SVG data URL', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>';
    const json: MenuOption = {
      value: 'json',
      labelKey: 'Copy as JSON',
      iconSrc: `data:image/svg+xml,${encodeURIComponent(svg)}`,
      onClick: () => {},
    };
    const container = mount({ defaults: { chartMenuOptions: [json] } }, chart(['json']));
    const [item] = openMenu(container);
    expect(item!.querySelector('svg circle')).not.toBeNull();
  });

  it('gives a table entry every row, not the page on screen', async () => {
    const all = Array.from({ length: 25 }, (_, i) => ({ region: `Region ${i + 1}`, revenue: i }));
    const calls: MenuArgs[] = [];
    const json: MenuOption = { value: 'json', labelKey: 'Copy as JSON', onClick: (args) => void calls.push(args) };
    const Table = () => {
      const [state, setState] = useState({ page: 0, isLoadingDownloadData: false });
      return (
        <TablePaginated
          title="Regions"
          dimensionsAndMeasures={[region, revenue]}
          results={results(all.slice(0, 5))}
          totalResults={results([{ total: all.length }])}
          allResults={results(all)}
          pageSize={5}
          state={state}
          setState={setState}
          menuOptions={['json']}
        />
      );
    };
    const container = mount({ defaults: { chartMenuOptions: [...builtIn, json] } }, <Table />);
    choose(container, 'Copy as JSON');
    expect(await waitFor(() => calls.length === 1)).toBe(true);
    expect(calls[0]!.data).toHaveLength(25);
    expect(calls[0]!.title).toBe('Regions');
  });

  // Translations are read once, when the first chart on the page renders (and
  // again when the language changes). A provider mounted later cannot add one.
  it('ignores a translation added after the first chart has rendered', () => {
    const container = mount(
      {
        defaults: {
          chartMenuOptions: [...builtIn, { value: 'pdf', labelKey: 'charts.menuOptions.exportPDF', onClick: () => {} }],
        },
        i18n: { translations: { en: { translation: { charts: { 'menuOptions.exportPDF': 'Export PDF' } } } } },
      },
      chart(['pdf']),
    );
    expect(openMenu(container).map((el) => el.textContent)).toEqual(['charts.menuOptions.exportPDF']);
  });
});

// The two samples on the Card menu guide (site/examples), run as written.
describe('the card menu guide’s examples', () => {
  it('CopyJsonMenu adds an entry that copies the chart’s rows', async () => {
    const writeText = vi.fn(async (_text: string) => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const container = mount(undefined, <CopyJsonMenu />);
    const items = openMenu(container);
    expect(items.map((el) => el.textContent)).toEqual(['Download CSV', 'Download PNG', 'Copy as JSON']);
    act(() => items[2]!.click());
    expect(await waitFor(() => writeText.mock.calls.length === 1)).toBe(true);
    expect(JSON.parse(writeText.mock.calls[0]![0])).toEqual([
      { region: 'Americas', revenue: 527900 },
      { region: 'EMEA', revenue: 391500 },
      { region: 'APAC', revenue: 276300 },
    ]);
    expect(await waitFor(() => ready(container))).toBe(true);
  });

  it('CustomDownloads notes a CSV download and still runs it', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const container = mount(undefined, <CustomDownloads>{chart()}</CustomDownloads>);
    choose(container, 'Download CSV');
    expect(await waitFor(() => downloads.length === 1)).toBe(true);
    expect(info).toHaveBeenCalledWith('CSV downloaded: Revenue by region');
    expect(await downloads[0]!.text()).toBe('Region,Revenue\r\nEurope,120\r\nAsia,80');
    info.mockRestore();
  });

  it('CustomDownloads draws the whole card on white for the PNG', async () => {
    toPng.mockClear();
    const container = mount(undefined, <CustomDownloads>{chart()}</CustomDownloads>);
    choose(container, 'Download PNG');
    expect(await waitFor(() => downloads.length === 1)).toBe(true);
    const [element, options] = toPng.mock.calls[0]!;
    expect(options.bgcolor).toBe('#ffffff');
    // The whole card: its title is inside the element that was drawn.
    expect(element.textContent).toContain('Revenue by region');
  });

  it('without those settings the PNG is the chart alone, on no background', async () => {
    toPng.mockClear();
    const container = mount(undefined, chart());
    choose(container, 'Download PNG');
    expect(await waitFor(() => downloads.length === 1)).toBe(true);
    const [element, options] = toPng.mock.calls[0]!;
    expect(options.bgcolor).toBeUndefined();
    expect(element.textContent).not.toContain('Revenue by region');
  });
});
