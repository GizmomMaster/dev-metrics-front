import { AlertCircle, RotateCw } from 'lucide-react';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface Props {
  /** Что именно не загрузилось — «Не удалось загрузить список сотрудников». */
  title: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Ошибка загрузки вместо данных.
 *
 * Показывается вместо EmptyState: пустой ответ и упавший запрос выглядели
 * одинаково, и при недоступном API страница уверенно сообщала «алармов нет»
 * или рисовала нули в метриках.
 */
export default function QueryError({ title, description = 'Сервер недоступен или вернул ошибку.', onRetry, className }: Props) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
      {onRetry && (
        <AlertAction>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCw /> Повторить
          </Button>
        </AlertAction>
      )}
    </Alert>
  );
}
