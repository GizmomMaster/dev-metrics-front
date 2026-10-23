import { describe, expect, it } from 'vitest';
import type { CommitMetricDto, ReviewMetricDto } from '../api/metrics';
import {
  averagePerActiveDay,
  groupByDay,
  isLateCommit,
  isoDay,
  LATE_EVENING_FROM_HOUR,
  LATE_MORNING_BEFORE_HOUR,
  sumCounts,
} from './ActivityPage';

let nextId = 1;

function makeCommit(timestamp: string, numberOfCommits = 1): CommitMetricDto {
  return {
    id: nextId++,
    timestamp,
    numberOfCommits,
    linesAdded: 0,
    linesRemoved: 0,
    dayOfWeek: 1,
    serviceName: 'devmetrics-demo',
  };
}

function makeReview(mergedAt: string | null, approvalIterations = 0): ReviewMetricDto {
  return {
    id: nextId++,
    mergeRequestId: nextId,
    prOpenedAt: '2026-07-01T09:00:00Z',
    mergedAt,
    commentsCount: 0,
    approvalIterations,
    firstApprovalAt: null,
    serviceName: null,
    repositoryName: 'devmetrics-demo',
    sourceBranch: null,
  };
}

describe('isoDay', () => {
  it('takes the date part of an ISO timestamp', () => {
    expect(isoDay('2026-07-01T13:45:00Z')).toBe('2026-07-01');
  });

  // Смысл среза вместо new Date(...): день не должен зависеть от таймзоны
  // браузера. Поздний вечерний коммит остаётся в своих сутках даже в UTC+N,
  // где new Date(ts).getDate() вернул бы следующие.
  it('keeps a late-evening UTC timestamp on its own day', () => {
    expect(isoDay('2026-07-01T23:30:00Z')).toBe('2026-07-01');
  });

  it('handles a timestamp with an offset instead of Z', () => {
    expect(isoDay('2026-07-01T23:30:00+03:00')).toBe('2026-07-01');
  });
});

describe('isLateCommit', () => {
  it('counts a commit before the morning boundary as late', () => {
    expect(isLateCommit('2026-07-01T05:59:00Z')).toBe(true);
    expect(isLateCommit('2026-07-01T00:00:00Z')).toBe(true);
  });

  it('does not count a commit at the morning boundary as late', () => {
    expect(isLateCommit(`2026-07-01T0${LATE_MORNING_BEFORE_HOUR}:00:00Z`)).toBe(false);
  });

  it('does not count a commit just before the evening boundary as late', () => {
    expect(isLateCommit('2026-07-01T19:59:00Z')).toBe(false);
  });

  it('counts a commit at the evening boundary as late', () => {
    expect(isLateCommit(`2026-07-01T${LATE_EVENING_FROM_HOUR}:00:00Z`)).toBe(true);
    expect(isLateCommit('2026-07-01T23:30:00Z')).toBe(true);
  });

  // Час определить нечем — такую запись не относим к поздним, иначе дата без
  // времени попала бы в сверхурочные просто по факту отсутствия часа.
  it('does not treat a timestamp without a time part as late', () => {
    expect(isLateCommit('2026-07-01')).toBe(false);
  });
});

describe('groupByDay', () => {
  it('sums values falling on the same day', () => {
    const commits = [
      makeCommit('2026-07-01T09:00:00Z', 2),
      makeCommit('2026-07-01T18:00:00Z', 3),
      makeCommit('2026-07-02T10:00:00Z', 1),
    ];

    const result = groupByDay(commits, (c) => isoDay(c.timestamp), (c) => c.numberOfCommits);

    expect(result).toEqual([
      { date: '2026-07-01', count: 5 },
      { date: '2026-07-02', count: 1 },
    ]);
  });

  it('returns an empty array for no items', () => {
    expect(groupByDay([], () => '2026-07-01', () => 1)).toEqual([]);
  });

  // Немерженый MR не относится ни к какому дню — getDate возвращает null,
  // и запись просто пропускается, а не оседает под пустым ключом.
  it('skips items whose date resolver returns null', () => {
    const reviews = [makeReview('2026-07-01T12:00:00Z'), makeReview(null), makeReview(null)];

    const result = groupByDay(reviews, (r) => (r.mergedAt ? isoDay(r.mergedAt) : null), () => 1);

    expect(result).toEqual([{ date: '2026-07-01', count: 1 }]);
  });

  it('returns an empty array when every item is skipped', () => {
    const reviews = [makeReview(null), makeReview(null)];

    expect(groupByDay(reviews, (r) => (r.mergedAt ? isoDay(r.mergedAt) : null), () => 1)).toEqual([]);
  });

  it('keeps days in first-seen order', () => {
    const commits = [makeCommit('2026-07-05T09:00:00Z'), makeCommit('2026-07-02T09:00:00Z')];

    const result = groupByDay(commits, (c) => isoDay(c.timestamp), (c) => c.numberOfCommits);

    expect(result.map((d) => d.date)).toEqual(['2026-07-05', '2026-07-02']);
  });

  it('sums a per-item counter rather than counting items', () => {
    const reviews = [
      makeReview('2026-07-01T12:00:00Z', 2),
      makeReview('2026-07-01T15:00:00Z', 3),
    ];

    const result = groupByDay(
      reviews,
      (r) => (r.mergedAt ? isoDay(r.mergedAt) : null),
      (r) => r.approvalIterations
    );

    expect(result).toEqual([{ date: '2026-07-01', count: 5 }]);
  });
});

describe('sumCounts', () => {
  it('adds up the counts', () => {
    expect(sumCounts([{ date: 'a', count: 2 }, { date: 'b', count: 3 }])).toBe(5);
  });

  it('returns zero for an empty list', () => {
    expect(sumCounts([])).toBe(0);
  });
});

describe('averagePerActiveDay', () => {
  // Ключевое правило: делим на число дней С ЗАПИСЯМИ, а не на длину периода —
  // иначе дни без синка размывали бы среднее к нулю.
  it('divides by the number of days present, not by the period length', () => {
    expect(averagePerActiveDay([{ date: 'a', count: 100 }, { date: 'b', count: 200 }])).toBe(150);
  });

  it('returns zero when there are no days', () => {
    expect(averagePerActiveDay([])).toBe(0);
  });

  it('rounds to the nearest integer', () => {
    expect(averagePerActiveDay([{ date: 'a', count: 1 }, { date: 'b', count: 2 }])).toBe(2);
  });
});
