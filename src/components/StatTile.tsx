import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatTileProps {
  label: string;
  value: string;
  note?: string;
  icon?: LucideIcon;
  // Цвет иконки совпадает с цветом серии на графиках — по нему плитка и график
  // читаются как одна метрика.
  iconClassName?: string;
  /** Необязательный мини-график под значением (см. MonthSparkline). */
  children?: ReactNode;
}

/** Сводная цифра: подпись, значение, необязательная сноска (по образцу MetricTile в ReviewPlatform). */
export default function StatTile({ label, value, note, icon: Icon, iconClassName, children }: StatTileProps) {
  return (
    <div className="flex flex-col rounded-xl border bg-background p-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon && <Icon className={`size-4 shrink-0 ${iconClassName ?? ''}`} />}
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      {children && <div className="mt-auto pt-3">{children}</div>}
    </div>
  );
}
