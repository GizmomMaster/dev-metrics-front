import { cn } from '@/lib/utils';

/** Заглушка «нет данных» / «загрузка» внутри страницы или карточки. */
export default function EmptyState({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-dashed bg-background py-10 text-center text-sm text-muted-foreground', className)}>
      {children}
    </div>
  );
}
