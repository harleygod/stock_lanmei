export function formatMoney(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPct(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—';
  if (n === Infinity) return '∞';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)}%`;
}

export function formatPrice(n: number): string {
  return formatMoney(n, 2);
}

export function pnlColor(n: number): string {
  if (n > 0) return 'text-profit';
  if (n < 0) return 'text-loss';
  return 'text-muted';
}

export function uid(): string {
  // crypto.randomUUID() requires secure context (HTTPS/localhost)
  // Use manual UUID v4 for HTTP compatibility
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
