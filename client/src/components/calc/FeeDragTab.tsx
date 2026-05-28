import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { feeDragCurve, computeFeeDragAtTarget } from '../../utils/calculations';
import { formatMoney } from '../../utils/format';
import { BoardSelect, Field, ResultBox, type CalcSettings } from './Shared';
import type { Board, StockImportPayload } from '../../types';

export default function FeeDragTab({
  settings,
  importPayload,
  importTick,
}: {
  settings: CalcSettings;
  importPayload?: StockImportPayload | null;
  importTick?: number;
}) {
  const [price, setPrice] = useState(10);
  const [shares, setShares] = useState(1000);
  const [board, setBoard] = useState<Board>('sz_main');

  useEffect(() => {
    if (importPayload && importTick && importTick > 0) {
      setPrice(importPayload.price);
      setShares(importPayload.shares);
      setBoard(importPayload.board);
    }
  }, [importTick, importPayload]);

  const curve = useMemo(
    () => feeDragCurve(price, shares, board, settings),
    [price, shares, board, settings],
  );

  const example500 = useMemo(
    () => computeFeeDragAtTarget(price, shares, board, settings, 500),
    [price, shares, board, settings],
  );

  const chartData = curve.points.map((p) => ({
    profit: Math.round(p.targetProfit),
    feeRatio: Math.round(p.feeRatio * 10) / 10,
  }));

  return (
    <div className="card space-y-4">
      <p className="text-sm text-muted">
        小目标盈利时，手续费侵蚀严重。曲线展示：<strong className="text-text">往返手续费 ÷ 毛利润</strong>（毛利润 = 价差收益，未扣费前）。
      </p>

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="买入价格" value={price} onChange={setPrice} step={0.01} />
        <Field label="股数" value={shares} onChange={setShares} />
        <BoardSelect board={board} onChange={setBoard} />
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis
              dataKey="profit"
              tickFormatter={(v) => `¥${v}`}
              label={{ value: '目标盈利 (元)', position: 'insideBottom', offset: -5, fontSize: 11 }}
            />
            <YAxis
              domain={[0, 100]}
              unit="%"
              label={{ value: '手续费占比', angle: -90, position: 'insideLeft', fontSize: 11 }}
            />
            <Tooltip
              formatter={(v: number, name: string) =>
                name === 'feeRatio' ? `${v}%` : v
              }
              labelFormatter={(l) => `目标盈利 ¥${l}`}
            />
            <ReferenceLine y={50} stroke="#ea580c" strokeDasharray="4 4" label={{ value: '50%', fontSize: 10 }} />
            <ReferenceLine y={20} stroke="#16a34a" strokeDasharray="4 4" label={{ value: '20%', fontSize: 10 }} />
            <Line type="monotone" dataKey="feeRatio" stroke="#2563eb" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <ResultBox
          title="50% 临界点"
          value={curve.breakeven50 != null ? `¥${formatMoney(curve.breakeven50)}` : '—'}
          sub="毛利润中手续费 ≤50%"
        />
        <ResultBox
          title="建议最小目标盈利"
          value={curve.minProfitUnder20Pct != null ? `¥${formatMoney(curve.minProfitUnder20Pct)}` : '—'}
          sub="毛利润中手续费 <20%"
        />
        <ResultBox title="买入总成本" value={`¥${formatMoney(curve.buyTotalCost)}`} />
        <ResultBox
          title="往返手续费(估)"
          value={`¥${formatMoney(curve.roundTripFeeAtCost)}`}
          sub="按成本价买卖各一次"
        />
      </div>

      <div className="rounded-lg bg-surface-2 p-3 text-sm text-muted">
        {curve.minProfitUnder20Pct != null ? (
          <p>
            建议单次目标盈利 &gt; ¥{formatMoney(curve.minProfitUnder20Pct)}（手续费占毛利润 &lt;20%）。
            往返手续费约 ¥{formatMoney(curve.roundTripFeeAtCost)}；若目标赚 ¥500，占比约{' '}
            {example500.feeRatio.toFixed(1)}%，远不需等到本金涨 50%。
          </p>
        ) : (
          <p>在当前参数下，即使较大目标盈利，手续费占比较高 — 可考虑增大单笔规模或减少交易频率。</p>
        )}
      </div>
    </div>
  );
}
