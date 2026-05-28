import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../hooks/useAppContext';
import { usePortfolioMetrics } from '../hooks/usePortfolioMetrics';
import { getEffectivePrice, useStockQuotes } from '../hooks/useStockQuotes';
import type { StockImportPayload } from '../types';
import { positionToStockImport, watchToStockImport } from '../utils/stockBridge';
import { formatMoney } from '../utils/format';

interface StockImportBarProps {
  onImport: (payload: StockImportPayload) => void;
  /** 带入后建议跳转的 Tab 提示 */
  hint?: string;
}

export default function StockImportBar({ onImport, hint }: StockImportBarProps) {
  const { data } = useAppContext();
  const { positions, watchPool } = usePortfolioMetrics();

  const codes = useMemo(
    () => [...new Set([...positions.map((p) => p.code), ...watchPool.map((w) => w.code)])],
    [positions, watchPool],
  );
  const { quotes } = useStockQuotes(codes, data.settings.refreshIntervalSec);

  if (positions.length === 0 && watchPool.length === 0) {
    return (
      <div className="card text-sm text-muted">
        暂无持仓或观察标的。
        <Link to="/home" className="ml-1 text-blue-600 underline">去添加持仓</Link>
        或
        <Link to="/watch" className="ml-1 text-blue-600 underline">建观察池</Link>
      </div>
    );
  }

  return (
    <div className="card flex flex-wrap items-end gap-3">
      <div className="min-w-[240px] flex-1">
        <label className="label">从持仓 / 观察池一键带入</label>
        <select
          className="input"
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            const [kind, id] = v.split(':');
            if (kind === 'pos') {
              const p = positions.find((x) => x.id === id);
              if (p) onImport(positionToStockImport(p));
            } else if (kind === 'watch') {
              const w = watchPool.find((x) => x.id === id);
              if (w) {
                const { price } = getEffectivePrice(w.code, quotes, undefined);
                onImport(watchToStockImport(w, price, data.settings));
              }
            }
            e.target.value = '';
          }}
        >
          <option value="" disabled>
            选择股票…
          </option>
          {positions.length > 0 && (
            <optgroup label="持仓">
              {positions.map((p) => (
                <option key={p.id} value={`pos:${p.id}`}>
                  {p.name} ({p.code}) · 成本 ¥{formatMoney(p.costPrice)} × {p.shares}
                </option>
              ))}
            </optgroup>
          )}
          {watchPool.length > 0 && (
            <optgroup label="观察池">
              {watchPool.map((w) => {
                const { price } = getEffectivePrice(w.code, quotes, undefined);
                return (
                  <option key={w.id} value={`watch:${w.id}`}>
                    {w.name} ({w.code}) · 触发 ¥{formatMoney(w.triggerPrice)}
                    {price > 0 ? ` · 现 ¥${formatMoney(price)}` : ''}
                  </option>
                );
              })}
            </optgroup>
          )}
        </select>
      </div>
      <p className="pb-2 text-xs text-muted">
        {hint ?? '带入价格、股数、板块；观察池另含 EV 参数与触发价'}
      </p>
    </div>
  );
}
