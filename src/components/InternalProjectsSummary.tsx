import { useMemo } from 'react';
import type { CommitMetricDto, ReviewMetricDto, IssueMetricDto } from '../api/metrics';
import EmptyState from './EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface InternalProjectsSummaryProps {
  commitData: CommitMetricDto[];
  reviewData: ReviewMetricDto[];
  issueData: IssueMetricDto[];
  internalRepoNames: string[];
}

interface ProjectRow {
  name: string;
  commits: number;
  mergeRequests: number;
  approvals: number;
  issuesCreated: number;
  issuesClosed: number;
}

export default function InternalProjectsSummary({
  commitData,
  reviewData,
  issueData,
  internalRepoNames,
}: InternalProjectsSummaryProps) {
  const rows: ProjectRow[] = useMemo(
    () =>
      internalRepoNames.map((name) => ({
        name,
        commits: commitData
          .filter((c) => c.serviceName === name)
          .reduce((sum, c) => sum + c.numberOfCommits, 0),
        mergeRequests: reviewData.filter((r) => r.repositoryName === name).length,
        approvals: reviewData
          .filter((r) => r.repositoryName === name)
          .reduce((sum, r) => sum + r.approvalIterations, 0),
        issuesCreated: issueData.filter((i) => i.repositoryName === name && i.wasCreatedByEmployee).length,
        issuesClosed: issueData.filter((i) => i.repositoryName === name && i.wasClosedByEmployee).length,
      })),
    [commitData, reviewData, issueData, internalRepoNames]
  );

  const total = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          commits: acc.commits + r.commits,
          mergeRequests: acc.mergeRequests + r.mergeRequests,
          approvals: acc.approvals + r.approvals,
          issuesCreated: acc.issuesCreated + r.issuesCreated,
          issuesClosed: acc.issuesClosed + r.issuesClosed,
        }),
        { commits: 0, mergeRequests: 0, approvals: 0, issuesCreated: 0, issuesClosed: 0 }
      ),
    [rows]
  );

  const hasActivity = total.commits + total.mergeRequests + total.approvals + total.issuesCreated + total.issuesClosed > 0;

  const columns = ['commits', 'mergeRequests', 'approvals', 'issuesCreated', 'issuesClosed'] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Внутрикорпоративные проекты</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 || !hasActivity ? (
          <EmptyState className="py-6">Нет активности во внутрикорпоративных проектах за выбранный период</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Проект</TableHead>
                  <TableHead className="text-right">Коммиты</TableHead>
                  <TableHead className="text-right">МР</TableHead>
                  <TableHead className="text-right">Апрувы</TableHead>
                  <TableHead className="text-right">Issues создано</TableHead>
                  <TableHead className="text-right">Issues закрыто</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    {columns.map((column) => (
                      <TableCell key={column} className="text-right tabular-nums">
                        {row[column]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Итого</TableCell>
                  {columns.map((column) => (
                    <TableCell key={column} className="text-right tabular-nums">
                      {total[column]}
                    </TableCell>
                  ))}
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
