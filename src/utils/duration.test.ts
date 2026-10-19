import { describe, expect, it } from 'vitest';
import { formatDuration } from './duration';

describe('formatDuration', () => {
  it('keeps the original hour formatting used by MergeRequestInsights', () => {
    expect(formatDuration(5.25)).toBe('5.3ч');
    expect(formatDuration(48)).toBe('2д');
  });

  it('rounds before splitting into days and hours', () => {
    expect(formatDuration(71.6)).toBe('3д');
    expect(formatDuration(23.96)).toBe('1д');
    expect(formatDuration(23.94)).toBe('23.9ч');
    expect(formatDuration(47.4)).toBe('1д 23ч');
  });
});
