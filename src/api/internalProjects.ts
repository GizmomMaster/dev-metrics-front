import api from './client';

export interface InternalProjectDto {
  id: string;
  repoName: string;
  createdAt: string;
}

// Список приходит уже отсортированным по алфавиту (сортировка на сервере,
// InternalProjectsController.GetAll).
export const getInternalProjects = async (): Promise<InternalProjectDto[]> => {
  const response = await api.get<InternalProjectDto[]>('/InternalProjects');
  return response.data;
};

export const createInternalProject = async (repoName: string): Promise<InternalProjectDto> => {
  const response = await api.post<InternalProjectDto>('/InternalProjects', { repoName });
  return response.data;
};

export const updateInternalProject = async (id: string, repoName: string): Promise<void> => {
  await api.put(`/InternalProjects/${id}`, { repoName });
};

export const deleteInternalProject = async (id: string): Promise<void> => {
  await api.delete(`/InternalProjects/${id}`);
};
