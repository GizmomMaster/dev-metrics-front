import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar, ChevronDown } from 'lucide-react';
import type { AvailableMonth } from '../api/achievements';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MonthPickerProps {
  months: AvailableMonth[]; // ожидается уже отсортированным по убыванию (см. GetAvailableMonthsAsync)
  selected: AvailableMonth | null;
  onChange: (month: AvailableMonth) => void;
}

export const formatMonthLabel = (month: AvailableMonth): string => {
  const label = format(new Date(month.year, month.month - 1, 1), 'LLLL yyyy', { locale: ru });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const monthKey = (month: AvailableMonth) => `${month.year}-${month.month}`;

export default function MonthPicker({ months, selected, onChange }: MonthPickerProps) {
  if (months.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Calendar />
          {selected ? formatMonthLabel(selected) : 'Выберите месяц'}
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-48 overflow-y-auto">
        <DropdownMenuRadioGroup
          value={selected ? monthKey(selected) : ''}
          onValueChange={(key) => {
            const month = months.find((m) => monthKey(m) === key);
            if (month) onChange(month);
          }}
        >
          {months.map((month) => (
            <DropdownMenuRadioItem key={monthKey(month)} value={monthKey(month)}>
              {formatMonthLabel(month)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
