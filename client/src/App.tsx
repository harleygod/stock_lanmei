import { Link, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { useAppData } from './hooks/useAppData';
import DisclaimerFooter from './components/DisclaimerFooter';
import PortfolioSelector from './components/PortfolioSelector';
import { isPendingReady } from './utils/migrate';
import HomePage from './pages/HomePage';
import CalculatorPage from './pages/CalculatorPage';
import PositionPage from './pages/PositionPage';
import LogsPage from './pages/LogsPage';
import SettingsPage from './pages/SettingsPage';

function Layout() {
  const { data, update } = useAppData();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', data.settings.theme === 'dark');
  }, [data.settings.theme]);

  const toggleTheme = () => {
    update((d) => ({
      ...d,
      settings: { ...d.settings, theme: d.settings.theme === 'dark' ? 'light' : 'dark' },
    }));
  };

  const pendingReady = useMemo(
    () =>
      data.pendingOps.filter(
        (op) => op.portfolioId === data.activePortfolioId && isPendingReady(op),
      ).length,
    [data.pendingOps, data.activePortfolioId],
  );

  const nav = [
    { to: '/', label: '持仓' },
    { to: '/calculator', label: '计算器' },
    { to: '/logs', label: '日志', badge: pendingReady },
    { to: '/settings', label: '设置' },
  ];

  return (
    <div className="min-h-screen pb-20 md:pb-4">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-bold text-blue-600">
            决策助手
          </Link>
          <nav className="hidden gap-4 md:flex">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  isActive ? 'text-blue-600 font-medium' : 'text-muted hover:text-text'
                }
              >
                {n.label}
                {'badge' in n && n.badge ? (
                  <span className="ml-1 rounded-full bg-warn px-1.5 text-xs text-white">{n.badge}</span>
                ) : null}
              </NavLink>
            ))}
          </nav>
          <PortfolioSelector />
          <button type="button" onClick={toggleTheme} className="btn-ghost text-xs">
            {data.settings.theme === 'dark' ? '浅色' : '深色'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">
        <Outlet context={{ data, update }} />
      </main>

      <DisclaimerFooter />

      <nav className="fixed bottom-0 left-0 right-0 flex border-t border-border bg-surface md:hidden">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) =>
              `flex-1 py-3 text-center text-xs ${isActive ? 'text-blue-600 font-medium' : 'text-muted'}`
            }
          >
            <span className="relative inline-block">
              {n.label}
              {'badge' in n && n.badge ? (
                <span className="absolute -right-2 -top-1 h-2 w-2 rounded-full bg-warn" />
              ) : null}
            </span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="calculator" element={<CalculatorPage />} />
        <Route path="position/:id" element={<PositionPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export type AppContext = ReturnType<typeof useAppData>;
