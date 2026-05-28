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
  return crypto.randomUUID();
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
