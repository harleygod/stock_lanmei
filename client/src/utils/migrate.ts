import type { AppDataV2, AppSettings, Portfolio, Position, TradeLog } from '../types';
import { DEFAULT_DATA, DEFAULT_SETTINGS, createDefaultPortfolio } from '../types';

interface LegacyV1 {
  version?: number;
  positions?: Position[];
  logs?: TradeLog[];
  portfolios?: Portfolio[];
  activePortfolioId?: string;
  pendingOps?: AppDataV2['pendingOps'];
  settings?: Partial<AppSettings>;
}

export function migrateData(raw: LegacyV1): AppDataV2 {
  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...raw.settings,
  };

  if (raw.version === 2 && raw.portfolios?.length) {
    return {
      version: 2,
      portfolios: raw.portfolios.map((p) => ({
        ...p,
        cashBalance: p.cashBalance ?? 0,
        watchPool: p.watchPool ?? [],
      })),
      activePortfolioId: raw.activePortfolioId ?? raw.portfolios[0].id,
      pendingOps: raw.pendingOps ?? [],
      settings,
    };
  }

  const portfolio = createDefaultPortfolio('默认组合');
  portfolio.positions = raw.positions ?? [];
  portfolio.logs = raw.logs ?? [];

  return {
    version: 2,
    portfolios: [portfolio],
    activePortfolioId: portfolio.id,
    pendingOps: raw.pendingOps ?? [],
    settings,
  };
}

export function loadData(): AppDataV2 {
  const keys = ['stock-decision-assistant-v2', 'stock-decision-assistant-v1'];
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as LegacyV1;
      return migrateData(parsed);
    } catch {
      continue;
    }
  }
  return structuredClone(DEFAULT_DATA);
}

export function saveData(data: AppDataV2) {
  localStorage.setItem('stock-decision-assistant-v2', JSON.stringify(data));
}

export function getActivePortfolio(data: AppDataV2): Portfolio {
  return (
    data.portfolios.find((p) => p.id === data.activePortfolioId) ??
    data.portfolios[0] ??
    createDefaultPortfolio()
  );
}

export function updateActivePortfolio(
  data: AppDataV2,
  fn: (p: Portfolio) => Portfolio,
): AppDataV2 {
  const id = data.activePortfolioId;
  return {
    ...data,
    portfolios: data.portfolios.map((p) => (p.id === id ? fn(p) : p)),
  };
}

export function isPendingReady(op: { availableAt: string }): boolean {
  return new Date(op.availableAt).getTime() <= Date.now();
}

export function formatCountdown(availableAt: string): string {
  const diff = new Date(availableAt).getTime() - Date.now();
  if (diff <= 0) return '可确认';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}小时${m}分`;
}
