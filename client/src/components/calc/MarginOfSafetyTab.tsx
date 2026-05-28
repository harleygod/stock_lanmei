import { useState } from 'react';
import { marginOfSafety } from '../../utils/calculations';
import { formatMoney, formatPct } from '../../utils/format';
import { BoardSelect, Field, ResultBox, type CalcSettings } from './Shared';

export default function MarginOfSafetyTab(_props: { settings: CalcSettings }) {
  const [fairValue, setFairValue] = useState(20);
  const [marginPct, setMarginPct] = useState(30);
  const [buyPrice, setBuyPrice] = useState(14);

  const m = marginOfSafety(fairValue, marginPct, buyPrice);

  return (
    <div className="card space-y-4">
      <p className="text-sm text-muted">
        只在价格显著低于保守估值时买入，留出犯错空间。
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="保守估计每股价值 (元)" value={fairValue} onChange={setFairValue} step={0.01} />
        <Field label="安全边际 (%)" value={marginPct} onChange={setMarginPct} />
        <Field label="计划买入价 (元)" value={buyPrice} onChange={setBuyPrice} step={0.01} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <ResultBox title="最高可接受买入价" value={`¥${formatMoney(m.maxAcceptablePrice)}`} highlight="profit" />
        <ResultBox
          title="当前折扣率"
          value={formatPct(m.discountRate)}
          highlight={m.discountRate >= marginPct ? 'profit' : 'loss'}
          sub={m.discountRate >= 0 ? '相对估值的折扣' : '溢价买入'}
        />
      </div>

      <div
        className={`rounded-lg p-4 text-center text-lg font-bold ${
          m.inSafetyZone
            ? 'bg-green-50 text-profit dark:bg-green-950/30'
            : 'bg-red-50 text-loss dark:bg-red-950/30'
        }`}
      >
        {m.inSafetyZone ? '✅ 当前价格在安全区内，有安全边际' : '❌ 当前价格超出安全区，溢价买入'}
      </div>

      {!m.inSafetyZone && (
        <p className="text-sm text-warn">
          当前溢价 {formatPct(m.premiumPct)}（相对最高可接受价），需下跌 {formatPct(m.needDropPct)} 才进入安全区
        </p>
      )}
    </div>
  );
}
