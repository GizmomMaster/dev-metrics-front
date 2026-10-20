import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAvailableMonths, getCatalog, getHallOfFame, type AvailableMonth, type HallOfFameEntry } from '../api/achievements';
import EmptyState from '../components/EmptyState';
import QueryError from '../components/QueryError';
import ActivityLink, { isClickOnLink } from '../components/ActivityLink';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import MonthPicker, { formatMonthLabel } from '../components/MonthPicker';
import AchievementBadges from '../components/AchievementBadges';
import AchievementLegend from '../components/AchievementLegend';

// Прошлый календарный месяц относительно сегодня — выбор по умолчанию (требование
// "по умолчанию выводится список сотрудников у кого есть ачивки за прошлый месяц").
export function getPreviousCalendarMonth(now: Date = new Date()): AvailableMonth {
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 12 : now.getMonth();
  return { year, month };
}

// months ожидается уже отсортированным по убыванию (см. GetAvailableMonthsAsync) —
// если прошлого месяца среди снапшотов ещё нет (джоба ещё не запускалась),
// берём самый свежий доступный.
export function pickDefaultMonth(months: AvailableMonth[], now: Date = new Date()): AvailableMonth | null {
  if (months.length === 0) return null;
  const previous = getPreviousCalendarMonth(now);
  const match = months.find((m) => m.year === previous.year && m.month === previous.month);
  return match ?? months[0];
}

// Больше ачивок — выше в списке; при равенстве — по алфавиту (имя, ru-локаль).
export function sortHallOfFameEntries(entries: HallOfFameEntry[]): HallOfFameEntry[] {
  return [...entries].sort((a, b) => {
    const byCount = b.achievements.length - a.achievements.length;
    if (byCount !== 0) return byCount;
    return a.fullName.localeCompare(b.fullName, 'ru');
  });
}

export default function HallOfFamePage() {
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState<AvailableMonth | null>(null);

  const { data: catalog = [] } = useQuery({
    queryKey: ['achievementCatalog'],
    queryFn: getCatalog,
  });

  const {
    data: months = [],
    isLoading: isLoadingMonths,
    isLoadingError: isMonthsError,
    refetch: refetchMonths,
  } = useQuery({
    queryKey: ['achievementMonths'],
    queryFn: getAvailableMonths,
  });

  useEffect(() => {
    if (selectedMonth === null && months.length > 0) {
      setSelectedMonth(pickDefaultMonth(months));
    }
  }, [months, selectedMonth]);

  const {
    data: entries = [],
    isLoading: isLoadingEntries,
    isLoadingError: isEntriesError,
    refetch: refetchEntries,
  } = useQuery({
    queryKey: ['hallOfFame', selectedMonth?.year, selectedMonth?.month],
    queryFn: () => getHallOfFame(selectedMonth!.year, selectedMonth!.month),
    enabled: selectedMonth !== null,
  });

  const sortedEntries = useMemo(() => sortHallOfFameEntries(entries), [entries]);

  return (
    <section className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Зал достижений</h1>
        {selectedMonth && <span className="text-sm text-muted-foreground">{formatMonthLabel(selectedMonth)}</span>}
        <div className="ml-auto">
          <MonthPicker months={months} selected={selectedMonth} onChange={setSelectedMonth} />
        </div>
      </div>

      <AchievementLegend catalog={catalog} />

      {/* Месяцы пришли, но эффект ещё не выбрал месяц по умолчанию — это тоже загрузка,
          иначе на один кадр мелькнуло бы «ачивок не было». */}
      {isLoadingMonths || isLoadingEntries || (months.length > 0 && selectedMonth === null) ? (
        <Skeleton className="h-48 w-full" />
      ) : isMonthsError ? (
        <QueryError title="Не удалось загрузить список месяцев" onRetry={() => void refetchMonths()} />
      ) : months.length === 0 ? (
        <EmptyState>Пока нет ни одного месячного снимка ачивок</EmptyState>
      ) : isEntriesError ? (
        <QueryError title="Не удалось загрузить зал достижений" onRetry={() => void refetchEntries()} />
      ) : sortedEntries.length === 0 ? (
        <EmptyState>За выбранный месяц ачивок не было</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Сотрудник</TableHead>
                <TableHead className="w-24 text-right">Ачивок</TableHead>
                <TableHead className="text-right">Достижения</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEntries.map((entry) => (
                <TableRow
                  key={entry.employeeId}
                  onClick={(e) => !isClickOnLink(e) && navigate(`/activity/${entry.employeeId}`)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium">
                    <ActivityLink employeeId={entry.employeeId}>{entry.fullName}</ActivityLink>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{entry.achievements.length}</TableCell>
                  <TableCell>
                    <AchievementBadges achievements={entry.achievements} size="lg" className="justify-end" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
