import api from './client';

export interface CommitMetricDto {
  id: number;
  timestamp: string;
  numberOfCommits: number;
  linesAdded: number;
  linesRemoved: number;
  dayOfWeek: number;
  serviceName: string;
}

export interface ReviewMetricDto {
  id: number;
  mergeRequestId: number;
  prOpenedAt: string;
  mergedAt: string | null;
  commentsCount: number;
  approvalIterations: number;
  firstApprovalAt: string | null;
  serviceName: string | null;
  repositoryName: string;
  sourceBranch: string | null;
}

export interface VacationDto {
  id: number;
  startDate: string;
  endDate: string;
}

export interface OfficeVisitDto {
  visitDate: string; // "yyyy-MM-dd" — DateOnly сериализуется без временной части
}

export interface AiTokenUsageDto {
  date: string; // "yyyy-MM-dd" — DateOnly сериализуется без временной части
  tokenCount: number;
}

export interface IssueMetricDto {
  id: number;
  repositoryName: string;
  createdAt: string;
  closedAt: string | null;
  wasCreatedByEmployee: boolean;
  wasClosedByEmployee: boolean;
}

export interface QualityGateRuleChangeDto {
  id: number;
  repositoryName: string;
  repositoryUrl: string;
  serviceName: string;
  releaseBranchName: string;
  mergeRequestId: number;
  ruleName: string;
  previousValue: string;
  newValue: string;
  mergedAt: string | null;
}

/**
 * Загрузчик метрики за период по сотруднику.
 *
 * Все семь эндпоинтов `/Metrics/*` принимают одну и ту же тройку query-пара-
 * метров (см. PeriodQuery на бэкенде) и отдают массив — различаются только
 * путём и типом элемента. Поэтому здесь одна реализация, а не семь копий.
 */
export type PeriodFetcher<T> = (employeeId: string, startDate: Date, endDate: Date) => Promise<T[]>;

const periodFetcher =
  <T>(path: string): PeriodFetcher<T> =>
  async (employeeId, startDate, endDate) => {
    const response = await api.get<T[]>(path, {
      params: { employeeId, startDate: startDate.toISOString(), endDate: endDate.toISOString() },
    });
    return response.data;
  };

export const getCommits = periodFetcher<CommitMetricDto>('/Metrics/commits');
export const getReviews = periodFetcher<ReviewMetricDto>('/Metrics/reviews');
export const getVacations = periodFetcher<VacationDto>('/Metrics/vacations');
export const getOfficeVisits = periodFetcher<OfficeVisitDto>('/Metrics/office-visits');
export const getAiTokenUsage = periodFetcher<AiTokenUsageDto>('/Metrics/ai-token-usage');
export const getIssues = periodFetcher<IssueMetricDto>('/Metrics/issues');
export const getQualityGateImprovements = periodFetcher<QualityGateRuleChangeDto>(
  '/Metrics/quality-gate-improvements'
);
