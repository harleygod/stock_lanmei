import type { Board, Market } from '../types';

export function inferMarket(code: string): Market {
  const c = code.replace(/\D/g, '');
  if (c.startsWith('688') || c.startsWith('689') || c.startsWith('6')) return 'sh';
  if (c.startsWith('8') || c.startsWith('4')) return 'bj';
  return 'sz';
}

export function inferBoard(code: string): Board {
  const c = code.replace(/\D/g, '');
  if (c.startsWith('688') || c.startsWith('689')) return 'star';
  if (c.startsWith('6')) return 'sh_main';
  if (c.startsWith('3')) return 'gem';
  if (c.startsWith('8') || c.startsWith('4')) return 'bse';
  return 'sz_main';
}

export function toQuoteSymbol(code: string): string {
  const c = code.replace(/\D/g, '');
  return `${inferMarket(c)}${c}`;
}

export function boardLabel(board: Board): string {
  const map: Record<Board, string> = {
    sh_main: '沪市主板',
    sz_main: '深市主板',
    gem: '创业板',
    star: '科创板',
    bse: '北交所',
  };
  return map[board];
}

export function isShanghai(board: Board): boolean {
  return board === 'sh_main' || board === 'star';
}

export function isTradingHours(now = new Date()): boolean {
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  const morning = mins >= 9 * 60 + 30 && mins <= 11 * 60 + 30;
  const afternoon = mins >= 13 * 60 && mins <= 15 * 60;
  return morning || afternoon;
}
