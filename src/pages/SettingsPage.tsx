import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Plus, Pencil, Trash2, Check, X, CheckCircle2, XCircle, HelpCircle, Play, Loader2 } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import QueryError from '../components/QueryError';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  getInternalProjects,
  createInternalProject,
  updateInternalProject,
  deleteInternalProject,
} from '../api/internalProjects';
import { getBackgroundJobs, triggerBackgroundJob, type BackgroundJobDto } from '../api/backgroundJobs';

// Сколько ждать после ручного запуска, пока не перестанем считать задачу
// "выполняющейся" — даже если Hangfire почему-то не обновил lastExecution
// (сеть легла, воркер занят другим ретраем и т.п.), polling не должен идти вечно.
const TRIGGER_POLL_TIMEOUT_MS = 60_000;

const QUERY_KEY = ['internalProjects'];
const JOBS_QUERY_KEY = ['backgroundJobs'];

// Технические id заданы при регистрации в Program.cs (IRecurringJobManager.AddOrUpdate) —
// здесь только человекочитаемые подписи для UI. Незнакомый id (появилась новая
// джоба, а маппинг забыли обновить) — просто показываем сырой jobId, см. ниже.
const JOB_LABELS: Record<string, string> = {
  'refresh-token-cleanup': 'Очистка refresh-токенов',
  'daily-import': 'Импорт коммитов и МР из GitLab',
  'office-attendance-import': 'Импорт посещаемости офиса',
  'ai-token-usage-import': 'Импорт использования AI-токенов',
  'quality-gate-import': 'Импорт Quality Gate',
  'achievements-recalculation': 'Пересчёт ачивок',
  'monthly-achievements-snapshot': 'Снепшот зала славы',
};

function formatJobDate(value: string | null, fallback: string): string {
  if (!value) return fallback;
  return format(new Date(value), 'd MMMM yyyy, HH:mm', { locale: ru });
}

// Промежуточные состояния Hangfire: задача поставлена в очередь или выполняется,
// результата ещё нет. Раньше любое состояние, кроме Succeeded, рисовалось красным
// как ошибка — включая Enqueued сразу после нажатия «Запустить».
const IN_PROGRESS_STATES: Record<string, string> = {
  Enqueued: 'В очереди',
  Scheduled: 'Запланирована',
  Awaiting: 'Ожидает',
  Processing: 'Выполняется',
};

const isJobInProgress = (job: BackgroundJobDto) => job.lastJobState !== null && job.lastJobState in IN_PROGRESS_STATES;

function JobStatusBadge({ state }: { state: string | null }) {
  if (state !== null && state in IN_PROGRESS_STATES) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> {IN_PROGRESS_STATES[state]}
      </span>
    );
  }
  if (state === 'Succeeded') {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-700">
        <CheckCircle2 className="size-4" /> Успешно
      </span>
    );
  }
  if (state === null) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <HelpCircle className="size-4" /> Нет данных
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-destructive">
      <XCircle className="size-4" /> {state}
    </span>
  );
}

// Бэкенд отвечает { Error: "..." } (см. InternalProjectsController) — вытаскиваем
// текст, чтобы показать причину отказа (дубль/пустое имя), а не общее «не удалось».
// При camelCase-политике сериализации ASP.NET (по умолчанию) поле приходит как
// `error`, поэтому проверяем оба написания.
function errorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { error?: unknown; Error?: unknown } } })?.response?.data;
  const message = data?.error ?? data?.Error;
  return typeof message === 'string' && message ? message : fallback;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState('');
  const [jobsError, setJobsError] = useState('');
  // jobId -> lastExecution, снятый в момент клика "Запустить сейчас" — как только
  // у джобы придёт lastExecution, отличный от этого снимка, считаем её завершённой
  // и убираем из "выполняющихся" (см. эффект ниже).
  const [pendingJobs, setPendingJobs] = useState<Record<string, string | null>>({});

  const { data: projects = [], isLoading, isLoadingError, refetch: refetchProjects } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getInternalProjects,
  });

  const hasPendingJobs = Object.keys(pendingJobs).length > 0;

  // Отдельный, независимый от секции репозиториев запрос. Пока есть только что
  // запущенные вручную джобы или джобы в промежуточном состоянии (в очереди,
  // выполняется), опрашиваем чаще — Hangfire выполняет их асинхронно, и без
  // этого статус "Успешно"/"Не удалось" появился бы только после того, как
  // пользователь сам перезагрузит страницу.
  const {
    data: backgroundJobs = [],
    isLoading: isLoadingJobs,
    isLoadingError: isJobsLoadingError,
    refetch: refetchJobs,
  } = useQuery({
    queryKey: JOBS_QUERY_KEY,
    queryFn: getBackgroundJobs,
    // Ночная джоба может выполняться долго (или зависнуть в Processing после
    // падения воркера) — её опрашиваем реже, чем только что запущенную вручную.
    refetchInterval: (query) => {
      if (hasPendingJobs) return 2000;
      return query.state.data?.some(isJobInProgress) ? 5000 : false;
    },
  });

  // Снимаем джобу с опроса, как только её lastExecution изменился относительно
  // снимка на момент запуска, либо по таймауту (см. TRIGGER_POLL_TIMEOUT_MS).
  useEffect(() => {
    if (!hasPendingJobs) return;

    setPendingJobs((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const job of backgroundJobs) {
        if (job.jobId in next && job.lastExecution !== next[job.jobId]) {
          delete next[job.jobId];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [backgroundJobs, hasPendingJobs]);

  useEffect(() => {
    if (!hasPendingJobs) return;
    const timeout = setTimeout(() => setPendingJobs({}), TRIGGER_POLL_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [hasPendingJobs]);

  const triggerJobMutation = useMutation({
    mutationFn: (jobId: string) => triggerBackgroundJob(jobId),
    onMutate: (jobId) => {
      setJobsError('');
      const snapshot = backgroundJobs.find((j) => j.jobId === jobId)?.lastExecution ?? null;
      setPendingJobs((prev) => ({ ...prev, [jobId]: snapshot }));
    },
    onError: (e, jobId) => {
      setPendingJobs((prev) => {
        const { [jobId]: _removed, ...rest } = prev;
        return rest;
      });
      setJobsError(errorMessage(e, 'Не удалось запустить задачу'));
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const createMutation = useMutation({
    mutationFn: (repoName: string) => createInternalProject(repoName),
    onSuccess: () => {
      setNewName('');
      setError('');
      refresh();
    },
    onError: (e) => setError(errorMessage(e, 'Не удалось добавить репозиторий')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, repoName }: { id: string; repoName: string }) => updateInternalProject(id, repoName),
    onSuccess: () => {
      setEditingId(null);
      setError('');
      refresh();
    },
    onError: (e) => setError(errorMessage(e, 'Не удалось сохранить изменения')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInternalProject(id),
    onSuccess: () => {
      setError('');
      refresh();
    },
    onError: (e) => setError(errorMessage(e, 'Не удалось удалить репозиторий')),
  });

  const busy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const handleCreate = () => {
    if (!newName.trim()) return;
    createMutation.mutate(newName.trim());
  };

  const handleSaveEdit = () => {
    if (!editingId || !editingName.trim()) return;
    updateMutation.mutate({ id: editingId, repoName: editingName.trim() });
  };

  const startEditing = (id: string, repoName: string) => {
    setEditingId(id);
    setEditingName(repoName);
    setError('');
  };

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold">Настройки</h1>

      <Card>
        <CardHeader>
          <CardTitle>Список внутрикорпоративных репозиториев</CardTitle>
          <CardDescription>
            Репозиторий из этого списка помечается как внутрикорпоративный при ближайшем ночном импорте из GitLab.
            Удаление записи снимает пометку.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Имя репозитория, например internal-devtools"
            />
            <Button onClick={handleCreate} disabled={busy || !newName.trim()}>
              <Plus /> Добавить
            </Button>
          </div>

          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : isLoadingError ? (
            <QueryError title="Не удалось загрузить список репозиториев" onRetry={() => void refetchProjects()} />
          ) : projects.length === 0 ? (
            <EmptyState className="py-8">Список пуст — ни один репозиторий не помечен как внутрикорпоративный</EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Репозиторий</TableHead>
                    <TableHead className="w-32 text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell>
                        {editingId === project.id ? (
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            autoFocus
                            className="h-7"
                          />
                        ) : (
                          project.repoName
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {editingId === project.id ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={handleSaveEdit}
                                disabled={busy || !editingName.trim()}
                                title="Сохранить"
                                aria-label="Сохранить"
                              >
                                <Check />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setEditingId(null)}
                                title="Отменить"
                                aria-label="Отменить"
                              >
                                <X />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => startEditing(project.id, project.repoName)}
                                disabled={busy}
                                title="Редактировать"
                                aria-label="Редактировать"
                              >
                                <Pencil />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => {
                                  if (confirm(`Удалить «${project.repoName}» из списка?`))
                                    deleteMutation.mutate(project.id);
                                }}
                                disabled={busy}
                                title="Удалить"
                                aria-label="Удалить"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Фоновые задачи</CardTitle>
          <CardDescription>
            Ночные джобы (Hangfire): время последнего и следующего запланированного запуска. Кнопка «Запустить» ставит
            задачу в очередь немедленно, не меняя расписание.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {jobsError && (
            <Alert variant="destructive">
              <AlertDescription>{jobsError}</AlertDescription>
            </Alert>
          )}

          {isLoadingJobs ? (
            <Skeleton className="h-48 w-full" />
          ) : isJobsLoadingError ? (
            <QueryError title="Не удалось загрузить фоновые задачи" onRetry={() => void refetchJobs()} />
          ) : backgroundJobs.length === 0 ? (
            <EmptyState className="py-8">Нет зарегистрированных фоновых задач</EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Задача</TableHead>
                    <TableHead>Последний запуск</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Следующий запуск</TableHead>
                    <TableHead className="w-32 text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backgroundJobs.map((job: BackgroundJobDto) => {
                    const isPending = job.jobId in pendingJobs;
                    return (
                      <TableRow key={job.jobId}>
                        <TableCell className="font-medium">{JOB_LABELS[job.jobId] ?? job.jobId}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatJobDate(job.lastExecution, 'ещё не запускалась')}
                        </TableCell>
                        <TableCell>
                          {isPending ? (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Loader2 className="size-4 animate-spin" /> Выполняется…
                            </span>
                          ) : (
                            <JobStatusBadge state={job.lastJobState} />
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatJobDate(job.nextExecution, 'не запланирован')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => triggerJobMutation.mutate(job.jobId)}
                            disabled={isPending}
                            title="Запустить сейчас, не дожидаясь расписания"
                          >
                            <Play /> Запустить
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
