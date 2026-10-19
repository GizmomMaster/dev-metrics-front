import api from './client';

export interface AlarmEmployeeDto {
  employeeId: string;
  fullName: string;
  /** Нет коммитов дольше двух недель (или не было вовсе). */
  isSilent: boolean;
  /** null — сотрудник не коммитил никогда, а не «давно»: подписи в UI разные. */
  lastCommitAt: string | null;
  /** Только пометка — из списка «молчащих» отпуск не убирает. */
  isOnVacation: boolean;
  hasLateCommits: boolean;
  lateCommitCount: number;
}

// Список приходит уже отсортированным (сортировка на сервере, AlarmsController.GetAll):
// сначала молчащие — дольше молчит выше, никогда не коммитившие в самом верху,
// затем ночные по убыванию количества коммитов.
export const getAlarms = async (): Promise<AlarmEmployeeDto[]> => {
  const response = await api.get<AlarmEmployeeDto[]>('/Alarms');
  return response.data;
};
