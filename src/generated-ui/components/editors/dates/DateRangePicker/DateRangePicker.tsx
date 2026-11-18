import React, { useEffect, useState } from 'react';
import type { DateRange, Locale } from 'react-day-picker';

// The calendar is behind a click, so its code loads when a picker first opens.
const DayPicker = React.lazy(() => import('react-day-picker').then((module) => ({ default: module.DayPicker })));
import './DateRangePicker.css';
import { DateRangePickerChevron } from './DateRangePickerChevron';
import { endOfDayUTC } from '../../../../utils/date.utils';

const isEnglish = (locale: string) => locale === 'en' || locale === 'enUS' || locale === 'en-US';

export type DateRangePickerProps = {
  numberOfMonths?: number;
  locale?: string;
  value?: DateRange;
  onChange: (dateRange: DateRange | undefined) => void;
};

const YEARS_AFTER = 5;

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  numberOfMonths = 1,
  locale = 'en',
  onChange,
}) => {
  const [month, setMonth] = useState<Date>(value?.from ?? new Date());
  const currentYear = new Date().getFullYear();
  const [loaded, setLoaded] = useState<{ name: string; locale: Locale | undefined }>();

  useEffect(() => {
    if (isEnglish(locale)) return;
    let current = true;
    import('react-day-picker/locale').then((all) => {
      if (current) setLoaded({ name: locale, locale: (all as unknown as Record<string, Locale>)[locale] });
    });
    return () => {
      current = false;
    };
  }, [locale]);

  const handleChange = (range: DateRange | undefined) => {
    if (range?.to) {
      range.to = endOfDayUTC(range.to);
    }
    onChange(range);
  };

  return (
    <React.Suspense fallback={<div className="rdp-root" style={{ minHeight: 300, minWidth: 280 * numberOfMonths }} />}>
    <DayPicker
      month={month}
      onMonthChange={setMonth}
      numberOfMonths={numberOfMonths}
      components={{ Chevron: DateRangePickerChevron }}
      locale={loaded?.name === locale ? loaded.locale : undefined}
      mode="range"
      navLayout="around"
      onSelect={handleChange}
      selected={value}
      timeZone="UTC"
      showOutsideDays
      captionLayout="dropdown-years"
      endMonth={new Date(currentYear + YEARS_AFTER, 11)}
      animate
    />
    </React.Suspense>
  );
};
