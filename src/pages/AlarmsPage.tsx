import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { HelpCircle, Moon, Palmtree } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import QueryError from '../components/QueryError';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getAlarms, type AlarmEmployeeDto } from '../api/alarms';

export type AlarmKind = 'silent' | 'late';

const FILTERS: { kind: AlarmKind; icon: typeof HelpCircle; description: string }[] = [
  { kind: 'silent', icon: HelpCircle, description: 'Нет коммитов больше двух недель' },
  { kind: 'late', icon: Moon, description: 'Коммиты после 20:00 или до 6:00' },
];

// Пустое множество трактуем как «показать всё» — та же семантика, что у фильтра
// должностей на странице сотрудников (activePositions в EmployeesPage). Так снятие
// обоих фильтров не заводит в тупик с пустым экраном.
export function filterAlarms(alarms: AlarmEmployeeDto[], activeKinds: Set<AlarmKind>): AlarmEmployeeDto[] {
  if (activeKinds.size === 0) return alarms;
  return alarms.filter(
    (a) => (activeKinds.has('silent') && a.isSilent) || (activeKinds.has('late') && a.hasLateCommits),
  );
}

function describeAlarm(alarm: AlarmEmployeeDto): string {
  if (alarm.isSilent) {
    return alarm.lastCommitAt === null
      ? 'нет коммитов'
      : `нет активности с ${format(new Date(alarm.lastCommitAt), 'd MMMM', { locale: ru })}`;
  }
  return `${alarm.lateCommitCount} ноч. коммитов`;
}

export default function AlarmsPage() {
  const navigate = useNavigate();
  const [activeKinds, setActiveKinds] = useState<Set<AlarmKind>>(new Set(['silent', 'late']));

  const { data: alarms = [], isLoading, isLoadingError, refetch } = useQuery({
    queryKey: ['alarms'],
    queryFn: getAlarms,
  });

  const visible = useMemo(() => filterAlarms(alarms, activeKinds), [alarms, activeKinds]);

  const toggleKind = (kind: AlarmKind) => {
    setActiveKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  return (
    <section className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Alarms</h1>
        <div className="ml-auto flex items-center gap-1">
          {FILTERS.map(({ kind, icon: Icon, description }) => {
            const active = activeKinds.has(kind);
            return (
              <Tooltip key={kind}>
                <TooltipTrigger asChild>
                  <Button
                    variant={active ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={() => toggleKind(kind)}
                    aria-label={description}
                    aria-pressed={active}
                    className={active ? undefined : 'text-muted-foreground'}
                  >
                    <Icon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{description}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : isLoadingError ? (
        <QueryError title="Не удалось загрузить алармы" onRetry={() => void refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState>
          {alarms.length === 0
            ? 'Алармов нет — все сотрудники активно коммитят в рабочее время'
            : 'Под выбранные фильтры никто не попадает'}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Сотрудник</TableHead>
                <TableHead className="text-right">Причина</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((alarm) => (
                <TableRow
                  key={alarm.employeeId}
                  onClick={() => navigate(`/activity/${alarm.employeeId}`)}
                  className="cursor-pointer"
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {alarm.isSilent ? (
                        <HelpCircle className="size-4 shrink-0 text-amber-500" />
                      ) : (
                        <Moon className="size-4 shrink-0 text-indigo-500" />
                      )}
                      <span className="truncate font-medium">{alarm.fullName}</span>
                      {alarm.isOnVacation && (
                        <Badge variant="secondary">
                          <Palmtree /> В отпуске
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{describeAlarm(alarm)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
