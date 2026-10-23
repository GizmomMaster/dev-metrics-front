import { EmployeeBrief } from '../api/employees';
import AchievementBadges from './AchievementBadges';
import EmployeeTags, { buildEmployeeTags } from './EmployeeTags';
import { cn } from '@/lib/utils';

interface Props {
  employee: EmployeeBrief;
  onClick: () => void;
}

export default function EmployeeCard({ employee, onClick }: Props) {
  const tags = buildEmployeeTags(employee);

  return (
    <button
      onClick={onClick}
      className={cn(
        'min-w-0 rounded-xl bg-card p-4 text-left text-sm ring-1 ring-foreground/10 transition hover:ring-foreground/25 focus-visible:ring-3 focus-visible:ring-ring/50 outline-none',
        !employee.isActive && 'opacity-60'
      )}
    >
      <p className="truncate font-medium">{employee.fullName}</p>
      <p className="truncate text-muted-foreground">{employee.gitEmail}</p>

      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <EmployeeTags tags={tags} />
        </div>
      )}

      <AchievementBadges achievements={employee.achievements} />
    </button>
  );
}
