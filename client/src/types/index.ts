export type Market =
  | 'sh'
  | 'sz'
  | 'bj';

export type Board =
  | 'sh_main'
  | 'sz_main'
  | 'gem'
  | 'star'
  | 'bse';

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

export interface AppSettings extends FeeSettings {
  theme: 'light' | 'dark';
  refreshIntervalSec: number;
}

export interface AppData {
  version: 1;
  positions: Position[];
  logs: TradeLog[];
  settings: AppSettings;
}

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
  source: 'sina' | 'tencent' | 'manual';
  updatedAt: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  commissionRate: 0.0001154,
  minCommission: false,
  stampTaxRate: 0.001,
  theme: 'light',
  refreshIntervalSec: 15,
};

export const DEFAULT_DATA: AppData = {
  version: 1,
  positions: [],
  logs: [],
  settings: DEFAULT_SETTINGS,
};
