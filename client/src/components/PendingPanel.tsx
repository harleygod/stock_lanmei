import { useMemo } from 'react';
import { usePortfolio } from '../hooks/usePortfolio';
import { formatCountdown, isPendingReady } from '../utils/migrate';
import { formatMoney, uid } from '../utils/format';
import type { PendingOperation, TradeLog } from '../types';

const ACTION_LABEL: Record<TradeLog['action'], string> = {
  buy: '买入',
  sell: '卖出',
  add: '加仓',
  reduce: '减仓',
};

export default function PendingPanel() {
  const { data, portfolio, pendingOps, update, updatePortfolio } = usePortfolio();

  const mine = useMemo(
    () => pendingOps.filter((op) => op.portfolioId === portfolio.id),
    [pendingOps, portfolio.id],
  );

  const readyCount = mine.filter(isPendingReady).length;

  const confirmOp = (op: PendingOperation) => {
    if (!isPendingReady(op)) return;
    const log: TradeLog = {
      id: uid(),
      date: op.date,
      stockName: op.stockName,
      stockCode: op.stockCode,
      action: op.action,
      price: op.price,
      quantity: op.quantity,
      fee: op.fee,
      reason: op.reason,
      createdAt: new Date().toISOString(),
    };
    updatePortfolio((p) => ({ ...p, logs: [log, ...p.logs] }));
    update((d) => ({ ...d, pendingOps: d.pendingOps.filter((x) => x.id !== op.id) }));
  };

  const cancelOp = (id: string) => {
    if (!confirm('取消该待确认操作？')) return;
    update((d) => ({ ...d, pendingOps: d.pendingOps.filter((x) => x.id !== id) }));
  };

  if (mine.length === 0) {
    return (
      <div className="card text-center text-muted py-8">
        暂无待确认操作。提交卖出/减仓时可勾选「冷静 {data.settings.cooldownHours} 小时」
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {readyCount > 0 && (
        <div className="rounded-lg border border-profit/40 bg-green-50 px-3 py-2 text-sm text-profit dark:bg-green-950/30">
          有 {readyCount} 笔操作已过冷静期，可以确认执行
        </div>
      )}
      {mine.map((op) => {
        const ready = isPendingReady(op);
        return (
          <div key={op.id} className="card text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-medium">{op.stockName}</span>
                <span className="ml-2 text-muted">{op.stockCode}</span>
                <span className="ml-2 rounded bg-surface-2 px-2 py-0.5 text-xs">{ACTION_LABEL[op.action]}</span>
              </div>
              <span className={`text-xs font-medium ${ready ? 'text-profit' : 'text-warn'}`}>
                {formatCountdown(op.availableAt)}
              </span>
            </div>
            <div className="mt-1 text-muted">
              {op.date} · ¥{formatMoney(op.price)} × {op.quantity}
            </div>
            <p className="mt-2 border-l-2 border-blue-500 pl-2 italic">{op.reason}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={!ready}
                onClick={() => confirmOp(op)}
                className={`btn-primary text-xs ${!ready ? 'opacity-40' : ''}`}
              >
                确认执行
              </button>
              <button type="button" onClick={() => cancelOp(op.id)} className="btn-ghost text-xs">
                取消
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function usePendingBadgeCount() {
  const { portfolio, pendingOps } = usePortfolio();
  return pendingOps.filter((op) => op.portfolioId === portfolio.id && isPendingReady(op)).length;
}
