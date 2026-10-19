import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { MonthBar } from '../pages/activityMonthly';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface MonthSparklineProps {
  bars: MonthBar[];
  color: string;
  /** Подпись значения в подсказке: «12 коммитов», «3 400 токенов/день». */
  formatValue: (value: number) => string;
  /** Для скринридеров: что именно показывает спарклайн. */
  label: string;
}

const HEIGHT = 40;
// Отступ сверху и снизу, чтобы линия толщиной 2px и точка наведения не обрезались по краю.
const PAD = 4;

const shortMonth = (bar: MonthBar) =>
  format(new Date(Number(bar.month.slice(0, 4)), Number(bar.month.slice(5, 7)) - 1, 1), 'LLL', { locale: ru });

/**
 * Линия по месяцам внутри плитки. Отрезки, касающиеся неполного месяца на
 * краю периода, пунктирные — чтобы обрезанный месяц не читался как провал.
 * Цель наведения — вся колонка месяца на всю высоту, точка появляется на линии.
 */
export default function MonthSparkline({ bars, color, formatValue, label }: MonthSparklineProps) {
  if (bars.length === 0) return null;
  const max = Math.max(...bars.map((b) => b.value), 1);
  // x — в процентах ширины (viewBox 0..100, растягивается по ширине плитки), y — в пикселях.
  const x = (i: number) => ((i + 0.5) / bars.length) * 100;
  const y = (value: number) => PAD + (1 - value / max) * (HEIGHT - 2 * PAD);
  const points = bars.map((bar, i) => `${x(i)},${y(bar.value)}`);
  const areaPath = `M${x(0)},${HEIGHT} L${points.join(' L')} L${x(bars.length - 1)},${HEIGHT} Z`;

  return (
    <div>
      <div className="relative border-b" style={{ height: HEIGHT }} role="img" aria-label={label}>
        <svg
          className="absolute inset-0 size-full overflow-visible"
          viewBox={`0 0 100 ${HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d={areaPath} fill={color} fillOpacity={0.1} />
          {bars.slice(1).map((bar, i) => (
            <line
              key={bar.month}
              x1={x(i)}
              y1={y(bars[i].value)}
              x2={x(i + 1)}
              y2={y(bar.value)}
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray={bars[i].partial || bar.partial ? '3 3' : undefined}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex">
          {bars.map((bar) => (
            <Tooltip key={bar.month}>
              <TooltipTrigger asChild>
                <div className="group relative h-full flex-1 outline-none" tabIndex={0}>
                  <span
                    className="absolute left-1/2 size-2 -translate-x-1/2 translate-y-1/2 rounded-full opacity-0 ring-2 ring-background group-hover:opacity-100 group-focus-visible:opacity-100"
                    style={{ bottom: HEIGHT - y(bar.value), backgroundColor: color }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div>
                  <div className="font-medium">{bar.label}</div>
                  <div>{formatValue(bar.value)}</div>
                  {bar.partial && <div className="opacity-70">неполный месяц</div>}
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{shortMonth(bars[0])}</span>
        <span>{shortMonth(bars[bars.length - 1])}</span>
      </div>
    </div>
  );
}
