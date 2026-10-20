import type { MouseEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * Имя сотрудника — ссылка на его страницу активности.
 *
 * Таблицы открывают активность кликом по всей строке, но <tr onClick> недоступна
 * с клавиатуры и не открывается в новой вкладке. Ссылка в первой ячейке
 * закрывает и то и другое, а клик по строке остаётся для мыши.
 */
export default function ActivityLink({
  employeeId,
  children,
  className,
}: {
  employeeId: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={`/activity/${employeeId}`}
      className={cn('rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50', className)}
    >
      {children}
    </Link>
  );
}

/**
 * Клик пришёл из ссылки внутри строки — переход она выполнит сама, и обработчик
 * строки не должен навигировать второй раз (дубль записи в истории).
 */
export function isClickOnLink(event: MouseEvent): boolean {
  return event.target instanceof Element && event.target.closest('a') !== null;
}
