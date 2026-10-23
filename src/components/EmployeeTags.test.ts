import { describe, expect, it } from 'vitest';
import type { EmployeeBrief } from '../api/employees';
import { buildEmployeeTags, getTagLabel } from './EmployeeTags';

function makeEmployee(overrides: Partial<EmployeeBrief> = {}): EmployeeBrief {
  return {
    id: 'e1',
    fullName: 'Пётр Карпов',
    gitEmail: 'petr@example.com',
    isActive: true,
    grade: 'Senior',
    position: 'BackendDeveloper',
    businessLine: 'Платежи',
    artName: 'Core',
    teamName: 'Squad 1',
    achievements: [],
    ...overrides,
  };
}

describe('buildEmployeeTags', () => {
  it('returns all five tags in display order', () => {
    expect(buildEmployeeTags(makeEmployee()).map((t) => t.type)).toEqual([
      'grade',
      'position',
      'businessLine',
      'artName',
      'teamName',
    ]);
  });

  it('carries the raw field value, not the label', () => {
    const tags = buildEmployeeTags(makeEmployee());
    expect(tags.find((t) => t.type === 'position')?.value).toBe('BackendDeveloper');
    expect(tags.find((t) => t.type === 'artName')?.value).toBe('Core');
  });

  // Три необязательных поля приходят как undefined, а grade/position — иногда
  // пустой строкой; и то и другое означает «тега нет».
  it('skips fields that are undefined', () => {
    const employee = makeEmployee({ businessLine: undefined, artName: undefined, teamName: undefined });

    expect(buildEmployeeTags(employee).map((t) => t.type)).toEqual(['grade', 'position']);
  });

  it('skips fields that are an empty string', () => {
    const employee = makeEmployee({ grade: '', businessLine: '' });

    expect(buildEmployeeTags(employee).map((t) => t.type)).toEqual(['position', 'artName', 'teamName']);
  });

  it('returns an empty array when nothing is filled in', () => {
    const employee = makeEmployee({
      grade: '',
      position: '' as EmployeeBrief['position'],
      businessLine: undefined,
      artName: undefined,
      teamName: undefined,
    });

    expect(buildEmployeeTags(employee)).toEqual([]);
  });

  // Табличный список показывает только эти два — остальные поля у него
  // вынесены в отдельную колонку.
  it('restricts the set when only is given', () => {
    const tags = buildEmployeeTags(makeEmployee(), ['grade', 'position']);

    expect(tags.map((t) => t.type)).toEqual(['grade', 'position']);
  });

  it('keeps display order regardless of the order inside only', () => {
    const tags = buildEmployeeTags(makeEmployee(), ['teamName', 'grade']);

    expect(tags.map((t) => t.type)).toEqual(['grade', 'teamName']);
  });

  it('still skips empty fields inside only', () => {
    const tags = buildEmployeeTags(makeEmployee({ grade: '' }), ['grade', 'position']);

    expect(tags.map((t) => t.type)).toEqual(['position']);
  });
});

describe('getTagLabel', () => {
  it('maps a position code to its human-readable label', () => {
    expect(getTagLabel('position', 'BackendDeveloper')).toBe('Backend Developer');
  });

  it('falls back to the raw value for an unknown position', () => {
    expect(getTagLabel('position', 'Astronaut')).toBe('Astronaut');
  });

  it('prefixes art and team names', () => {
    expect(getTagLabel('artName', 'Core')).toBe('ART: Core');
    expect(getTagLabel('teamName', 'Squad 1')).toBe('Team: Squad 1');
  });

  it('passes grade and business line through unchanged', () => {
    expect(getTagLabel('grade', 'Senior')).toBe('Senior');
    expect(getTagLabel('businessLine', 'Платежи')).toBe('Платежи');
  });
});
