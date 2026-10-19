import api from './client';

// Совпадает со строковым JSON от бэкенда (JsonStringEnumConverter в Program.cs)
// и включает все 8 значений enum'а PositionType.
export type PositionType =
  | 'FrontendDeveloper' | 'BackendDeveloper' | 'AndroidDeveloper'
  | 'IosDeveloper' | 'QaEngineer' | 'DevOpsEngineer' | 'Designer' | 'TechLead';

// Совпадает со строковым JSON от бэкенда (тот же JsonStringEnumConverter, что и
// у PositionType) и включает все 6 значений enum'а AchievementCode.
export type AchievementCode =
  | 'AiCoder' | 'BugFixer' | 'Auditor' | 'ClanMaster' | 'HardWorker' | 'QualityFighter';

export interface Achievement {
  code: AchievementCode;
  name: string;
  iconKey: string;
}

export interface EmployeeBrief {
  id: string;
  fullName: string;
  gitEmail: string;
  isActive: boolean;
  grade: string;
  position: PositionType;
  businessLine?: string;
  artName?: string;
  teamName?: string;
  achievements: Achievement[];
}

export interface EmployeeDetail extends EmployeeBrief {
  gitLabUserId: number;
  addedAt: string;
}

export const getEmployees = async (includeInactive = false): Promise<EmployeeBrief[]> => {
  const response = await api.get<EmployeeBrief[]>('/Employees', {
    params: { includeInactive },
  });
  return response.data;
};

export const getEmployee = async (id: string): Promise<EmployeeDetail> => {
  const response = await api.get<EmployeeDetail>(`/Employees/${id}`);
  return response.data;
};

export const toggleEmployeeActive = async (id: string): Promise<void> => {
  await api.put(`/Employees/${id}/toggle-active`);
};
