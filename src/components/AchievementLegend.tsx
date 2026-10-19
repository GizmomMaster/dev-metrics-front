import { useState } from 'react';
import { Award, ChevronDown, ChevronUp } from 'lucide-react';
import type { AchievementCatalogEntry } from '../api/achievements';
import { ICON_MAP } from './AchievementBadges';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  catalog: AchievementCatalogEntry[];
}

export default function AchievementLegend({ catalog }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  if (catalog.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Легенда</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={() => setCollapsed((v) => !v)}>
            {collapsed ? <ChevronDown /> : <ChevronUp />}
            {collapsed ? 'Показать' : 'Скрыть'}
          </Button>
        </CardAction>
      </CardHeader>

      {!collapsed && (
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.map((achievement) => {
              const Icon = ICON_MAP[achievement.iconKey] ?? Award;
              return (
                <div key={achievement.code} className="flex items-start gap-3">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium">{achievement.name}</div>
                    <div className="text-xs text-muted-foreground">{achievement.description}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Общая сноска — раньше дублировалась в каждом Achievement.Description
              на бэкенде, вынесена сюда одним предложением на всю легенду. */}
          <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">*Топ-5 — при равенстве все с таким результатом.</p>
        </CardContent>
      )}
    </Card>
  );
}
