import { useMemo } from 'react';
import { useAppContext } from './useAppContext';
import { getActivePortfolio, updateActivePortfolio } from '../utils/migrate';
import type { Portfolio } from '../types';

export function usePortfolio() {
  const { data, update } = useAppContext();

  const portfolio = useMemo(() => getActivePortfolio(data), [data]);

  const updatePortfolio = (fn: (p: Portfolio) => Portfolio) => {
    update((d) => updateActivePortfolio(d, fn));
  };

  const switchPortfolio = (id: string) => {
    update((d) => ({ ...d, activePortfolioId: id }));
  };

  return {
    data,
    update,
    portfolio,
    positions: portfolio.positions,
    logs: portfolio.logs,
    portfolios: data.portfolios,
    activePortfolioId: data.activePortfolioId,
    pendingOps: data.pendingOps,
    updatePortfolio,
    switchPortfolio,
  };
}
