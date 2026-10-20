import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import { ru } from 'date-fns/locale';
import { getEmployee } from '../api/employees';
import type { PeriodFetcher } from '../api/metrics';
import { getCommits, getReviews, getVacations, getOfficeVisits, getAiTokenUsage, getIssues, getQualityGateImprovements } from '../api/metrics';
import { getRepositories } from '../api/repositories';
import Heatmap from '../components/Heatmap';
import ActivityChart, { METRIC_COLORS } from '../components/ActivityChart';
import MonthSparkline from '../components/MonthSparkline';
import { toMonthBars } from './activityMonthly';
import ServiceSankey from '../components/ServiceSankey';
import QualityGateImprovements from '../components/QualityGateImprovements';
import MergeRequestInsights from '../components/MergeRequestInsights';
import InternalProjectsSummary from '../components/InternalProjectsSummary';
import AchievementBadges from '../components/AchievementBadges';
import PeriodPicker, { PERIOD_PRESETS } from '../components/PeriodPicker';
import EmployeeTags, { buildEmployeeTags } from '../components/EmployeeTags';
import StatTile from '../components/StatTile';
import QueryError from '../components/QueryError';
import { ArrowLeft, GitCommit, GitPullRequest, ThumbsUp, Cpu } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** Одна точка графика/heatmap: сколько чего пришлось на календарный день. */
export interface DayCount {
  date: string;
  count: number;
}

// Коммит считается «поздним», если он вне рабочего окна 06:00–20:00 UTC.
// Те же границы, что у бэкенда в GetLateCommitCountsByEmployeeAsync.
export const LATE_MORNING_BEFORE_HOUR = 6;
export const LATE_EVENING_FROM_HOUR = 20;

/**
 * День из ISO-строки — срезом, а не через `new Date(...)`.
 *
 * `new Date(ts).getDate()` вернул бы день в таймзоне браузера, и коммит,
 * сделанный в 23:30 UTC, у пользователя в UTC+3 переехал бы на следующие
 * сутки — разойдясь и с heatmap, и с тем, как те же строки группирует бэкенд.
 */
export function isoDay(timestamp: string): string {
  return timestamp.split('T')[0];
}

/**
 * Поздний ли коммит. Час берётся из сырой ISO-строки по той же причине, что и
 * день в isoDay. Строка без временной части поздней не считается — определить
 * час нечем.
 */
export function isLateCommit(timestamp: string): boolean {
  const time = timestamp.split('T')[1];
  if (!time) return false;
  const hour = Number(time.slice(0, 2));
  return hour >= LATE_EVENING_FROM_HOUR || hour < LATE_MORNING_BEFORE_HOUR;
}

/**
 * Суммирует значения по календарным дням.
 *
 * `getDate` возвращает null для записей, которым день не сопоставлен — такие
 * пропускаются (немерженый MR: нет даты завершения, некуда отнести).
 */
export function groupByDay<T>(
  items: readonly T[],
  getDate: (item: T) => string | null,
  getValue: (item: T) => number
): DayCount[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    const date = getDate(item);
    if (date === null) continue;
    totals.set(date, (totals.get(date) ?? 0) + getValue(item));
  }
  return Array.from(totals, ([date, count]) => ({ date, count }));
}

export function sumCounts(days: readonly DayCount[]): number {
  return days.reduce((sum, day) => sum + day.count, 0);
}

/**
 * Среднее за день — по дням, где запись есть, а не по всем дням периода:
 * иначе дни без синка размывали бы среднее к нулю. Остальные итоги на странице
 * так же считают только фактическую активность.
 */
export function averagePerActiveDay(days: readonly DayCount[]): number {
  if (days.length === 0) return 0;
  return Math.round(sumCounts(days) / days.length);
}

/**
 * Общая пустая заглушка вместо `data = []`: новый массив на каждом рендере
 * пока идёт загрузка сбрасывал бы мемоизацию всех производных рядов ниже.
 */
const NO_ROWS: never[] = [];

/** Период, за который страница запрашивает все метрики сотрудника. */
interface EmployeePeriod {
  id: string | undefined;
  startDate: Date;
  endDate: Date;
  startDateStr: string;
  endDateStr: string;
}

/**
 * Один запрос метрики за период. Все семь запросов ниже отличались только
 * ключом кэша и функцией загрузки — остальное (границы периода в ключе,
 * enabled по наличию id, пустой массив по умолчанию) было скопировано.
 */
function useEmployeeMetric<T>(key: string, fetcher: PeriodFetcher<T>, period: EmployeePeriod) {
  return useQuery({
    queryKey: [key, period.id, period.startDateStr, period.endDateStr],
    queryFn: () => fetcher(period.id!, period.startDate, period.endDate),
    enabled: !!period.id,
  });
}

export default function ActivityPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [periodDays, setPeriodDays] = useState(
    PERIOD_PRESETS.find((p) => p.label === '6 месяцев')?.days ?? PERIOD_PRESETS[0].days
  );

  // Границы периода мемоизированы: без этого каждый рендер создавал новый
  // объект Date, который уезжал пропсом в Heatmap/ActivityChart и обнулял там
  // мемоизацию, хотя сам период не менялся.
  const period = useMemo<EmployeePeriod>(() => {
    const end = new Date();
    const start = subDays(end, periodDays);
    return {
      id,
      startDate: start,
      endDate: end,
      startDateStr: format(start, 'yyyy-MM-dd'),
      endDateStr: format(end, 'yyyy-MM-dd'),
    };
  }, [id, periodDays]);
  const { startDate, endDate } = period;

  const employeeQuery = useQuery({
    queryKey: ['employee', id],
    queryFn: () => getEmployee(id!),
    enabled: !!id,
  });
  const employee = employeeQuery.data;

  const commitsQuery = useEmployeeMetric('commits', getCommits, period);
  const reviewsQuery = useEmployeeMetric('reviews', getReviews, period);
  const vacationsQuery = useEmployeeMetric('vacations', getVacations, period);
  const officeVisitsQuery = useEmployeeMetric('officeVisits', getOfficeVisits, period);
  const aiTokenUsageQuery = useEmployeeMetric('aiTokenUsage', getAiTokenUsage, period);
  const issuesQuery = useEmployeeMetric('issues', getIssues, period);
  const qualityGateQuery = useEmployeeMetric('qualityGate', getQualityGateImprovements, period);

  // Список репозиториев не зависит от выбранного сотрудника/периода — один
  // и тот же запрос для всех, кэшируется react-query по умолчанию.
  const repositoriesQuery = useQuery({
    queryKey: ['repositories'],
    queryFn: getRepositories,
  });

  const commits = commitsQuery.data ?? NO_ROWS;
  const reviews = reviewsQuery.data ?? NO_ROWS;
  const vacations = vacationsQuery.data ?? NO_ROWS;
  const officeVisits = officeVisitsQuery.data ?? NO_ROWS;
  const aiTokenUsage = aiTokenUsageQuery.data ?? NO_ROWS;
  const issues = issuesQuery.data ?? NO_ROWS;
  const qualityGateChanges = qualityGateQuery.data ?? NO_ROWS;
  const repositories = repositoriesQuery.data ?? NO_ROWS;

  // Упавший запрос иначе неотличим от «активности не было»: плитки и графики
  // показали бы нули. Поэтому один общий баннер над всеми блоками.
  const failedQueries = [
    employeeQuery,
    commitsQuery,
    reviewsQuery,
    vacationsQuery,
    officeVisitsQuery,
    aiTokenUsageQuery,
    issuesQuery,
    qualityGateQuery,
    repositoriesQuery,
  ].filter((q) => q.isLoadingError);

  const internalRepoNames = useMemo(
    () => repositories.filter((r) => r.isInternalProject).map((r) => r.name),
    [repositories]
  );

  // Коммиты по дням.
  const dayData = useMemo(
    () => groupByDay(commits, (c) => isoDay(c.timestamp), (c) => c.numberOfCommits),
    [commits]
  );

  const totalCommits = useMemo(
    () => commits.reduce((sum, c) => sum + c.numberOfCommits, 0),
    [commits]
  );

  // Коммиты вне окна 06:00–20:00 — индикация сверхурочной работы на heatmap.
  // Ранний коммит (например, 02:00) не переносится на предыдущий день:
  // засчитывается в те сутки, что стоят в его собственном timestamp.
  const lateDayData = useMemo(
    () =>
      groupByDay(
        commits,
        (c) => (isLateCommit(c.timestamp) ? isoDay(c.timestamp) : null),
        (c) => c.numberOfCommits
      ),
    [commits]
  );

  // Мердж-реквесты по дням: один MR = одно событие в день мерджа (mergedAt).
  // Немерженые MR исключаются — для них ещё нет «дня» активности.
  const reviewDayData = useMemo(
    () => groupByDay(reviews, (r) => (r.mergedAt ? isoDay(r.mergedAt) : null), () => 1),
    [reviews]
  );

  const totalReviews = useMemo(() => sumCounts(reviewDayData), [reviewDayData]);

  // Апрувы по дням: approvalIterations — счётчик на MR, а не событие с датой,
  // поэтому всё значение приписывается дню мерджа этого MR.
  const approvalDayData = useMemo(
    () =>
      groupByDay(
        reviews,
        (r) => (r.mergedAt ? isoDay(r.mergedAt) : null),
        (r) => r.approvalIterations
      ),
    [reviews]
  );

  const totalApprovals = useMemo(() => sumCounts(approvalDayData), [approvalDayData]);

  // Токены ИИ-ассистента по дням. `date` уже приходит как "yyyy-MM-dd".
  const aiTokenDayData = useMemo(
    () => groupByDay(aiTokenUsage, (u) => u.date, (u) => u.tokenCount),
    [aiTokenUsage]
  );

  const avgAiTokens = useMemo(() => averagePerActiveDay(aiTokenDayData), [aiTokenDayData]);

  // Помесячная динамика для спарклайнов в плитках — по тем же дневным рядам,
  // что и итоги в плитках, поэтому сумма столбиков равна цифре плитки.
  const monthly = useMemo(
    () => ({
      commits: toMonthBars(dayData, startDate, endDate, 'sum'),
      reviews: toMonthBars(reviewDayData, startDate, endDate, 'sum'),
      approvals: toMonthBars(approvalDayData, startDate, endDate, 'sum'),
      aiTokens: toMonthBars(aiTokenDayData, startDate, endDate, 'avgPerActiveDay'),
    }),
    [dayData, reviewDayData, approvalDayData, aiTokenDayData, startDate, endDate]
  );

  const vacationDateSet = useMemo(() => {
    const set = new Set<string>();
    for (const v of vacations) {
      for (const day of eachDayOfInterval({ start: new Date(v.startDate), end: new Date(v.endDate) })) {
        set.add(format(day, 'yyyy-MM-dd'));
      }
    }
    return set;
  }, [vacations]);

  // Дни работы из офиса — уже плоский список дат, без range-развёртки как у отпусков.
  const officeVisitDateSet = useMemo(() => {
    const set = new Set<string>();
    for (const v of officeVisits) set.add(v.visitDate);
    return set;
  }, [officeVisits]);

  if (!id) {
    return <div>Не найден</div>;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft /> К сотрудникам
        </Button>
        <h1 className="text-2xl font-semibold">Активность</h1>
        <span className="ml-auto text-sm text-muted-foreground">
          {format(startDate, 'd MMMM', { locale: ru })} — {format(endDate, 'd MMMM', { locale: ru })}
        </span>
        <PeriodPicker days={periodDays} onChange={setPeriodDays} />
      </div>

      {failedQueries.length > 0 && (
        <QueryError
          title="Не удалось загрузить часть данных"
          description="Показатели ниже могут быть неполными или нулевыми."
          onRetry={() => failedQueries.forEach((q) => void q.refetch())}
        />
      )}

      {employee && (
        <Card>
          <CardContent>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-base font-medium">{employee.fullName}</p>
                {!employee.isActive && (
                  <Badge variant="outline" title="Сотрудник неактивен (уволен)">
                    неактивен
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">{employee.gitEmail}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                GitLab ID: {employee.gitLabUserId} · В системе с {format(new Date(employee.addedAt), 'd MMMM yyyy', { locale: ru })}
              </p>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <EmployeeTags tags={buildEmployeeTags(employee)} />
              </div>

              <AchievementBadges achievements={employee.achievements} size="lg" showLabel />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={GitCommit} iconClassName="text-blue-500" label="Коммиты" value={String(totalCommits)}>
          <MonthSparkline
            bars={monthly.commits}
            color={METRIC_COLORS.commits}
            formatValue={(v) => `${v.toLocaleString('ru-RU')} шт`}
            label="Коммиты по месяцам"
          />
        </StatTile>
        <StatTile icon={GitPullRequest} iconClassName="text-amber-500" label="Merge requests" value={String(totalReviews)}>
          <MonthSparkline
            bars={monthly.reviews}
            color={METRIC_COLORS.reviews}
            formatValue={(v) => `${v.toLocaleString('ru-RU')} шт`}
            label="Merge requests по месяцам"
          />
        </StatTile>
        <StatTile icon={ThumbsUp} iconClassName="text-purple-500" label="Апрувы" value={String(totalApprovals)}>
          <MonthSparkline
            bars={monthly.approvals}
            color={METRIC_COLORS.approvals}
            formatValue={(v) => `${v.toLocaleString('ru-RU')} шт`}
            label="Апрувы по месяцам"
          />
        </StatTile>
        <StatTile
          icon={Cpu}
          iconClassName="text-indigo-500"
          label="AI-токены в день"
          value={avgAiTokens.toLocaleString('ru-RU')}
          note="в среднем по дням с активностью"
        >
          <MonthSparkline
            bars={monthly.aiTokens}
            color={METRIC_COLORS.aiTokens}
            formatValue={(v) => `${v.toLocaleString('ru-RU')} токенов/день`}
            label="AI-токены в день по месяцам"
          />
        </StatTile>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Календарь активности</CardTitle>
        </CardHeader>
        <CardContent>
          <Heatmap
            data={dayData}
            reviewData={reviewDayData}
            approvalData={approvalDayData}
            lateData={lateDayData}
            vacationDates={vacationDateSet}
            officeVisitDates={officeVisitDateSet}
            startDate={startDate}
            endDate={endDate}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Динамика по дням</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityChart
            commitData={dayData}
            reviewData={reviewDayData}
            approvalData={approvalDayData}
            aiTokenData={aiTokenDayData}
            startDate={startDate}
            endDate={endDate}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Распределение по сервисам</CardTitle>
        </CardHeader>
        <CardContent>
          <ServiceSankey commitData={commits} reviewData={reviews} />
        </CardContent>
      </Card>

      <MergeRequestInsights reviewData={reviews} />

      <QualityGateImprovements changes={qualityGateChanges} />

      <InternalProjectsSummary
        commitData={commits}
        reviewData={reviews}
        issueData={issues}
        internalRepoNames={internalRepoNames}
      />
    </section>
  );
}
