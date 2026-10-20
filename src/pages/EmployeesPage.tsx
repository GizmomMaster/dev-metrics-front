import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getEmployees, PositionType } from '../api/employees';
import EmployeeCard from '../components/EmployeeCard';
import { POSITION_LABELS } from '../components/EmployeeTags';
import EmployeeList from '../components/EmployeeList';
import EmptyState from '../components/EmptyState';
import QueryError from '../components/QueryError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, LayoutGrid, List } from 'lucide-react';

// Выше этого порога (после поиска и фильтров) список компактнее карточной
// сетки для сканирования — переключаемся автоматически, пока пользователь не
// выбрал вид вручную (viewMode !== null ниже).
const LIST_VIEW_THRESHOLD = 30;

const ALL_POSITIONS = Object.keys(POSITION_LABELS) as PositionType[];

// Ручной выбор вида переживает переход на другую страницу и обратно (и
// перезагрузку страницы) — иначе он сбрасывался бы в auto при каждом
// размонтировании EmployeesPage, что и есть баг, который эта персистентность чинит.
const VIEW_MODE_KEY = 'devmetrics:employees-view-mode';

function readStoredViewMode(): 'cards' | 'list' | null {
  const stored = localStorage.getItem(VIEW_MODE_KEY);
  return stored === 'cards' || stored === 'list' ? stored : null;
}

export default function EmployeesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [activePositions, setActivePositions] = useState<Set<PositionType>>(new Set());
  const [viewMode, setViewModeState] = useState<'cards' | 'list' | null>(readStoredViewMode);

  const setViewMode = (mode: 'cards' | 'list') => {
    setViewModeState(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  const { data: employees = [], isLoading, isLoadingError, refetch } = useQuery({
    queryKey: ['employees', includeInactive],
    queryFn: () => getEmployees(includeInactive),
  });

  const togglePosition = (position: PositionType) => {
    setActivePositions((prev) => {
      const next = new Set(prev);
      if (next.has(position)) next.delete(position);
      else next.add(position);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter((e) => {
      const matchesSearch = !q || e.fullName.toLowerCase().includes(q) || e.gitEmail.toLowerCase().includes(q);
      // Пустой набор фильтров = фильтр не используется, показываем всех.
      // Несколько активных должностей комбинируются через ИЛИ.
      const matchesPosition = activePositions.size === 0 || activePositions.has(e.position);
      return matchesSearch && matchesPosition;
    });
  }, [employees, search, activePositions]);

  // Порог считаем от уже отфильтрованного списка, а не от employees целиком —
  // иначе результат "нашли 5 из 150" всё равно листался бы как список.
  const effectiveViewMode = viewMode ?? (filtered.length > LIST_VIEW_THRESHOLD ? 'list' : 'cards');

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Сотрудники</h1>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени или email"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="inactive" checked={includeInactive} onCheckedChange={setIncludeInactive} />
          <Label htmlFor="inactive">Показать неактивных</Label>
        </div>
        <Tabs
          className="ml-auto"
          value={effectiveViewMode}
          onValueChange={(v) => setViewMode(v as 'cards' | 'list')}
        >
          <TabsList>
            <TabsTrigger value="cards" title="Карточки" aria-label="Карточки">
              <LayoutGrid />
            </TabsTrigger>
            <TabsTrigger value="list" title="Список" aria-label="Список">
              <List />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-wrap gap-2">
        {ALL_POSITIONS.map((position) => {
          const active = activePositions.has(position);
          return (
            <Button
              key={position}
              type="button"
              size="sm"
              variant={active ? 'default' : 'outline'}
              onClick={() => togglePosition(position)}
              aria-pressed={active}
              className="rounded-full"
            >
              {POSITION_LABELS[position]}
            </Button>
          );
        })}
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : isLoadingError ? (
        <QueryError title="Не удалось загрузить список сотрудников" onRetry={() => void refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState>Сотрудники не найдены</EmptyState>
      ) : effectiveViewMode === 'list' ? (
        <EmployeeList employees={filtered} onSelect={(id) => navigate(`/activity/${id}`)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((employee) => (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              onClick={() => navigate(`/activity/${employee.id}`)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
