import { Calendar, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface PeriodPreset {
  label: string;
  days: number;
}

export const PERIOD_PRESETS: PeriodPreset[] = [
  { label: '6 месяцев', days: 183 },
  { label: '9 месяцев', days: 274 },
  { label: '12 месяцев', days: 365 },
];

interface PeriodPickerProps {
  days: number;
  onChange: (days: number) => void;
}

export default function PeriodPicker({ days, onChange }: PeriodPickerProps) {
  const selected = PERIOD_PRESETS.find((p) => p.days === days) ?? PERIOD_PRESETS[PERIOD_PRESETS.length - 1];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Calendar />
          {selected.label}
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup value={String(selected.days)} onValueChange={(v) => onChange(Number(v))}>
          {PERIOD_PRESETS.map((preset) => (
            <DropdownMenuRadioItem key={preset.days} value={String(preset.days)}>
              {preset.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
