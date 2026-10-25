import { useMemo, useRef, useState } from 'react';
import { Sankey, ResponsiveContainer, Rectangle, Layer } from 'recharts';
import type { CommitMetricDto, ReviewMetricDto } from '../api/metrics';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TOOLTIP_STYLE } from '@/lib/chart';

type SankeyMetric = 'commits' | 'reviews' | 'approvals';

interface ServiceSankeyProps {
  commitData: CommitMetricDto[];
  reviewData: ReviewMetricDto[];
}

const METRIC_LABELS: Record<SankeyMetric, string> = {
  commits: 'Коммиты',
  reviews: 'Мердж-реквесты',
  approvals: 'Апрувы',
};

const METRIC_UNITS: Record<SankeyMetric, string> = {
  commits: 'коммитов',
  reviews: 'мердж-реквестов',
  approvals: 'апрувов',
};

const NO_SERVICE = 'Без сервиса';

interface SankeyNodeShapeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  payload: { name: string };
  onHover: (x: number, y: number, name: string) => void;
  onLeave: () => void;
}

// Sankey из recharts по умолчанию рисует только прямоугольники узлов, без
// подписей — левый узел (index === 0, выбранная метрика) подписываем слева
// от прямоугольника, правые узлы (сервисы) — справа, иначе название сервиса
// нигде не видно.
function SankeyNodeShape({ x, y, width, height, index, payload, onHover, onLeave }: SankeyNodeShapeProps) {
  const isSource = index === 0;
  return (
    <Layer>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={isSource ? '#3B82F6' : '#6366F1'}
        fillOpacity={0.9}
        onMouseEnter={(e: React.MouseEvent) => onHover(e.clientX, e.clientY, payload.name)}
        onMouseLeave={onLeave}
      />
      <text
        x={isSource ? x - 8 : x + width + 8}
        y={y + height / 2}
        textAnchor={isSource ? 'end' : 'start'}
        dominantBaseline="middle"
        fontSize={12}
        fill="var(--foreground)"
      >
        {payload.name}
      </text>
    </Layer>
  );
}

interface HoverState {
  x: number;
  y: number;
  service: string;
  value: number;
}

export default function ServiceSankey({ commitData, reviewData }: ServiceSankeyProps) {
  const [selectedMetric, setSelectedMetric] = useState<SankeyMetric>('commits');
  const [hover, setHover] = useState<HoverState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Группировка по сервису: для коммитов сервисом выступает имя репозитория
  // (serviceName у CommitMetricDto = Repository.Name — отдельного поля нет),
  // для МР/апрувов — ServiceName из review_metrics (может быть null у ещё не
  // размеченных записей — попадают в "Без сервиса"). МР и апрувы — только по
  // смёрженным МР, как в плитках над графиком: иначе сумма здесь расходилась бы
  // с цифрой в плитке.
  const grouped = useMemo(() => {
    const mergedReviews = reviewData.filter((r) => r.mergedAt);
    const map = new Map<string, number>();
    if (selectedMetric === 'commits') {
      for (const c of commitData) {
        map.set(c.serviceName, (map.get(c.serviceName) || 0) + c.numberOfCommits);
      }
    } else if (selectedMetric === 'reviews') {
      for (const r of mergedReviews) {
        const key = r.serviceName ?? NO_SERVICE;
        map.set(key, (map.get(key) || 0) + 1); // 1 строка = 1 МР
      }
    } else {
      for (const r of mergedReviews) {
        const key = r.serviceName ?? NO_SERVICE;
        map.set(key, (map.get(key) || 0) + r.approvalIterations);
      }
    }
    return Array.from(map, ([name, value]) => ({ name, value })).filter((d) => d.value > 0);
  }, [selectedMetric, commitData, reviewData]);

  const totalValue = useMemo(() => grouped.reduce((sum, g) => sum + g.value, 0), [grouped]);

  const sankeyData = useMemo(
    () => ({
      nodes: [{ name: METRIC_LABELS[selectedMetric] }, ...grouped.map((g) => ({ name: g.name }))],
      links: grouped.map((g, i) => ({ source: 0, target: i + 1, value: g.value })),
    }),
    [grouped, selectedMetric]
  );

  // Свой тултип поверх мыши вместо встроенного Tooltip у Sankey — тот
  // рассчитан на позиционирование через TooltipBoundingBox, которое для
  // Sankey в этой версии recharts не срабатывает надёжно. onMouseEnter на
  // самом узле (см. SankeyNodeShape) — источник истины: срабатывает
  // гарантированно, т.к. это наш собственный обработчик, а не встроенный.
  const handleNodeHover = (clientX: number, clientY: number, name: string) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const isSourceNode = name === METRIC_LABELS[selectedMetric];
    const value = isSourceNode ? totalValue : (grouped.find((g) => g.name === name)?.value ?? 0);
    setHover({ x: clientX - rect.left, y: clientY - rect.top, service: name, value });
  };

  return (
    <div>
      <Tabs
        value={selectedMetric}
        onValueChange={(v) => {
          setSelectedMetric(v as SankeyMetric);
          setHover(null);
        }}
        className="mb-4"
      >
        <TabsList aria-label="Метрика для диаграммы сервисов">
          {(['commits', 'reviews', 'approvals'] as SankeyMetric[]).map((metric) => (
            <TabsTrigger key={metric} value={metric}>
              {METRIC_LABELS[metric]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div ref={containerRef} style={{ width: '100%', height: 320, position: 'relative' }}>
        {grouped.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
            Нет данных за выбранный период
          </div>
        ) : (
          <>
            <ResponsiveContainer>
              <Sankey
                data={sankeyData}
                nodePadding={24}
                nodeWidth={12}
                linkCurvature={0.5}
                link={{ stroke: '#94a3b8', strokeOpacity: 0.4 }}
                node={
                  <SankeyNodeShape
                    x={0}
                    y={0}
                    width={0}
                    height={0}
                    index={0}
                    payload={{ name: '' }}
                    onHover={handleNodeHover}
                    onLeave={() => setHover(null)}
                  />
                }
                margin={{ top: 10, right: 140, bottom: 10, left: 100 }}
              />
            </ResponsiveContainer>
            {hover && (
              <div
                style={{
                  position: 'absolute',
                  left: hover.x + 12,
                  top: hover.y + 12,
                  ...TOOLTIP_STYLE,
                  padding: '8px 12px',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                  zIndex: 10,
                }}
              >
                <div>{hover.service}</div>
                <div style={{ fontWeight: 600 }}>
                  {hover.value.toLocaleString('ru-RU')} {METRIC_UNITS[selectedMetric]}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
