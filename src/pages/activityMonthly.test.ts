import { describe, expect, it } from 'vitest';
import { toMonthBars } from './activityMonthly';

const day = (date: string, count: number) => ({ date, count });

describe('toMonthBars', () => {
  const start = new Date(2026, 0, 15);
  const end = new Date(2026, 2, 10);

  it('sums days into every calendar month of the period, keeping empty months', () => {
    const bars = toMonthBars([day('2026-01-20', 3), day('2026-01-21', 2), day('2026-03-01', 4)], start, end, 'sum');
    expect(bars.map((b) => [b.month, b.value])).toEqual([
      ['2026-01', 5],
      ['2026-02', 0],
      ['2026-03', 4],
    ]);
  });

  it('averages over active days only', () => {
    const bars = toMonthBars([day('2026-02-02', 100), day('2026-02-03', 50)], start, end, 'avgPerActiveDay');
    expect(bars.find((b) => b.month === '2026-02')?.value).toBe(75);
  });

  it('marks months cut by the period edges as partial', () => {
    expect(toMonthBars([], start, end, 'sum').map((b) => b.partial)).toEqual([true, false, true]);
    expect(toMonthBars([], new Date(2026, 0, 1), new Date(2026, 0, 31), 'sum')[0].partial).toBe(false);
  });

  it('labels months in Russian with a capital letter', () => {
    expect(toMonthBars([], start, end, 'sum')[1].label).toBe('Февраль 2026');
  });
});
