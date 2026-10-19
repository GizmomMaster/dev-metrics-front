import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AXIS_LINE, AXIS_TICK, CURSOR_FILL, GRID_STROKE, TOOLTIP_STYLE } from '@/lib/chart';

interface DayData {
  date: string;
  count: number;
}

type MetricType = 'commits' | 'reviews' | 'approvals' | 'aiTokens';

interface ActivityChartProps {
  commitData: DayData[];
  reviewData: DayData[];
  approvalData: DayData[];
  aiTokenData: DayData[];
  startDate: Date;
  endDate: Date;
}

interface ChartDataPoint {
  date: string;
  dateLabel: string;
  commits: number;
  reviews: number;
  approvals: number;
  aiTokens: number;
}

// Экспортируется — те же цвета у спарклайнов в плитках над графиком.
export const METRIC_COLORS: Record<MetricType, string> = {
  commits: '#3B82F6',
  reviews: '#F59E0B',
  approvals: '#A855F7',
  aiTokens: '#6366F1',
};

const METRIC_LABELS: Record<MetricType, string> = {
  commits: 'Коммиты',
  reviews: 'Мердж-реквесты',
  approvals: 'Апрувы',
  aiTokens: 'Токены ИИ',
};

export default function ActivityChart({
  commitData,
  reviewData,
  approvalData,
  aiTokenData,
  startDate,
  endDate,
}: ActivityChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('commits');

  const chartData: ChartDataPoint[] = useMemo(() => {
    const dataMap = new Map<string, ChartDataPoint>();

    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);

    while (current <= end) {
      const dateStr = format(current, 'yyyy-MM-dd');
      dataMap.set(dateStr, {
        date: dateStr,
        dateLabel: format(current, 'dd.MM'),
        commits: 0,
        reviews: 0,
        approvals: 0,
        aiTokens: 0,
      });
      current.setDate(current.getDate() + 1);
    }

    for (const item of commitData) {
      const existing = dataMap.get(item.date.split('T')[0]);
      if (existing) existing.commits = item.count;
    }
    for (const item of reviewData) {
      const existing = dataMap.get(item.date.split('T')[0]);
      if (existing) existing.reviews = item.count;
    }
    for (const item of approvalData) {
      const existing = dataMap.get(item.date.split('T')[0]);
      if (existing) existing.approvals = item.count;
    }
    for (const item of aiTokenData) {
      const existing = dataMap.get(item.date.split('T')[0]);
      if (existing) existing.aiTokens = item.count;
    }

    return Array.from(dataMap.values());
  }, [commitData, reviewData, approvalData, aiTokenData, startDate, endDate]);

  return (
    <div>
      <Tabs value={selectedMetric} onValueChange={(v) => setSelectedMetric(v as MetricType)} className="mb-4">
        <TabsList aria-label="Метрика графика">
          {(['commits', 'reviews', 'approvals', 'aiTokens'] as MetricType[]).map((metric) => (
            <TabsTrigger key={metric} value={metric}>
              {METRIC_LABELS[metric]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="dateLabel" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              cursor={{ fill: CURSOR_FILL }}
              formatter={(value: number, name: string) => [value.toString(), METRIC_LABELS[name as MetricType]]}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} formatter={(value: string) => METRIC_LABELS[value as MetricType]} />
            <Bar dataKey={selectedMetric} fill={METRIC_COLORS[selectedMetric]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
