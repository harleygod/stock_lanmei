import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { feeDragCurve } from '../../utils/calculations';
import { formatMoney } from '../../utils/format';
import { BoardSelect, Field, ResultBox, type CalcSettings } from './Shared';
import type { Board } from '../../types';

export default function FeeDragTab({ settings }: { settings: CalcSettings }) {
  const [price, setPrice] = useState(10);
  const [shares, setShares] = useState(1000);
  const [board, setBoard] = useState<Board>('sz_main');

  const curve = useMemo(
    () => feeDragCurve(price, shares, board, settings),
    [price, shares, board, settings],
  );

  const chartData = curve.points.map((p) => ({
    profit: Math.round(p.targetProfit),
    feeRatio: Math.round(p.feeRatio * 10) / 10,
  }));

  return (
    <div className="card space-y-4">
      <p className="text-sm text-muted">
        小目标盈利时，手续费侵蚀严重。观察目标盈利与手续费占比的关系。
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

      <div className="grid gap-3 md:grid-cols-3">
        <ResultBox
          title="50% 临界点"
          value={curve.breakeven50 != null ? `¥${formatMoney(curve.breakeven50)}` : '—'}
          sub="手续费 = 毛利润的一半"
        />
        <ResultBox
          title="建议最小目标盈利"
          value={curve.minProfitUnder20Pct != null ? `¥${formatMoney(curve.minProfitUnder20Pct)}` : '—'}
          sub="手续费占比 < 20%"
        />
        <ResultBox title="买入总成本" value={`¥${formatMoney(curve.buyTotalCost)}`} />
      </div>

      <div className="rounded-lg bg-surface-2 p-3 text-sm text-muted">
        {curve.minProfitUnder20Pct != null ? (
          <p>
            建议单次交易目标盈利 &gt; ¥{formatMoney(curve.minProfitUnder20Pct)}，手续费占比才低于 20%。
            过小盈利目标会被手续费严重侵蚀。
          </p>
        ) : (
          <p>在当前参数下，即使较大目标盈利，手续费占比较高 — 可考虑增大单笔规模或减少交易频率。</p>
        )}
      </div>
    </div>
  );
}
