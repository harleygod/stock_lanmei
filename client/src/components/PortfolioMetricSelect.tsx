import { useEffect } from 'react';
import {
  PORTFOLIO_METRIC_OPTIONS,
  usePortfolioMetrics,
  type PortfolioMetricKey,
} from '../hooks/usePortfolioMetrics';
import { formatMoney } from '../utils/format';

interface PortfolioMetricSelectProps {
  label?: string;
  metricKey: PortfolioMetricKey;
  onMetricKeyChange: (key: PortfolioMetricKey) => void;
  customValue: number;
  onCustomValueChange: (v: number) => void;
  /** 解析后的数值（自动同步给父组件） */
  onResolvedChange: (v: number) => void;
  positionId?: string;
  allowedKeys?: PortfolioMetricKey[];
  hint?: string;
}

export default function PortfolioMetricSelect({
  label = '资金基准',
  metricKey,
  onMetricKeyChange,
  customValue,
  onCustomValueChange,
  onResolvedChange,
  positionId,
  allowedKeys = ['totalAssets', 'cashBalance', 'stockMarketValue', 'custom'],
  hint,
}: PortfolioMetricSelectProps) {
  const { getMetricValue } = usePortfolioMetrics(positionId);
  const resolved = getMetricValue(metricKey, customValue, positionId);

  useEffect(() => {
    onResolvedChange(resolved);
  }, [resolved, onResolvedChange]);

  const options = PORTFOLIO_METRIC_OPTIONS.filter((o) => allowedKeys.includes(o.key));

  return (
    <div className="space-y-1">
      <label className="label">{label}</label>
      <div className="flex flex-wrap gap-2">
        <select
          className="input min-w-[180px] flex-1"
          value={metricKey}
          onChange={(e) => onMetricKeyChange(e.target.value as PortfolioMetricKey)}
        >
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        {metricKey === 'custom' ? (
          <input
            className="input max-w-[160px]"
            type="number"
            value={customValue || ''}
            onChange={(e) => onCustomValueChange(parseFloat(e.target.value) || 0)}
          />
        ) : (
          <div className="flex items-center rounded-lg bg-surface-2 px-3 text-sm">
            <span className="font-medium">¥{formatMoney(resolved)}</span>
            <span className="ml-2 text-xs text-muted">自动同步</span>
          </div>
        )}
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
