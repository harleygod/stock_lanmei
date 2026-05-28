import { usePortfolioMetrics } from './usePortfolioMetrics';

/** @deprecated 请优先使用 usePortfolioMetrics */
export function usePortfolioTotals() {
  const m = usePortfolioMetrics();
  return {
    stockMarketValue: m.stockMarketValue,
    cashBalance: m.cashBalance,
    totalAssets: m.totalAssets,
  };
}
