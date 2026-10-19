import api from './client';

export interface RepositoryDto {
  id: string;
  gitLabProjectId: number;
  name: string;
  url: string;
  lastSyncAt: string | null;
  isActive: boolean;
  isInternalProject: boolean;
}

export const getRepositories = async (): Promise<RepositoryDto[]> => {
  const response = await api.get<RepositoryDto[]>('/Repositories');
  return response.data;
};
