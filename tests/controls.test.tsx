import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  ChartsProvider,
  ComparisonPeriodSelect,
  DateRangePicker,
  DateRangePickerCustom,
  GranularitySelect,
  MultiSelect,
  SingleSelect,
  TextField,
  dateRangePreset,
  defaultComparisonPeriodOptions,
  defaultDateRangeOptions,
  dimension,
  optionsOf,
  results,
  useComparisonRange,
} from '../src';
import type { Granularity, TimeRange } from '../src';
import { loadDayjsLocale } from '../src/generated/utils/date.utils';

// The controls, used as an app with its own data layer uses them: a value in,
// `onChange` out, and nothing from Embeddable in between. The gallery's smoke,
// example and page tests cover each one's rendering; these hold the behaviour
// the docs promise.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mount = (node: React.ReactElement, theme?: React.ComponentProps<typeof ChartsProvider>['theme']) => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(<ChartsProvider theme={theme}>{node}</ChartsProvider>));
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

const server = (node: React.ReactElement, theme?: React.ComponentProps<typeof ChartsProvider>['theme']) =>
  renderToString(<ChartsProvider theme={theme}>{node}</ChartsProvider>);

const region = dimension({ name: 'region', title: 'Region' });
const regions = results([{ region: 'Europe' }, { region: 'Asia Pacific' }, { region: 'North America' }]);
const noop = () => {};

describe('controls', () => {
  it('each renders its title on a server, in English, with no browser', () => {
    const controls: [string, React.ReactElement][] = [
      ['DateRangePicker', <DateRangePicker title="Dates" selectedValue={dateRangePreset('Last 30 days')} onChange={noop} />],
      ['DateRangePickerCustom', <DateRangePickerCustom title="Dates" onChange={noop} />],
      ['GranularitySelect', <GranularitySelect title="Dates" granularity="month" onChange={noop} />],
      ['ComparisonPeriodSelect', <ComparisonPeriodSelect title="Dates" comparisonPeriod="Previous period" onChange={noop} />],
      ['SingleSelect', <SingleSelect title="Dates" dimension={region} results={regions} />],
      ['MultiSelect', <MultiSelect title="Dates" dimension={region} results={regions} />],
      ['TextField', <TextField title="Dates" />],
    ];
    for (const [name, element] of controls) expect(server(element), name).toContain('<h3>Dates</h3>');
  });

  it('a date picker in another language draws once that language’s date names are loaded', async () => {
    const french = { i18n: { language: 'fr' }, formatter: { locale: 'fr-FR' } };
    const picker = <DateRangePickerCustom title="Dates" onChange={noop} />;
    expect(server(picker, french)).toBe('');
    await loadDayjsLocale('fr');
    expect(server(picker, french)).toContain('<h3>Dates</h3>');
    // And English still draws at once after it: each render picks its own language.
    expect(server(picker)).toContain('<h3>Dates</h3>');
  });
});

describe('placeholders and presets', () => {
  it('a default placeholder is in the provider’s language', () => {
    const select = <SingleSelect dimension={region} results={regions} />;
    expect(server(select)).toContain('Select value...');
    expect(server(select, { i18n: { language: 'de' } })).toContain('Wert auswählen…');
    expect(server(select, { i18n: { language: 'fr' } })).toContain('Sélectionner une valeur…');
    expect(server(<SingleSelect dimension={region} results={regions} placeholder="Any region" />, { i18n: { language: 'de' } })).toContain('Any region');
  });

  it('a theme changes one preset or comparison and keeps the rest, from the exported lists', () => {
    expect(defaultDateRangeOptions.map((o) => o.value)).toContain('Last 30 days');
    expect(defaultComparisonPeriodOptions.map((o) => o.value)).toContain('Previous period');
    const fixed = { from: new Date('2026-01-01T00:00:00Z'), to: new Date('2026-01-31T23:59:59.999Z'), relativeTimeString: '' };
    const theme = {
      defaults: {
        dateRangesOptions: defaultDateRangeOptions.map((option) =>
          option.value === 'Last 30 days' ? { ...option, getRange: () => fixed } : option,
        ),
      },
    };
    const onChange = vi.fn<(range: TimeRange) => void>();
    const { unmount } = mount(<DateRangePicker selectedValue={dateRangePreset('Last 30 days')} onChange={onChange} />, theme);
    expect(onChange.mock.calls[0]![0]).toMatchObject({ from: fixed.from, to: fixed.to, relativeTimeString: 'Last 30 days' });
    unmount();
  });
});

describe('DateRangePicker', () => {
  it('shows a preset by name and reports its dates as it mounts', () => {
    const onChange = vi.fn<(range: TimeRange) => void>();
    const { container, unmount } = mount(<DateRangePicker selectedValue={dateRangePreset('Last 30 days')} onChange={onChange} />);
    expect(container.textContent).toContain('Last 30 days');
    expect(onChange).toHaveBeenCalledTimes(1);
    const range = onChange.mock.calls[0]![0]!;
    expect(range.relativeTimeString).toBe('Last 30 days');
    expect(range.from).toBeInstanceOf(Date);
    expect(range.to).toBeInstanceOf(Date);
    // Thirty calendar days, first midnight to the end of today.
    expect(Math.round((range.to!.getTime() - range.from!.getTime()) / 86_400_000)).toBe(30);
    unmount();
  });

  it('reports nothing for a range that already has its dates', () => {
    const onChange = vi.fn();
    const range = { from: new Date('2026-03-01T00:00:00Z'), to: new Date('2026-03-31T23:59:59.999Z') };
    const { container, unmount } = mount(<DateRangePicker selectedValue={range} onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/Mar/);
    unmount();
  });
});

describe('GranularitySelect', () => {
  it('shows the chosen granularity', () => {
    const { container, unmount } = mount(<GranularitySelect granularity="quarter" onChange={noop} />);
    expect(container.textContent).toContain('Quarter');
    unmount();
  });

  it('replaces a choice that is not on offer, through onChange', () => {
    const onChange = vi.fn<(granularity: Granularity) => void>();
    const { unmount } = mount(<GranularitySelect granularity="day" granularities={['week', 'month']} onChange={onChange} />);
    expect(onChange).toHaveBeenCalled();
    expect(['week', 'month']).toContain(onChange.mock.calls[0]![0]);
    unmount();
  });
});

describe('SingleSelect and MultiSelect', () => {
  it('label the chosen value, and report nothing while it can be cleared', () => {
    const onChange = vi.fn();
    const { container, unmount } = mount(
      <SingleSelect dimension={region} results={regions} selectedValue="Asia Pacific" onChange={onChange} />,
    );
    expect(container.textContent).toContain('Asia Pacific');
    expect(onChange).not.toHaveBeenCalled();
    unmount();
  });

  it('choose the first option when the choice cannot be cleared and nothing is chosen', () => {
    const single = vi.fn();
    const multi = vi.fn();
    const first = mount(<SingleSelect dimension={region} results={regions} clearable={false} onChange={single} />);
    const second = mount(<MultiSelect dimension={region} results={regions} clearable={false} onChange={multi} />);
    expect(single).toHaveBeenCalledWith('Europe');
    expect(multi).toHaveBeenCalledWith(['Europe']);
    first.unmount();
    second.unmount();
  });

  it('report a second field’s value when one is given', () => {
    const id = dimension({ name: 'region_id', title: 'Region id' });
    const rows = results([{ region: 'Europe', region_id: 'eu' }]);
    const onChange = vi.fn();
    const { unmount } = mount(
      <SingleSelect dimension={region} optionalSecondDimension={id} results={rows} clearable={false} onChange={onChange} />,
    );
    expect(onChange).toHaveBeenCalledWith('eu');
    unmount();
    const chosen = mount(<SingleSelect dimension={region} optionalSecondDimension={id} results={rows} selectedValue="eu" />);
    expect(chosen.container.textContent).toContain('Europe');
    chosen.unmount();
  });
});

describe('TextField', () => {
  it('starts with `value` and reports what is typed after a pause', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { container, unmount } = mount(<TextField value="Enterprise" onChange={onChange} />);
    const input = container.querySelector('input')!;
    expect(input.value).toBe('Enterprise');
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setValue.call(input, 'Enterprise plus');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onChange).not.toHaveBeenCalledWith('Enterprise plus');
    act(() => {
      vi.runAllTimers();
    });
    expect(onChange).toHaveBeenLastCalledWith('Enterprise plus');
    unmount();
    vi.useRealTimers();
  });
});

describe('optionsOf', () => {
  it('keeps one row per value, in first-seen order, and waits for rows', () => {
    const rows = [{ region: 'EMEA', n: 1 }, { region: 'APAC', n: 2 }, { region: 'EMEA', n: 3 }, { region: null, n: 4 }];
    expect(optionsOf(rows, region).data).toEqual([{ region: 'EMEA' }, { region: 'APAC' }]);
    expect(optionsOf(undefined, region).isLoading).toBe(true);
  });
});

describe('useComparisonRange', () => {
  const Show = ({ range, period }: { range?: TimeRange; period?: string }) => {
    const compared = useComparisonRange(range, period);
    return <span>{compared ? `${compared.from?.toISOString()} ${compared.to?.toISOString()}` : 'none'}</span>;
  };

  it('works out the previous period of a range, and nothing without a period', () => {
    const range = { from: new Date('2026-03-01T00:00:00Z'), to: new Date('2026-03-10T23:59:59.999Z') };
    const shown = mount(<Show range={range} period="Previous period" />);
    const [from, to] = shown.container.textContent!.split(' ').map((d) => new Date(d).getTime());
    expect(to! - from!).toBe(range.to.getTime() - range.from.getTime());
    expect(to!).toBeLessThan(range.from.getTime());
    shown.unmount();

    const none = mount(<Show range={range} />);
    expect(none.container.textContent).toBe('none');
    none.unmount();
  });

  it('resolves a preset range first', () => {
    const shown = mount(<Show range={dateRangePreset('Last 30 days')} period="Previous period" />);
    expect(shown.container.textContent).not.toBe('none');
    shown.unmount();
  });
});
