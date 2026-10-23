import { NavLink, Link, Outlet } from 'react-router-dom';
import { LogOut, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { to: '/', label: 'Сотрудники', end: true },
  { to: '/hall-of-fame', label: 'Зал достижений', end: false },
  { to: '/alarms', label: 'Alarms', end: false },
];

// Шапка и контейнер страницы — по образцу AdminLayout из ReviewPlatform.
export default function AppLayout() {
  const { logout } = useAuth();

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-svh bg-muted/40">
        <header className="border-b bg-background">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 md:h-14 md:flex-nowrap md:py-0">
            <Link to="/" className="mr-auto font-semibold whitespace-nowrap md:mr-0">
              DevMetrics
            </Link>
            <nav className="order-last flex w-full gap-4 overflow-x-auto pb-1 text-sm md:order-none md:w-auto md:flex-1 md:pb-0">
              {NAV_LINKS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn('whitespace-nowrap text-muted-foreground hover:text-foreground', isActive && 'font-medium text-foreground')
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" asChild>
                    <NavLink to="/settings" aria-label="Настройки сервиса" className={({ isActive }) => cn(isActive && 'bg-muted')}>
                      <Settings />
                    </NavLink>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Настройки сервиса</TooltipContent>
              </Tooltip>
              <Button variant="ghost" size="sm" onClick={() => void logout()}>
                <LogOut /> Выйти
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">
          <Outlet />
        </main>
      </div>
    </TooltipProvider>
  );
}
