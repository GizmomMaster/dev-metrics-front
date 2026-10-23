import { describe, expect, it } from 'vitest';
import type { AlarmEmployeeDto } from '../api/alarms';
import { filterAlarms, type AlarmKind } from './AlarmsPage';

function makeAlarm(fullName: string, overrides: Partial<AlarmEmployeeDto> = {}): AlarmEmployeeDto {
  return {
    employeeId: fullName,
    fullName,
    isSilent: false,
    lastCommitAt: null,
    isOnVacation: false,
    hasLateCommits: false,
    lateCommitCount: 0,
    ...overrides,
  };
}

const silent = makeAlarm('Молчащий', { isSilent: true, lastCommitAt: '2026-07-01T10:00:00Z' });
const owl = makeAlarm('Ночной', { hasLateCommits: true, lateCommitCount: 5, lastCommitAt: '2026-08-12T22:00:00Z' });
const all = [silent, owl];

function kinds(...values: AlarmKind[]): Set<AlarmKind> {
  return new Set(values);
}

describe('filterAlarms', () => {
  it('returns both kinds when both filters are active (the default state)', () => {
    expect(filterAlarms(all, kinds('silent', 'late'))).toEqual(all);
  });

  it('returns only silent employees when just that filter is active', () => {
    expect(filterAlarms(all, kinds('silent'))).toEqual([silent]);
  });

  it('returns only late-committing employees when just that filter is active', () => {
    expect(filterAlarms(all, kinds('late'))).toEqual([owl]);
  });

  it('treats an empty filter set as "show everything" rather than "show nothing"', () => {
    // Иначе снятие обоих фильтров заводило бы в тупик с пустым экраном.
    expect(filterAlarms(all, kinds())).toEqual(all);
  });

  it('keeps an employee matching both flags visible under either filter', () => {
    // Сейчас окна совпадают и признаки взаимоисключающие, но флаги в DTO
    // независимы — фильтр не должен на это закладываться.
    const both = makeAlarm('Оба', { isSilent: true, hasLateCommits: true, lateCommitCount: 2 });
    expect(filterAlarms([both], kinds('silent'))).toEqual([both]);
    expect(filterAlarms([both], kinds('late'))).toEqual([both]);
  });

  it('preserves the order the server returned', () => {
    expect(filterAlarms(all, kinds('silent', 'late')).map((a) => a.fullName)).toEqual(['Молчащий', 'Ночной']);
  });
});
