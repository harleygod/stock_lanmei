import { useMemo } from 'react';
import { usePortfolio } from './usePortfolio';
import { getEffectivePrice, useStockQuotes } from './useStockQuotes';

/** 可复用的组合级指标键 */
export type PortfolioMetricKey =
  | 'totalAssets'
  | 'cashBalance'
  | 'stockMarketValue'
  | 'positionMarketValue'
  | 'custom';

export const PORTFOLIO_METRIC_OPTIONS: { key: PortfolioMetricKey; label: string }[] = [
  { key: 'totalAssets', label: '总资产（市值+余额）' },
  { key: 'cashBalance', label: '可用余额' },
  { key: 'stockMarketValue', label: '持仓总市值' },
  { key: 'positionMarketValue', label: '当前选中持仓市值' },
  { key: 'custom', label: '自定义金额' },
];

/**
 * 组合指标单一数据源 — 主页、计算器、机会成本、单股详情共用
 */
export function usePortfolioMetrics(positionId?: string) {
  const { data, positions, cashBalance, portfolio } = usePortfolio();
  const codes = positions.map((p) => p.code);
  const { quotes } = useStockQuotes(codes, data.settings.refreshIntervalSec);

  const stockMarketValue = useMemo(
    () =>
      positions.reduce((sum, p) => {
        const { price } = getEffectivePrice(p.code, quotes, p.manualPrice);
        return sum + price * p.shares;
      }, 0),
    [positions, quotes],
  );

  const totalAssets = stockMarketValue + cashBalance;
  const watchPool = portfolio.watchPool ?? [];

  const getPositionMarketValue = (id?: string) => {
    const pid = id ?? positionId;
    if (!pid) return 0;
    const p = positions.find((x) => x.id === pid);
    if (!p) return 0;
    const { price } = getEffectivePrice(p.code, quotes, p.manualPrice);
    return price * p.shares;
  };

  const getMetricValue = (key: PortfolioMetricKey, customValue = 0, forPositionId?: string): number => {
    switch (key) {
      case 'totalAssets':
        return totalAssets;
      case 'cashBalance':
        return cashBalance;
      case 'stockMarketValue':
        return stockMarketValue;
      case 'positionMarketValue':
        return getPositionMarketValue(forPositionId);
      case 'custom':
        return customValue;
      default:
        return totalAssets;
    }
  };

  return {
    totalAssets,
    stockMarketValue,
    cashBalance,
    quotes,
    positions,
    watchPool,
    getMetricValue,
    getPositionMarketValue,
  };
}
