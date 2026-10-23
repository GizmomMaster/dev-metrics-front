import { useMemo, useState } from 'react';
import { Gauge, Eye, TrendingUp, TrendingDown, ExternalLink, Check, X, ChevronDown, ChevronUp, GitPullRequest } from 'lucide-react';
import type { QualityGateRuleChangeDto } from '../api/metrics';
import EmptyState from './EmptyState';
import StatTile from './StatTile';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface QualityGateImprovementsProps {
  changes: QualityGateRuleChangeDto[];
}

type RuleType = 'MetricsConnected' | 'ObservabilityConnected' | 'UnitTestCoverage' | 'IntegrationTestCoverage';

const RULE_META: Record<RuleType, { label: string; icon: typeof Gauge; isBoolean: boolean }> = {
  MetricsConnected: { label: 'Метрики', icon: Gauge, isBoolean: true },
  ObservabilityConnected: { label: 'Observability', icon: Eye, isBoolean: true },
  UnitTestCoverage: { label: 'Unit тесты', icon: TrendingUp, isBoolean: false },
  IntegrationTestCoverage: { label: 'Integration tests', icon: TrendingUp, isBoolean: false },
};

export function isRelevantChange(change: QualityGateRuleChangeDto): boolean {
  const meta = RULE_META[change.ruleName as RuleType];
  if (!meta) return false;
  if (meta.isBoolean) return change.previousValue !== change.newValue;
  const previous = parseFloat(change.previousValue);
  const next = parseFloat(change.newValue);
  return !isNaN(previous) && !isNaN(next) && next !== previous;
}

export function isPositiveChange(change: QualityGateRuleChangeDto): boolean {
  const meta = RULE_META[change.ruleName as RuleType];
  if (!meta) return true;
  if (meta.isBoolean) return change.newValue === 'true';
  return parseFloat(change.newValue) > parseFloat(change.previousValue);
}

export function describeNumericChange(change: QualityGateRuleChangeDto): string {
  const previous = parseFloat(change.previousValue);
  const next = parseFloat(change.newValue);
  const delta = Math.round(next - previous);
  const sign = delta > 0 ? '+' : '';
  return `${previous}% → ${next}% (${sign}${delta}пп)`;
}

export interface ServiceGroup {
  key: string;
  serviceName: string;
  repositoryName: string;
  changes: QualityGateRuleChangeDto[];
}

export interface QualityGateSummary {
  improvedMrCount: number;
  metricsCount: number;
  observabilityCount: number;
  avgCoverageDelta: number | null;
  avgIntegrationCoverageDelta: number | null;
}

// Ожидает уже отфильтрованные isRelevantChange записи.
export function computeQualityGateSummary(relevantChanges: QualityGateRuleChangeDto[]): QualityGateSummary {
  const metricsCount = relevantChanges.filter(
    (c) => c.ruleName === 'MetricsConnected' && c.newValue === 'true',
  ).length;
  const observabilityCount = relevantChanges.filter(
    (c) => c.ruleName === 'ObservabilityConnected' && c.newValue === 'true',
  ).length;
  const avgDelta = (ruleName: RuleType) => {
    const changes = relevantChanges.filter((c) => c.ruleName === ruleName);
    if (changes.length === 0) return null;
    return changes.reduce((sum, c) => sum + (parseFloat(c.newValue) - parseFloat(c.previousValue)), 0) / changes.length;
  };
  const improvedMrCount = new Set(
    relevantChanges.filter(isPositiveChange).map((c) => `${c.repositoryName}|${c.mergeRequestId}`),
  ).size;
  return {
    improvedMrCount,
    metricsCount,
    observabilityCount,
    avgCoverageDelta: avgDelta('UnitTestCoverage'),
    avgIntegrationCoverageDelta: avgDelta('IntegrationTestCoverage'),
  };
}

// Ожидает уже отфильтрованные isRelevantChange записи.
export function groupChangesByService(relevantChanges: QualityGateRuleChangeDto[]): ServiceGroup[] {
  const map = new Map<string, ServiceGroup>();
  for (const change of relevantChanges) {
    const key = `${change.serviceName}|${change.repositoryName}`;
    if (!map.has(key)) {
      map.set(key, { key, serviceName: change.serviceName, repositoryName: change.repositoryName, changes: [] });
    }
    map.get(key)!.changes.push(change);
  }
  return Array.from(map.values());
}

export default function QualityGateImprovements({ changes }: QualityGateImprovementsProps) {
  const [collapsed, setCollapsed] = useState(false);
  const relevantChanges = useMemo(() => changes.filter(isRelevantChange), [changes]);

  const summary = useMemo(() => computeQualityGateSummary(relevantChanges), [relevantChanges]);

  const groups = useMemo(() => groupChangesByService(relevantChanges), [relevantChanges]);

  const signedDelta = (value: number | null) => (value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(0)} пп`);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Улучшение показателей Quality Gate</CardTitle>
        {relevantChanges.length > 0 && (
          <CardAction>
            <Button variant="ghost" size="sm" onClick={() => setCollapsed((v) => !v)}>
              {collapsed ? <ChevronDown /> : <ChevronUp />}
              {collapsed ? 'Показать по сервисам' : 'Скрыть по сервисам'}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {relevantChanges.length === 0 ? (
          <EmptyState className="py-6">Нет изменений Quality Gate за выбранный период</EmptyState>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
              <StatTile icon={GitPullRequest} iconClassName="text-green-500" label="МР с улучшением" value={String(summary.improvedMrCount)} />
              <StatTile icon={Gauge} iconClassName="text-blue-500" label="Подключены метрики" value={String(summary.metricsCount)} note="раз" />
              <StatTile icon={Eye} iconClassName="text-amber-500" label="Подключён observability" value={String(summary.observabilityCount)} note="раз" />
              <StatTile
                icon={TrendingUp}
                iconClassName="text-purple-500"
                label="Unit-покрытие"
                value={signedDelta(summary.avgCoverageDelta)}
                note="среднее изменение"
              />
              <StatTile
                icon={TrendingUp}
                iconClassName="text-teal-500"
                label="Integration-покрытие"
                value={signedDelta(summary.avgIntegrationCoverageDelta)}
                note="среднее изменение"
              />
            </div>

            {!collapsed && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {groups.map((group) => (
                  <div key={group.key} className="rounded-xl border p-4">
                    <div className="font-medium">{group.serviceName}</div>
                    <div className="mb-3 text-xs text-muted-foreground">{group.repositoryName}</div>
                    <div className="space-y-2">
                      {group.changes.map((change) => {
                        const meta = RULE_META[change.ruleName as RuleType];
                        const positive = isPositiveChange(change);
                        const Icon = meta?.isBoolean === false ? (positive ? TrendingUp : TrendingDown) : meta?.icon ?? Gauge;
                        return (
                          <div key={change.id} className="flex items-start gap-2">
                            <Icon className={`mt-0.5 size-4 shrink-0 ${positive ? 'text-green-600' : 'text-destructive'}`} />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span>{meta?.label ?? change.ruleName}:</span>
                                {meta?.isBoolean ? (
                                  <span className="inline-flex items-center gap-1">
                                    {change.previousValue === 'true' ? (
                                      <Check className="size-3.5 text-green-600" />
                                    ) : (
                                      <X className="size-3.5 text-destructive" />
                                    )}
                                    <span className="text-muted-foreground">→</span>
                                    {change.newValue === 'true' ? (
                                      <Check className="size-3.5 text-green-600" />
                                    ) : (
                                      <X className="size-3.5 text-destructive" />
                                    )}
                                  </span>
                                ) : (
                                  <span className="tabular-nums">{describeNumericChange(change)}</span>
                                )}
                              </div>
                              <a
                                href={`${change.repositoryUrl}/-/merge_requests/${change.mergeRequestId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                              >
                                МР #{change.mergeRequestId} <ExternalLink className="size-3" />
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
