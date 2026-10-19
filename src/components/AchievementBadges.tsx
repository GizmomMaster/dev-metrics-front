import { Bot, Bug, ShieldCheck, Users, Flame, Swords, Award, type LucideIcon } from 'lucide-react';
import type { Achievement } from '../api/employees';

interface Props {
  achievements: Achievement[] | undefined;
  size?: 'sm' | 'lg';
  // Название рядом с иконкой вместо тултипа по наведению (страница Активности).
  showLabel?: boolean;
  // Обёртка по умолчанию рассчитана на размещение под блоком тегов (EmployeeCard/
  // ActivityPage) — отступ сверху лишний в строчном контексте (HallOfFamePage).
  className?: string;
}

// Ключ — Achievement.iconKey с бэкенда (см. ApplicationDbContext.OnModelCreating
// HasData-сид справочника achievements). Award — запасной вариант на случай
// незнакомого ключа, чтобы бэкенд мог завести новую ачивку без правки фронта.
// Экспортируется — переиспользуется AchievementLegend.tsx, чтобы не дублировать словарь.
export const ICON_MAP: Record<string, LucideIcon> = {
  Bot,
  Bug,
  ShieldCheck,
  Users,
  Flame,
  Swords,
};

const SIZE_CLASSES = {
  sm: { badge: 'w-6 h-6', icon: 'w-3.5 h-3.5' },
  lg: { badge: 'w-9 h-9', icon: 'w-5 h-5' },
};

export default function AchievementBadges({ achievements, size = 'sm', showLabel = false, className = 'mt-2' }: Props) {
  // achievements может отсутствовать в ответе бэкенда, если он собран/запущен
  // до фичи achievements (старый процесс без рестарта) — не роняем страницу.
  if (!achievements || achievements.length === 0) return null;

  const { badge, icon } = SIZE_CLASSES[size];

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {achievements.map((achievement) => {
        const Icon = ICON_MAP[achievement.iconKey] ?? Award;
        return (
          <div key={achievement.code} className="inline-flex items-center gap-1.5">
            <span
              title={showLabel ? undefined : achievement.name}
              className={`inline-flex items-center justify-center shrink-0 ${badge} rounded-full bg-amber-100 text-amber-700`}
            >
              <Icon className={icon} />
            </span>
            {showLabel && <span className="text-sm font-medium">{achievement.name}</span>}
          </div>
        );
      })}
    </div>
  );
}
