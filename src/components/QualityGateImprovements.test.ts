import { describe, expect, it } from 'vitest';
import type { QualityGateRuleChangeDto } from '../api/metrics';
import {
  computeQualityGateSummary,
  describeNumericChange,
  groupChangesByService,
  isPositiveChange,
  isRelevantChange,
} from './QualityGateImprovements';

let nextId = 1;

function makeChange(overrides: Partial<QualityGateRuleChangeDto> = {}): QualityGateRuleChangeDto {
  return {
    id: nextId++,
    repositoryName: 'devmetrics-demo',
    repositoryUrl: 'https://gitlab.example.com/devmetrics-demo',
    serviceName: 'Payments',
    releaseBranchName: 'release/1.0',
    mergeRequestId: 42,
    ruleName: 'UnitTestCoverage',
    previousValue: '40',
    newValue: '55',
    mergedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

describe('isRelevantChange', () => {
  it('is false for a boolean rule whose value did not change', () => {
    expect(isRelevantChange(makeChange({ ruleName: 'MetricsConnected', previousValue: 'true', newValue: 'true' }))).toBe(false);
  });

  it('is true for a boolean rule whose value changed', () => {
    expect(isRelevantChange(makeChange({ ruleName: 'MetricsConnected', previousValue: 'false', newValue: 'true' }))).toBe(true);
  });

  it('is false for a numeric rule whose value did not change', () => {
    expect(isRelevantChange(makeChange({ ruleName: 'UnitTestCoverage', previousValue: '50', newValue: '50' }))).toBe(false);
  });

  it('is true for a numeric rule whose value changed', () => {
    expect(isRelevantChange(makeChange({ ruleName: 'UnitTestCoverage', previousValue: '40', newValue: '55' }))).toBe(true);
  });

  it('is false for an unknown rule name', () => {
    expect(isRelevantChange(makeChange({ ruleName: 'SomeFutureRule', previousValue: 'a', newValue: 'b' }))).toBe(false);
  });
});

describe('isPositiveChange', () => {
  it('treats a boolean rule turning on as positive', () => {
    expect(isPositiveChange(makeChange({ ruleName: 'ObservabilityConnected', previousValue: 'false', newValue: 'true' }))).toBe(true);
  });

  it('treats a boolean rule turning off as negative', () => {
    expect(isPositiveChange(makeChange({ ruleName: 'ObservabilityConnected', previousValue: 'true', newValue: 'false' }))).toBe(false);
  });

  it('treats an increasing numeric rule as positive', () => {
    expect(isPositiveChange(makeChange({ ruleName: 'IntegrationTestCoverage', previousValue: '30', newValue: '45' }))).toBe(true);
  });

  it('treats a decreasing numeric rule as negative', () => {
    expect(isPositiveChange(makeChange({ ruleName: 'IntegrationTestCoverage', previousValue: '45', newValue: '30' }))).toBe(false);
  });

  it('defaults to positive for an unknown rule name', () => {
    expect(isPositiveChange(makeChange({ ruleName: 'SomeFutureRule', previousValue: 'a', newValue: 'b' }))).toBe(true);
  });
});

describe('describeNumericChange', () => {
  it('formats a positive delta with a leading plus sign', () => {
    expect(describeNumericChange(makeChange({ previousValue: '40', newValue: '55' }))).toBe('40% → 55% (+15пп)');
  });

  it('formats a negative delta without a leading plus sign', () => {
    expect(describeNumericChange(makeChange({ previousValue: '60', newValue: '50' }))).toBe('60% → 50% (-10пп)');
  });
});

describe('computeQualityGateSummary', () => {
  it('returns zeros and null deltas for an empty list', () => {
    expect(computeQualityGateSummary([])).toEqual({
      improvedMrCount: 0,
      metricsCount: 0,
      observabilityCount: 0,
      avgCoverageDelta: null,
      avgIntegrationCoverageDelta: null,
    });
  });

  it('counts only MetricsConnected/ObservabilityConnected changes that turned on', () => {
    const summary = computeQualityGateSummary([
      makeChange({ ruleName: 'MetricsConnected', previousValue: 'false', newValue: 'true' }),
      makeChange({ ruleName: 'MetricsConnected', previousValue: 'true', newValue: 'false' }),
      makeChange({ ruleName: 'ObservabilityConnected', previousValue: 'false', newValue: 'true' }),
    ]);

    expect(summary.metricsCount).toBe(1);
    expect(summary.observabilityCount).toBe(1);
  });

  it('averages UnitTestCoverage and IntegrationTestCoverage deltas independently', () => {
    const summary = computeQualityGateSummary([
      makeChange({ ruleName: 'UnitTestCoverage', previousValue: '40', newValue: '50' }), // +10
      makeChange({ ruleName: 'UnitTestCoverage', previousValue: '50', newValue: '60' }), // +10
      makeChange({ ruleName: 'IntegrationTestCoverage', previousValue: '20', newValue: '50' }), // +30
    ]);

    expect(summary.avgCoverageDelta).toBe(10);
    expect(summary.avgIntegrationCoverageDelta).toBe(30);
  });

  it('leaves a rule delta null when there are no changes for it', () => {
    const summary = computeQualityGateSummary([
      makeChange({ ruleName: 'UnitTestCoverage', previousValue: '40', newValue: '50' }),
    ]);

    expect(summary.avgIntegrationCoverageDelta).toBeNull();
  });

  it('counts each improved MR once even with multiple improved rules on it', () => {
    const summary = computeQualityGateSummary([
      makeChange({ repositoryName: 'repo-a', mergeRequestId: 1, ruleName: 'UnitTestCoverage', previousValue: '40', newValue: '50' }),
      makeChange({ repositoryName: 'repo-a', mergeRequestId: 1, ruleName: 'IntegrationTestCoverage', previousValue: '30', newValue: '45' }),
      makeChange({ repositoryName: 'repo-a', mergeRequestId: 2, ruleName: 'UnitTestCoverage', previousValue: '10', newValue: '20' }),
    ]);

    expect(summary.improvedMrCount).toBe(2);
  });

  it('does not count an MR whose only change regressed', () => {
    const summary = computeQualityGateSummary([
      makeChange({ repositoryName: 'repo-a', mergeRequestId: 1, ruleName: 'UnitTestCoverage', previousValue: '50', newValue: '40' }),
    ]);

    expect(summary.improvedMrCount).toBe(0);
  });

  it('treats the same mergeRequestId in different repositories as distinct MRs', () => {
    const summary = computeQualityGateSummary([
      makeChange({ repositoryName: 'repo-a', mergeRequestId: 1, ruleName: 'UnitTestCoverage', previousValue: '10', newValue: '20' }),
      makeChange({ repositoryName: 'repo-b', mergeRequestId: 1, ruleName: 'UnitTestCoverage', previousValue: '10', newValue: '20' }),
    ]);

    expect(summary.improvedMrCount).toBe(2);
  });
});

describe('groupChangesByService', () => {
  it('groups changes under the same serviceName + repositoryName key', () => {
    const groups = groupChangesByService([
      makeChange({ serviceName: 'Payments', repositoryName: 'devmetrics-demo', ruleName: 'MetricsConnected' }),
      makeChange({ serviceName: 'Payments', repositoryName: 'devmetrics-demo', ruleName: 'UnitTestCoverage' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].changes).toHaveLength(2);
  });

  it('keeps the same service name in different repositories as separate groups', () => {
    const groups = groupChangesByService([
      makeChange({ serviceName: 'Payments', repositoryName: 'repo-a' }),
      makeChange({ serviceName: 'Payments', repositoryName: 'repo-b' }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it('preserves the order changes were passed in within a group', () => {
    const first = makeChange({ ruleName: 'MetricsConnected' });
    const second = makeChange({ ruleName: 'UnitTestCoverage' });

    const groups = groupChangesByService([first, second]);

    expect(groups[0].changes.map((c) => c.id)).toEqual([first.id, second.id]);
  });
});
