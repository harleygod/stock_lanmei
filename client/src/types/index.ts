export type Market = 'sh' | 'sz' | 'bj';

export type Board = 'sh_main' | 'sz_main' | 'gem' | 'star' | 'bse';

export interface FeeSettings {
  commissionRate: number;
  minCommission: boolean;
  stampTaxRate: number;
}

export interface Position {
  id: string;
  name: string;
  code: string;
  costPrice: number;
  shares: number;
  board: Board;
  manualPrice?: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TradeLog {
  id: string;
  date: string;
  stockName: string;
  stockCode: string;
  action: 'buy' | 'sell' | 'add' | 'reduce';
  price: number;
  quantity: number;
  fee?: number;
  reason: string;
  createdAt: string;
}

export interface PendingOperation {
  id: string;
  portfolioId: string;
  date: string;
  stockName: string;
  stockCode: string;
  action: TradeLog['action'];
  price: number;
  quantity: number;
  fee?: number;
  reason: string;
  createdAt: string;
  availableAt: string;
}

export interface Portfolio {
  id: string;
  name: string;
  positions: Position[];
  logs: TradeLog[];
  /** 账户可用现金余额（元），参与仓位占比与总资产计算 */
  cashBalance: number;
  createdAt: string;
}

export interface AppSettings extends FeeSettings {
  theme: 'light' | 'dark';
  refreshIntervalSec: number;
  cooldownHours: number;
  cooldownEnabled: boolean;
}

export interface AppDataV2 {
  version: 2;
  portfolios: Portfolio[];
  activePortfolioId: string;
  pendingOps: PendingOperation[];
  settings: AppSettings;
}

/** @deprecated v1 结构，仅用于迁移 */
export interface AppDataV1 {
  version: 1;
  positions: Position[];
  logs: TradeLog[];
  settings: AppSettings;
}

export type AppData = AppDataV2;

export interface StockQuote {
  code: string;
  name: string;
  price: number;
  prevClose: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  isClosed: boolean;
  source: 'sina' | 'tencent' | 'eastmoney' | 'manual';
  updatedAt: string;
}

export interface PositionImportPayload {
  id: string;
  name: string;
  code: string;
  price: number;
  shares: number;
  board: Board;
}

export const DEFAULT_SETTINGS: AppSettings = {
  commissionRate: 0.0001154,
  minCommission: true,
  stampTaxRate: 0.001,
  theme: 'light',
  refreshIntervalSec: 15,
  cooldownHours: 24,
  cooldownEnabled: true,
};

export function createDefaultPortfolio(name = '默认组合'): Portfolio {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    positions: [],
    logs: [],
    cashBalance: 0,
    createdAt: now,
  };
}

export const DEFAULT_DATA: AppDataV2 = {
  version: 2,
  portfolios: [createDefaultPortfolio()],
  activePortfolioId: '',
  pendingOps: [],
  settings: DEFAULT_SETTINGS,
};

DEFAULT_DATA.activePortfolioId = DEFAULT_DATA.portfolios[0].id;
