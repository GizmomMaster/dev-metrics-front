import { eachMonthOfInterval, endOfMonth, format, isSameDay, startOfMonth } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { DayCount } from './ActivityPage';

/** Один столбик спарклайна в плитке активности. */
export interface MonthBar {
  /** "yyyy-MM" — ключ, по которому сводятся дни. */
  month: string;
  /** «Март 2026» — для подсказки. */
  label: string;
  value: number;
  /** Месяц попал в период не целиком (обрезан началом или концом периода). */
  partial: boolean;
}

/**
 * sum — итог за месяц (коммиты, MR, апрувы).
 * avgPerActiveDay — среднее по дням с записью, как у плитки токенов
 * (см. averagePerActiveDay): иначе месяц без синков тянул бы среднее к нулю.
 */
export type MonthAggregate = 'sum' | 'avgPerActiveDay';

/**
 * Сводит дневные значения в столбики по календарным месяцам периода.
 *
 * Месяцы без данных остаются нулевыми столбиками, а не выпадают — иначе провал
 * активности на спарклайне был бы не виден. Месяц берётся срезом ISO-строки
 * (`date.slice(0, 7)`), по той же причине, по которой день берётся в isoDay.
 */
export function toMonthBars(
  days: readonly DayCount[],
  startDate: Date,
  endDate: Date,
  aggregate: MonthAggregate
): MonthBar[] {
  const totals = new Map<string, { sum: number; activeDays: number }>();
  for (const day of days) {
    const key = day.date.slice(0, 7);
    const entry = totals.get(key) ?? { sum: 0, activeDays: 0 };
    entry.sum += day.count;
    entry.activeDays += 1;
    totals.set(key, entry);
  }

  return eachMonthOfInterval({ start: startDate, end: endDate }).map((monthStart) => {
    const key = format(monthStart, 'yyyy-MM');
    const entry = totals.get(key);
    const value =
      entry === undefined
        ? 0
        : aggregate === 'sum'
          ? entry.sum
          : Math.round(entry.sum / entry.activeDays);
    const label = format(monthStart, 'LLLL yyyy', { locale: ru });
    const partial =
      (key === format(startDate, 'yyyy-MM') && !isSameDay(startDate, startOfMonth(startDate))) ||
      (key === format(endDate, 'yyyy-MM') && !isSameDay(endDate, endOfMonth(endDate)));
    return { month: key, label: label.charAt(0).toUpperCase() + label.slice(1), value, partial };
  });
}
