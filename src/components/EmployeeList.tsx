import { EmployeeBrief } from '../api/employees';
import EmployeeTags, { buildEmployeeTags } from './EmployeeTags';
import AchievementBadges from './AchievementBadges';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Props {
  employees: EmployeeBrief[];
  onSelect: (id: string) => void;
}

// Табличный вид — компактная альтернатива карточкам EmployeeCard для больших
// списков (см. EmployeesPage.tsx: авто-переключение при filtered.length > 30).
export default function EmployeeList({ employees, onSelect }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Сотрудник</TableHead>
            <TableHead>Должность</TableHead>
            <TableHead>Команда</TableHead>
            <TableHead>Ачивки</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => (
            <TableRow
              key={employee.id}
              onClick={() => onSelect(employee.id)}
              className={cn('cursor-pointer', !employee.isActive && 'text-muted-foreground')}
            >
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium whitespace-nowrap">{employee.fullName}</span>
                  {!employee.isActive && (
                    <Badge variant="outline" title="Сотрудник неактивен (уволен)">
                      неактивен
                    </Badge>
                  )}
                </div>
                <div className="max-w-xs truncate text-xs text-muted-foreground">{employee.gitEmail}</div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  <EmployeeTags tags={buildEmployeeTags(employee, ['grade', 'position'])} compact />
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                <div className="max-w-[16rem] truncate">
                  {[employee.businessLine, employee.artName, employee.teamName].filter(Boolean).join(' · ') || '—'}
                </div>
              </TableCell>
              <TableCell>
                <AchievementBadges achievements={employee.achievements} size="sm" className="" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
