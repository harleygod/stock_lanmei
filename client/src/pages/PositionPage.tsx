import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePortfolio } from '../hooks/usePortfolio';
import { usePortfolioMetrics } from '../hooks/usePortfolioMetrics';
import PortfolioMetricSelect from '../components/PortfolioMetricSelect';
import type { PortfolioMetricKey } from '../hooks/usePortfolioMetrics';
import { getEffectivePrice, useStockQuotes } from '../hooks/useStockQuotes';
import { MAX_WATCH_POOL } from '../utils/constants';
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
  const { data, positions, updatePortfolio, addPositionToWatchPool, isInWatchPool } = usePortfolio();
  const { totalAssets: portfolioTotalAssets, stockMarketValue, cashBalance } = usePortfolioMetrics(id);
  const position = positions.find((p) => p.id === id);
  const { quotes } = useStockQuotes(position ? [position.code] : [], data.settings.refreshIntervalSec);

  const [scenarioPct, setScenarioPct] = useState(0);
  const [checked, setChecked] = useState<boolean[]>(CHECKLIST.map(() => false));
  const [fundKey, setFundKey] = useState<PortfolioMetricKey>('totalAssets');
  const [customFund, setCustomFund] = useState(0);
  const [fundBase, setFundBase] = useState(portfolioTotalAssets);

  const totalAssets = portfolioTotalAssets;

  const enriched = useMemo(() => {
    if (!position) return null;
    const { price, isClosed } = getEffectivePrice(position.code, quotes, position.manualPrice);
    const metrics = positionMetrics(
      position.costPrice,
      price,
      position.shares,
      position.board,
      data.settings,
      totalAssets,
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
      fundBase,
    );
    return { price, isClosed, metrics, changePct, buyF, sellF, scenario, scenarioPrice };
  }, [position, quotes, data, scenarioPct, fundBase, totalAssets]);

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
    updatePortfolio((pf) => ({
      ...pf,
      positions: pf.positions.map((p) =>
        p.id === position.id
          ? { ...p, manualPrice: n > 0 ? n : undefined, updatedAt: new Date().toISOString() }
          : p,
      ),
    }));
  };

  const addToWatch = () => {
    if (!position) return;
    const r = addPositionToWatchPool(position.id, quotes);
    if (r === 'ok') alert('已加入观察池');
    else if (r === 'duplicate') alert('已在观察池中');
    else if (r === 'full') alert(`观察池已满（最多 ${MAX_WATCH_POOL} 只）`);
  };

  return (
    <div className="space-y-4">
      <Link to="/" className="text-sm text-blue-600">← 返回持仓</Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">{position.name} ({position.code})</h1>
        <div className="flex gap-2 text-sm">
          {!isInWatchPool(position.code) ? (
            <button type="button" className="btn-ghost text-xs" onClick={addToWatch}>
              加入观察池
            </button>
          ) : (
            <Link to="/watch" className="btn-ghost text-xs">已在观察池 →</Link>
          )}
          <Link to="/calculator" className="btn-ghost text-xs">去计算器</Link>
        </div>
      </div>

      <div className="card grid gap-3 md:grid-cols-3 text-sm">
        <Item label="成本价" value={`¥${formatMoney(position.costPrice)}`} />
        <Item label="现价" value={`¥${formatMoney(enriched.price)}`} sub={enriched.isClosed ? '已收盘' : '实时'} />
        <Item label="涨跌幅" value={formatPct(enriched.changePct)} className={pnlColor(enriched.changePct)} />
        <Item label="持仓市值" value={`¥${formatMoney(enriched.metrics.marketValue)}`} />
        <Item label="占总资产" value={formatPct(enriched.metrics.weight)} sub="含可用余额" />
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
        <PortfolioMetricSelect
          label="情景模拟 · 总资金基准"
          metricKey={fundKey}
          onMetricKeyChange={setFundKey}
          customValue={customFund}
          onCustomValueChange={setCustomFund}
          onResolvedChange={setFundBase}
          positionId={id}
          allowedKeys={['totalAssets', 'cashBalance', 'stockMarketValue', 'positionMarketValue', 'custom']}
          hint={`市值 ${formatMoney(stockMarketValue)} + 余额 ${formatMoney(cashBalance)}`}
        />
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
