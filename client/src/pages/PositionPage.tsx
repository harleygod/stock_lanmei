import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppContext } from '../hooks/useAppContext';
import { getEffectivePrice, useStockQuotes } from '../hooks/useStockQuotes';
import { buyFee, positionMetrics, scenarioPnl, sellFee } from '../utils/calculations';
import { formatMoney, formatPct, pnlColor } from '../utils/format';

const CHECKLIST = [
  '如果现在手里是现金，我还愿意在这个价格买入吗？',
  '这只股票的基本面（业绩、行业）有没有变坏？',
  '我买这只股票的原始逻辑还成立吗？',
  '我现在持有是因为数据支持，而不是不想承认亏损？',
  '这只股票的仓位在合理范围内（< 30%）？',
];

export default function PositionPage() {
  const { id } = useParams();
  const { data, update } = useAppContext();
  const position = data.positions.find((p) => p.id === id);
  const { quotes } = useStockQuotes(position ? [position.code] : [], data.settings.refreshIntervalSec);

  const [scenarioPct, setScenarioPct] = useState(0);
  const [checked, setChecked] = useState<boolean[]>(CHECKLIST.map(() => false));
  const [totalAssets, setTotalAssets] = useState(100000);

  const enriched = useMemo(() => {
    if (!position) return null;
    const { price, isClosed } = getEffectivePrice(position.code, quotes, position.manualPrice);
    const allValues = data.positions.map((p) => {
      const px = getEffectivePrice(p.code, quotes, p.manualPrice).price;
      return px * p.shares;
    });
    const totalValue = allValues.reduce((a, b) => a + b, 0);
    const metrics = positionMetrics(
      position.costPrice,
      price,
      position.shares,
      position.board,
      data.settings,
      totalValue,
    );
    const changePct = position.costPrice > 0 ? ((price - position.costPrice) / position.costPrice) * 100 : 0;
    const buyAmount = position.costPrice * position.shares;
    const buyF = buyFee(buyAmount, position.board, data.settings);
    const sellAmount = price * position.shares;
    const sellF = sellFee(sellAmount, position.board, data.settings);
    const scenarioPrice = price * (1 + scenarioPct / 100);
    const scenario = scenarioPnl(
      position.costPrice,
      position.shares,
      scenarioPrice,
      position.board,
      data.settings,
      totalAssets,
    );
    return { price, isClosed, metrics, changePct, buyF, sellF, scenario, scenarioPrice };
  }, [position, quotes, data, scenarioPct, totalAssets]);

  if (!position || !enriched) {
    return (
      <div className="card">
        未找到持仓 <Link to="/" className="text-blue-600">返回</Link>
      </div>
    );
  }

  const yesCount = checked.filter(Boolean).length;
  const advice =
    yesCount >= 5
      ? { color: 'text-profit', text: '持有逻辑充分，继续持有' }
      : yesCount >= 3
        ? { color: 'text-warn', text: '建议重新评估仓位比例' }
        : { color: 'text-loss', text: '建议认真考虑止损或减仓' };

  const toggleCheck = (i: number) => {
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  };

  const setManualPrice = (v: string) => {
    const n = parseFloat(v);
    update((d) => ({
      ...d,
      positions: d.positions.map((p) =>
        p.id === position.id
          ? { ...p, manualPrice: n > 0 ? n : undefined, updatedAt: new Date().toISOString() }
          : p,
      ),
    }));
  };

  return (
    <div className="space-y-4">
      <Link to="/" className="text-sm text-blue-600">← 返回持仓</Link>
      <h1 className="text-xl font-bold">{position.name} ({position.code})</h1>

      <div className="card grid gap-3 md:grid-cols-3 text-sm">
        <Item label="成本价" value={`¥${formatMoney(position.costPrice)}`} />
        <Item label="现价" value={`¥${formatMoney(enriched.price)}`} sub={enriched.isClosed ? '已收盘' : '实时'} />
        <Item label="涨跌幅" value={formatPct(enriched.changePct)} className={pnlColor(enriched.changePct)} />
        <Item label="持仓市值" value={`¥${formatMoney(enriched.metrics.marketValue)}`} />
        <Item label="占总仓位" value={formatPct(enriched.metrics.weight)} />
        <Item label="盈亏" value={`¥${formatMoney(enriched.metrics.pnl)} (${formatPct(enriched.metrics.pnlPct)})`} className={pnlColor(enriched.metrics.pnl)} />
        <Item label="买入手续费(估)" value={`¥${formatMoney(enriched.buyF.total)}`} muted />
        <Item label="预计卖出手续费" value={`¥${formatMoney(enriched.sellF.total)}`} muted />
        <Item label="回本需涨" value={enriched.metrics.pnl < 0 ? formatPct(enriched.metrics.breakEvenGainPct) : '已盈利'} className="text-warn" />
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">手动覆盖现价</h2>
        <input
          className="input max-w-xs"
          type="number"
          step="0.01"
          placeholder={String(enriched.price)}
          onChange={(e) => setManualPrice(e.target.value)}
        />
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">情景模拟</h2>
        <div>
          <label className="label">价格变化：{formatPct(scenarioPct)} → ¥{formatMoney(enriched.scenarioPrice)}</label>
          <input
            type="range"
            min={-50}
            max={100}
            value={scenarioPct}
            onChange={(e) => setScenarioPct(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Item label="该情景盈亏(含费)" value={`¥${formatMoney(enriched.scenario.pnl)}`} className={pnlColor(enriched.scenario.pnl)} />
          <Item label="对总资金影响" value={formatPct(enriched.scenario.impact)} />
          <Item label="回本需涨" value={formatPct(enriched.scenario.breakEvenGainPct)} />
        </div>
        <div>
          <label className="label">总资金（用于影响比例）</label>
          <input className="input max-w-xs" type="number" value={totalAssets} onChange={(e) => setTotalAssets(Number(e.target.value))} />
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">决策自检清单</h2>
        {CHECKLIST.map((q, i) => (
          <label key={i} className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" checked={checked[i]} onChange={() => toggleCheck(i)} className="mt-1" />
            <span>{q}</span>
          </label>
        ))}
        <p className={`font-medium ${advice.color}`}>{advice.text}（{yesCount}/5）</p>
      </div>
    </div>
  );
}

function Item({ label, value, sub, className, muted }: { label: string; value: string; sub?: string; className?: string; muted?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={`font-medium ${muted ? 'text-muted' : className ?? ''}`}>{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}
