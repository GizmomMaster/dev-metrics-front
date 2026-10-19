import api from './client';
import type { Achievement } from './employees';

export interface AvailableMonth {
  year: number;
  month: number; // 1-12
}

export interface HallOfFameEntry {
  employeeId: string;
  fullName: string;
  achievements: Achievement[];
}

// Achievement + условие получения — для легенды на странице "Зал достижений".
export interface AchievementCatalogEntry extends Achievement {
  description: string;
}

export const getCatalog = async (): Promise<AchievementCatalogEntry[]> => {
  const response = await api.get<AchievementCatalogEntry[]>('/Achievements/catalog');
  return response.data;
};

export const getAvailableMonths = async (): Promise<AvailableMonth[]> => {
  const response = await api.get<AvailableMonth[]>('/Achievements/months');
  return response.data;
};

export const getHallOfFame = async (year: number, month: number): Promise<HallOfFameEntry[]> => {
  const response = await api.get<HallOfFameEntry[]>('/Achievements/hall-of-fame', {
    params: { year, month },
  });
  return response.data;
};
