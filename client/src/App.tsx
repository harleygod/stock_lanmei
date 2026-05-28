import { Outlet, Route, Routes, NavLink, Navigate } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { useAppData } from './hooks/useAppData';
import DisclaimerFooter from './components/DisclaimerFooter';
import { isPendingReady } from './utils/migrate';
import HomePage from './pages/HomePage';
import CalculatorPage from './pages/CalculatorPage';
import PositionPage from './pages/PositionPage';
import LogsPage from './pages/LogsPage';
import SettingsPage from './pages/SettingsPage';
import GuidePage from './pages/GuidePage';
import WatchPoolPage from './pages/WatchPoolPage';

type NavItem = { to: string; label: string; end?: boolean; showBadge?: boolean };

const NAV_ITEMS: NavItem[] = [
  { to: '/home', label: '持仓', end: true },
  { to: '/watch', label: '观察池' },
  { to: '/calculator', label: '计算器' },
  { to: '/guide', label: '说明' },
  { to: '/logs', label: '日志', showBadge: true },
  { to: '/settings', label: '设置' },
];

function navClassName({ isActive }: { isActive: boolean }) {
  return isActive ? 'text-blue-600 font-medium' : 'text-muted hover:text-text';
}

function mobileNavClassName({ isActive }: { isActive: boolean }) {
  return `flex-1 py-3 text-center text-xs ${isActive ? 'text-blue-600 font-medium' : 'text-muted'}`;
}

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

  return (
    <div className="min-h-screen pb-20 md:pb-4">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <NavLink
            to="/home"
            end
            className="text-lg font-bold text-blue-600"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'none' }}
          >
            决策助手
          </NavLink>
          <nav className="hidden gap-4 md:flex">
            {NAV_ITEMS.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end ?? false}
                className={navClassName}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', textDecoration: 'none' }}
              >
                {n.label}
                {n.showBadge && pendingReady > 0 ? (
                  <span className="ml-1 rounded-full bg-warn px-1.5 text-xs text-white">{pendingReady}</span>
                ) : null}
              </NavLink>
            ))}
          </nav>
          {data.portfolios.length <= 1 ? (
            <span className="hidden text-xs text-muted md:inline">
              {data.portfolios[0]?.name ?? '默认组合'}
            </span>
          ) : (
            <select
              className="hidden max-w-[120px] rounded border border-border bg-surface px-2 py-1 text-xs md:inline"
              value={data.activePortfolioId}
              onChange={(e) => update((d) => ({ ...d, activePortfolioId: e.target.value }))}
            >
              {data.portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <button type="button" onClick={toggleTheme} className="btn-ghost text-xs">
            {data.settings.theme === 'dark' ? '浅色' : '深色'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">
        <Outlet context={{ data, update }} />
      </main>

      <DisclaimerFooter />

      <nav className="fixed bottom-0 left-0 right-0 flex border-t border-border bg-surface md:hidden z-50" style={{ touchAction: 'manipulation' }}>
        {NAV_ITEMS.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end ?? false}
            className={mobileNavClassName}
            style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'none' }}
          >
            <span className="relative inline-block">
              {n.label}
              {n.showBadge && pendingReady > 0 ? (
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
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="home" element={<HomePage />} />
        <Route path="watch" element={<WatchPoolPage />} />
        <Route path="calculator" element={<CalculatorPage />} />
        <Route path="position/:id" element={<PositionPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="guide" element={<GuidePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export type AppContext = ReturnType<typeof useAppData>;
