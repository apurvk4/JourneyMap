import type { DateRange } from './model';

/**
 * Timeline dates are presented in the visitor's local timezone. Keeping this
 * policy in one place prevents a UTC calendar cell from selecting a different
 * local day in the filters and statistics panels.
 */
export function localDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function localDayRange(year: number, monthIndex: number, day: number): DateRange {
  const start = new Date(year, monthIndex, day).getTime();
  return { start, end: start + 24 * 60 * 60 * 1000 - 1 };
}

export function localDayKeyToRange(dayKey: string): DateRange | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) return null;
  return localDayRange(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}
