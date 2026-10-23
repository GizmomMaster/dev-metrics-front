import { useEffect, useMemo, useRef, useState } from 'react';
import {
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  subMonths,
  subDays,
  differenceInCalendarDays,
  format,
  parseISO,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { Armchair } from 'lucide-react';

interface DayData {
  date: string; // ISO date string
  count: number;
}

interface Props {
  data: DayData[];
  reviewData?: DayData[];
  approvalData?: DayData[];
  lateData?: DayData[]; // коммиты после 20:00 или до 6:00 UTC
  vacationDates?: Set<string>; // YYYY-MM-DD строки — дни отпуска
  officeVisitDates?: Set<string>; // YYYY-MM-DD строки — дни работы из офиса
  startDate?: Date;
  endDate?: Date;
}

function buildDayCountMap(items: DayData[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = item.date.split('T')[0];
    map.set(key, (map.get(key) || 0) + item.count);
  }
  return map;
}

// Шкала интенсивности активности — 5 уровней
const COLORS = [
  'bg-gray-100 border-gray-200', // 0 — пусто
  'bg-blue-100 border-blue-200', // 1-9
  'bg-blue-200 border-blue-300', // 10-19
  'bg-blue-400 border-blue-500', // 20-29
  'bg-blue-600 border-blue-700', // 30+
];

const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const DAY_LABEL_COLUMN_WIDTH = 36; // ширина колонки с "Пн–Вс" слева, совпадает с paddingLeft подписей месяцев
const CELL_GAP = 6; // margin по 3px с каждой стороны ячейки
const MIN_CELL_SIZE = 10;
const ICON_LEGIBILITY_THRESHOLD = 16; // px — ниже глиф 24×24 читается как пятно, показываем точку
// Размер ячейки всегда считается так, будто выбран период "6 месяцев" (минимальный
// пресет, см. PeriodPicker.tsx) — это базовая точка, под которую сетка растягивается
// на всю ширину блока. Для более длинных периодов (9, 12 месяцев) ячейки того же
// размера не уменьшаются, а обрезаются горизонтальным скроллом.
const REFERENCE_DAYS = 183;

function countWeeks(start: Date, end: Date): number {
  const startAligned = startOfWeek(start, { weekStartsOn: 1 });
  const endAligned = endOfWeek(end, { weekStartsOn: 1 });
  return Math.ceil((differenceInCalendarDays(endAligned, startAligned) + 1) / 7);
}

function getCountLevel(count: number): number {
  if (count === 0) return 0;
  if (count <= 9) return 1;
  if (count <= 19) return 2;
  if (count <= 29) return 3;
  return 4;
}

interface TooltipState {
  x: number;
  y: number;
  dateStr: string;
  count: number;
  reviewCount: number;
  approvalCount: number;
  lateCount: number;
  isVacation: boolean;
  isOfficeDay: boolean;
}

export default function Heatmap({ data, reviewData, approvalData, lateData, vacationDates, officeVisitDates, startDate, endDate }: Props) {
  const end = endDate || new Date();
  const start = startDate || subMonths(end, 10);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Колесо мыши над горизонтальным скроллом двигает его по горизонтали
  // (обычный вертикальный скролл страницы). Слушатель вешаем нативно, а не
  // через onWheel — React 17+ регистрирует wheel-обработчики как passive,
  // из-за чего e.preventDefault() внутри JSX-обработчика не сработает.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return; // скроллить нечего
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const { weeks, monthLabels } = useMemo(() => {
    const startDateAligned = startOfWeek(start, { weekStartsOn: 1 });
    const endDateAligned = endOfWeek(end, { weekStartsOn: 1 });
    const allDays = eachDayOfInterval({ start: startDateAligned, end: endDateAligned });

    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];
    for (const day of allDays) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);

    // Подпись месяца ставится по центру занимаемых им недель, а не у первой из них.
    const monthLabels: { center: number; label: string }[] = [];
    let lastMonth = -1;
    let spanStart = 0;
    const flushSpan = (endExclusive: number) => {
      if (lastMonth === -1) return;
      monthLabels.push({
        center: (spanStart + endExclusive) / 2,
        label: format(weeks[spanStart][0], 'LLLL', { locale: ru }),
      });
    };
    for (let w = 0; w < weeks.length; w++) {
      const month = weeks[w][0].getMonth();
      if (month !== lastMonth) {
        flushSpan(w);
        spanStart = w;
        lastMonth = month;
      }
    }
    flushSpan(weeks.length);

    return { weeks, monthLabels };
  }, [end, start]);

  const dataMap = useMemo(() => buildDayCountMap(data), [data]);
  const reviewDataMap = useMemo(() => buildDayCountMap(reviewData ?? []), [reviewData]);
  const approvalDataMap = useMemo(() => buildDayCountMap(approvalData ?? []), [approvalData]);
  const lateDataMap = useMemo(() => buildDayCountMap(lateData ?? []), [lateData]);

  const totalCols = weeks.length || 1;
  const referenceWeeks = useMemo(() => countWeeks(subDays(end, REFERENCE_DAYS), end), [end]);
  const availableWidth = Math.max(containerWidth - DAY_LABEL_COLUMN_WIDTH, 0);
  // Без верхней границы — на 6 месяцах (REFERENCE_DAYS) ячейка обязана вырасти
  // ровно настолько, чтобы сетка заняла всю ширину блока, независимо от экрана.
  const cellSize = containerWidth > 0
    ? Math.max(MIN_CELL_SIZE, availableWidth / referenceWeeks - CELL_GAP)
    : MIN_CELL_SIZE;
  const cellGap = CELL_GAP;
  const contentWidth = totalCols * (cellSize + cellGap) + DAY_LABEL_COLUMN_WIDTH;

  return (
    <div className="w-full relative">
      <div ref={containerRef} className="w-full overflow-x-auto">
      <div className="py-4" style={{ minWidth: contentWidth }}>
        {/* Подписи месяцев — по центру занимаемых недель, без обрезки названия */}
        <div className="relative mb-1" style={{ height: 16, marginLeft: DAY_LABEL_COLUMN_WIDTH, width: totalCols * (cellSize + cellGap) }}>
          {monthLabels.map((m, i) => (
            <div
              key={i}
              className="absolute top-0 text-xs text-muted-foreground whitespace-nowrap"
              style={{ left: m.center * (cellSize + cellGap), transform: 'translateX(-50%)' }}
            >
              {m.label}
            </div>
          ))}
        </div>

        <div className="flex">
          <div className="flex flex-col justify-start" style={{ marginRight: 8, width: DAY_LABEL_COLUMN_WIDTH - 8 }}>
            {DAY_LABELS.map((label) => (
              <div
                key={label}
                className="text-xs text-muted-foreground flex items-center"
                style={{ height: cellSize + cellGap, lineHeight: `${cellSize}px` }}
              >
                {label}
              </div>
            ))}
          </div>

          <div className="flex">
            {weeks.map((week, w) => (
              <div key={w} className="flex flex-col">
                {week.map((day) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const count = dataMap.get(key) || 0;
                  const level = getCountLevel(count);
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const isVacation = vacationDates?.has(key) ?? false;
                  const hasActivity = count > 0;
                  const lateCount = lateDataMap.get(key) || 0;
                  const hasLateCommits = lateCount > 0;
                  const isOfficeVisit = officeVisitDates?.has(key) ?? false;
                  // На тёмных ячейках (высокая интенсивность коммитов, blue-400+)
                  // серая иконка стула сливается с фоном — переключаем на белую.
                  // Отпуск (bg-green-200) остаётся светлым независимо от level,
                  // поэтому туда тёмный вариант не нужен.
                  const isDarkCell = !isVacation && level >= 3;
                  const officeIconColorClass = isDarkCell ? 'text-white/90' : 'text-gray-500/60';

                  const className = isVacation
                    ? hasActivity
                      ? 'bg-green-200 border-green-300 ring-2 ring-blue-400 hover:ring-2 hover:ring-blue-500'
                      : 'bg-green-200 border-green-300 hover:ring-1 hover:ring-green-400'
                    : // Пустой выходной — отдельный, более светлый фон вместо COLORS[0], а не
                      // дописанный к нему класс: при двух bg-* на элементе побеждал бы тот,
                      // что раньше в CSS, и подсветка выходных не применялась.
                      `${isWeekend && count === 0 ? 'bg-gray-50 border-gray-200' : COLORS[level]} hover:ring-1 hover:ring-gray-400`;

                  // outline, а не ring/border — тоненькая рамка поверх любого фона
                  // (включая vacation+activity, который уже занял ring под свой индикатор)
                  const lateOutline = hasLateCommits ? 'outline outline-1 outline-red-500 -outline-offset-1' : '';

                  return (
                    <div
                      key={day.toISOString()}
                      className={`${className} ${lateOutline} rounded-sm border transition cursor-default flex items-center justify-center`}
                      style={{ width: cellSize, height: cellSize, margin: cellGap / 2 }}
                      onMouseEnter={(e) => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setTooltip({
                          x: rect.left,
                          y: rect.top,
                          dateStr: key,
                          count,
                          reviewCount: reviewDataMap.get(key) || 0,
                          approvalCount: approvalDataMap.get(key) || 0,
                          lateCount,
                          isVacation,
                          isOfficeDay: isOfficeVisit,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {isOfficeVisit && (
                        cellSize >= ICON_LEGIBILITY_THRESHOLD ? (
                          <Armchair
                            style={{ width: cellSize * 0.55, height: cellSize * 0.55 }}
                            strokeWidth={2}
                            className={`${officeIconColorClass} pointer-events-none`}
                          />
                        ) : (
                          <div className={`w-1 h-1 rounded-full pointer-events-none ${isDarkCell ? 'bg-white/90' : 'bg-gray-500/60'}`} />
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>

      {/* Легенда — вне скроллируемой области, не двигается вместе с сеткой */}
      <div className="flex items-center justify-end gap-4 mt-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Меньше</span>
          {COLORS.map((color, i) => (
            <div key={i} className={`w-3.5 h-3.5 rounded-sm border ${color}`} style={{ borderWidth: '1px' }} />
          ))}
          <span className="text-xs text-muted-foreground">Больше</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-sm border bg-green-200 border-green-300" style={{ borderWidth: '1px' }} />
          <span className="text-xs text-muted-foreground">Отпуск</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-sm border bg-green-200 border-green-300 ring-2 ring-blue-400" style={{ borderWidth: '1px' }} />
          <span className="text-xs text-muted-foreground">Отпуск + активность</span>
        </div>
        <div className="flex items-center gap-2">
          <Armchair className="w-3.5 h-3.5 text-gray-500/60" />
          <span className="text-xs text-muted-foreground">Работа из офиса</span>
        </div>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 bg-foreground text-background text-xs rounded-md shadow-md px-3 py-2 pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y - 50 }}
        >
          <div className="font-medium">{format(parseISO(tooltip.dateStr), 'dd.MM.yyyy', { locale: ru })}</div>
          <div className="flex items-center gap-2 text-blue-300 mt-0.5">
            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
            {tooltip.count} коммитов
          </div>
          <div className="flex items-center gap-2 text-amber-300 mt-0.5">
            <div className="w-2 h-2 rounded-full bg-amber-400"></div>
            {tooltip.reviewCount} мердж-реквестов
          </div>
          <div className="flex items-center gap-2 text-purple-300 mt-0.5">
            <div className="w-2 h-2 rounded-full bg-purple-400"></div>
            {tooltip.approvalCount} апрувов
          </div>
          <div className="flex items-center gap-2 text-red-300 mt-0.5">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            {tooltip.lateCount} коммитов после 20:00 или до 6:00 UTC
          </div>
          {tooltip.isVacation && (
            <div className="flex items-center gap-2 text-green-300 mt-0.5">
              <div className="w-2 h-2 rounded-full bg-green-400"></div>
              Отпуск
            </div>
          )}
          {tooltip.isOfficeDay && (
            <div className="flex items-center gap-2 text-gray-300 mt-0.5">
              <div className="w-2 h-2 rounded-full bg-gray-400"></div>
              Работал из офиса
            </div>
          )}
        </div>
      )}
    </div>
  );
}
