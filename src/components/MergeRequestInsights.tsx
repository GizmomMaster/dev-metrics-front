import { useMemo } from 'react';
import { Clock, MessageSquare, Percent, Bug } from 'lucide-react';
import type { ReviewMetricDto } from '../api/metrics';
import { formatDuration } from '../utils/duration';
import EmptyState from './EmptyState';
import StatTile from './StatTile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MergeRequestInsightsProps {
  reviewData: ReviewMetricDto[];
}


export default function MergeRequestInsights({ reviewData }: MergeRequestInsightsProps) {
  // Только смёрженные МР — для незакрытых нет ни времени до слияния, ни
  // корректного знаменателя для доли времени до апрува.
  const mergedReviews = useMemo(
    () => reviewData.filter((r) => r.mergedAt && new Date(r.mergedAt) > new Date(r.prOpenedAt)),
    [reviewData]
  );

  const avgMergeHours = useMemo(() => {
    if (mergedReviews.length === 0) return null;
    const totalHours = mergedReviews.reduce(
      (sum, r) => sum + (new Date(r.mergedAt!).getTime() - new Date(r.prOpenedAt).getTime()) / 3_600_000,
      0
    );
    return totalHours / mergedReviews.length;
  }, [mergedReviews]);

  const avgComments = useMemo(() => {
    if (mergedReviews.length === 0) return null;
    return mergedReviews.reduce((sum, r) => sum + r.commentsCount, 0) / mergedReviews.length;
  }, [mergedReviews]);

  const approvalStats = useMemo(() => {
    // Только апрувы внутри интервала «открыт → смёржен»: апрув после мержа давал
    // долю больше 100%, а апрув раньше открытия (рассинхрон данных) — отрицательную,
    // и оба искажали среднее.
    const withApproval = mergedReviews
      .filter((r) => r.firstApprovalAt)
      .map((r) => ({
        openedMs: new Date(r.prOpenedAt).getTime(),
        mergedMs: new Date(r.mergedAt!).getTime(),
        approvedMs: new Date(r.firstApprovalAt!).getTime(),
      }))
      .filter(({ openedMs, mergedMs, approvedMs }) => approvedMs >= openedMs && approvedMs <= mergedMs);
    if (withApproval.length === 0) return null;
    let percentSum = 0;
    let hoursSum = 0;
    for (const { openedMs, mergedMs, approvedMs } of withApproval) {
      hoursSum += (approvedMs - openedMs) / 3_600_000;
      percentSum += ((approvedMs - openedMs) / (mergedMs - openedMs)) * 100;
    }
    return { avgPercent: percentSum / withApproval.length, avgHours: hoursSum / withApproval.length };
  }, [mergedReviews]);

  // По всем МР периода, не только смёрженным — ветка "bugfix/..." определяет
  // МР для баг-фикса, "feature/..." — для новой функциональности.
  const bugfixCount = useMemo(
    () => reviewData.filter((r) => r.sourceBranch?.toLowerCase().includes('bugfix')).length,
    [reviewData]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Статистика по мердж-реквестам</CardTitle>
      </CardHeader>
      <CardContent>
        {mergedReviews.length === 0 ? (
          <EmptyState className="py-6">Нет данных за выбранный период</EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              icon={Clock}
              iconClassName="text-blue-500"
              label="До слияния с DEV"
              value={formatDuration(avgMergeHours!)}
              note="в среднем"
            />
            <StatTile
              icon={MessageSquare}
              iconClassName="text-amber-500"
              label="Обсуждений на МР"
              value={avgComments!.toFixed(1)}
              note="в среднем"
            />
            <StatTile
              icon={Percent}
              iconClassName="text-purple-500"
              label="Время до апрува"
              value={approvalStats ? `${approvalStats.avgPercent.toFixed(0)}%` : '—'}
              note={
                approvalStats
                  ? `~${formatDuration(approvalStats.avgHours)} до получения апрува`
                  : 'нет данных об апрувах'
              }
            />
            <StatTile icon={Bug} iconClassName="text-red-500" label="Багфиксы" value={String(bugfixCount)} note="ветка bugfix/*" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
