import api from './client';

export interface BackgroundJobDto {
  jobId: string;
  lastExecution: string | null;
  lastJobState: string | null;
  nextExecution: string | null;
}

// Список приходит уже отсортированным по возрастанию lastExecution (сортировка
// на сервере, BackgroundJobsController.GetAll) — ни разу не запускавшиеся джобы
// (lastExecution === null) идут первыми.
export const getBackgroundJobs = async (): Promise<BackgroundJobDto[]> => {
  const response = await api.get<BackgroundJobDto[]>('/BackgroundJobs');
  return response.data;
};

// Ставит джобу в очередь Hangfire немедленно, не трогая cron-расписание.
// Выполнение асинхронно — сразу после ответа lastExecution ещё не обновится,
// нужен повторный getBackgroundJobs() чуть погодя (см. SettingsPage).
export const triggerBackgroundJob = async (jobId: string): Promise<void> => {
  await api.post(`/BackgroundJobs/${encodeURIComponent(jobId)}/trigger`);
};
