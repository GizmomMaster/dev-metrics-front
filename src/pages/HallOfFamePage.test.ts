import { describe, expect, it } from 'vitest';
import type { Achievement } from '../api/employees';
import type { AvailableMonth, HallOfFameEntry } from '../api/achievements';
import { getPreviousCalendarMonth, pickDefaultMonth, sortHallOfFameEntries } from './HallOfFamePage';

function makeAchievement(code: Achievement['code']): Achievement {
  return { code, name: code, iconKey: 'Bot' };
}

function makeEntry(fullName: string, achievementCount: number): HallOfFameEntry {
  return {
    employeeId: fullName,
    fullName,
    achievements: Array.from({ length: achievementCount }, (_, i) => makeAchievement(`Achievement${i}` as Achievement['code'])),
  };
}

describe('getPreviousCalendarMonth', () => {
  it('returns the prior month within the same year', () => {
    expect(getPreviousCalendarMonth(new Date(2026, 6, 31))).toEqual({ year: 2026, month: 6 }); // июль -> июнь
  });

  it('wraps to December of the previous year when called in January', () => {
    expect(getPreviousCalendarMonth(new Date(2026, 0, 15))).toEqual({ year: 2025, month: 12 });
  });
});

describe('pickDefaultMonth', () => {
  const now = new Date(2026, 6, 31); // 31 июля 2026

  it('returns null when there are no months', () => {
    expect(pickDefaultMonth([], now)).toBeNull();
  });

  it('picks the previous calendar month when it is present in the list', () => {
    const months: AvailableMonth[] = [{ year: 2026, month: 7 }, { year: 2026, month: 6 }, { year: 2026, month: 5 }];
    expect(pickDefaultMonth(months, now)).toEqual({ year: 2026, month: 6 });
  });

  it('falls back to the most recent available month when the previous month has no snapshot', () => {
    const months: AvailableMonth[] = [{ year: 2026, month: 4 }, { year: 2026, month: 3 }];
    expect(pickDefaultMonth(months, now)).toEqual({ year: 2026, month: 4 });
  });
});

describe('sortHallOfFameEntries', () => {
  it('sorts by achievement count descending', () => {
    const entries = [makeEntry('Alice', 1), makeEntry('Bob', 3), makeEntry('Carol', 2)];
    expect(sortHallOfFameEntries(entries).map((e) => e.fullName)).toEqual(['Bob', 'Carol', 'Alice']);
  });

  it('breaks ties alphabetically by full name', () => {
    const entries = [makeEntry('Ёж', 2), makeEntry('Аня', 2), makeEntry('Борис', 2)];
    expect(sortHallOfFameEntries(entries).map((e) => e.fullName)).toEqual(['Аня', 'Борис', 'Ёж']);
  });

  it('does not mutate the input array', () => {
    const entries = [makeEntry('Alice', 1), makeEntry('Bob', 3)];
    const original = [...entries];
    sortHallOfFameEntries(entries);
    expect(entries).toEqual(original);
  });
});
