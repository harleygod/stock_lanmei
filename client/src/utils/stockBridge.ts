import type { Position, StockImportPayload, WatchItem, FeeSettings } from '../types';
import { DEFAULT_MAX_BUY_AMOUNT } from './constants';
import { watchPoolAnalysis } from './calculations';
import { uid } from './format';

export function positionToStockImport(p: Position): StockImportPayload {
  return {
    source: 'position',
    id: p.id,
    name: p.name,
    code: p.code,
    price: p.costPrice,
    shares: p.shares,
    board: p.board,
    reason: p.note,
  };
}

export function watchToStockImport(
  w: WatchItem,
  currentPrice: number,
  settings: FeeSettings,
): StockImportPayload {
  const price = currentPrice > 0 ? currentPrice : w.triggerPrice;
  const analysis = watchPoolAnalysis(w, price, w.board, settings);
  const shares =
    analysis.suggestedShares ??
    Math.max(100, Math.floor(w.maxBuyAmount / Math.max(price, 0.01) / 100) * 100);

  return {
    source: 'watch',
    id: w.id,
    name: w.name,
    code: w.code,
    price,
    shares,
    board: w.board,
    triggerPrice: w.triggerPrice,
    winProb: w.winProb,
    gainPct: w.gainPct,
    lossPct: w.lossPct,
    maxBuyAmount: w.maxBuyAmount,
    reason: w.reason,
  };
}

/** 持仓 → 观察池草稿（新建条目） */
export function positionToWatchDraft(p: Position, currentPrice = 0): Omit<WatchItem, 'id' | 'createdAt' | 'updatedAt'> {
  const trigger =
    currentPrice > 0 ? Math.round(Math.min(p.costPrice, currentPrice) * 100) / 100 : p.costPrice;
  return {
    name: p.name,
    code: p.code,
    board: p.board,
    reason: p.note?.trim() || `从持仓添加，成本 ¥${p.costPrice.toFixed(2)}`,
    triggerPrice: trigger,
    winProb: 55,
    gainPct: 15,
    lossPct: 8,
    maxBuyAmount: DEFAULT_MAX_BUY_AMOUNT,
  };
}

export function createWatchItem(
  draft: Omit<WatchItem, 'id' | 'createdAt' | 'updatedAt'>,
): WatchItem {
  const now = new Date().toISOString();
  return { ...draft, id: uid(), createdAt: now, updatedAt: now };
}

export function isCodeInWatchPool(pool: WatchItem[], code: string): boolean {
  const norm = code.replace(/\D/g, '');
  return pool.some((w) => w.code.replace(/\D/g, '') === norm);
}
