import { useMemo } from 'react';
import { useAppContext } from './useAppContext';
import { getActivePortfolio, updateActivePortfolio } from '../utils/migrate';
import type { Portfolio, WatchItem } from '../types';
import { MAX_WATCH_POOL } from '../utils/constants';
import {
  createWatchItem,
  isCodeInWatchPool,
  positionToWatchDraft,
} from '../utils/stockBridge';
import { getEffectivePrice } from './useStockQuotes';

export function usePortfolio() {
  const { data, update } = useAppContext();

  const portfolio = useMemo(() => getActivePortfolio(data), [data]);

  const updatePortfolio = (fn: (p: Portfolio) => Portfolio) => {
    update((d) => updateActivePortfolio(d, fn));
  };

  const switchPortfolio = (id: string) => {
    update((d) => ({ ...d, activePortfolioId: id }));
  };

  const addToWatchPool = (draft: Omit<WatchItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    updatePortfolio((p) => {
      const pool = p.watchPool ?? [];
      if (pool.length >= MAX_WATCH_POOL) return p;
      if (isCodeInWatchPool(pool, draft.code)) return p;
      return { ...p, watchPool: [...pool, createWatchItem(draft)] };
    });
  };

  const addPositionToWatchPool = (
    positionId: string,
    quotes: Record<string, { price: number }>,
  ): 'ok' | 'full' | 'duplicate' | 'missing' => {
    const pos = portfolio.positions.find((x) => x.id === positionId);
    if (!pos) return 'missing';
    const pool = portfolio.watchPool ?? [];
    if (pool.length >= MAX_WATCH_POOL) return 'full';
    if (isCodeInWatchPool(pool, pos.code)) return 'duplicate';
    const { price } = getEffectivePrice(pos.code, quotes, pos.manualPrice);
    addToWatchPool(positionToWatchDraft(pos, price));
    return 'ok';
  };

  return {
    data,
    update,
    portfolio,
    positions: portfolio.positions,
    logs: portfolio.logs,
    cashBalance: portfolio.cashBalance ?? 0,
    watchPool: portfolio.watchPool ?? [],
    portfolios: data.portfolios,
    activePortfolioId: data.activePortfolioId,
    pendingOps: data.pendingOps,
    updatePortfolio,
    switchPortfolio,
    setCashBalance: (amount: number) => {
      updatePortfolio((p) => ({ ...p, cashBalance: Math.max(0, amount) }));
    },
    addToWatchPool,
    addPositionToWatchPool,
    isInWatchPool: (code: string) => isCodeInWatchPool(portfolio.watchPool ?? [], code),
  };
}
