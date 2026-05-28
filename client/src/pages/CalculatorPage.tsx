import { useCallback, useEffect, useState } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { usePortfolio } from '../hooks/usePortfolio';
import PositionImportBar from '../components/PositionImportBar';
import type { Board, PositionImportPayload } from '../types';
import {
  batchSellPlan,
  evAdvice,
  expectedValue,
  kellyFraction,
  netSellProceeds,
  recoveryAfterLossPct,
  scenarioMatrix,
  stopLossAnalysis,
  targetSellPrice,
  totalBuyCost,
  weightedAverageCost,
} from '../utils/calculations';
import { formatMoney, formatPct, pnlColor } from '../utils/format';
import { boardLabel, isShanghai } from '../utils/stockCode';
import OpportunityCostTab from '../components/calc/OpportunityCostTab';
import MarginOfSafetyTab from '../components/calc/MarginOfSafetyTab';
import FeeDragTab from '../components/calc/FeeDragTab';
import MungerQuote from '../components/MungerQuote';

type Tab = 'ev' | 'profit' | 'stop' | 'batch' | 'cost' | 'matrix' | 'opp' | 'mos' | 'fee';

const TABS: { id: Tab; label: string }[] = [
  { id: 'ev', label: '期望值' },
  { id: 'profit', label: '盈利目标' },
  { id: 'stop', label: '止损' },
  { id: 'batch', label: '分批卖出' },
  { id: 'cost', label: '综合成本' },
  { id: 'matrix', label: '情景矩阵' },
  { id: 'opp', label: '机会成本' },
  { id: 'mos', label: '安全边际' },
  { id: 'fee', label: '手续费曲线' },
];

export default function CalculatorPage() {
  const [tab, setTab] = useState<Tab>('ev');
  const { data } = useAppContext();
  const { positions } = usePortfolio();
  const settings = data.settings;
  const [importPayload, setImportPayload] = useState<PositionImportPayload | null>(null);
  const [importTick, setImportTick] = useState(0);

  const handleImport = (p: { id: string; name: string; code: string; costPrice: number; shares: number; board: Board }) => {
    setImportPayload({
      id: p.id,
      name: p.name,
      code: p.code,
      price: p.costPrice,
      shares: p.shares,
      board: p.board,
    });
    setImportTick((t) => t + 1);
  };

  const importProps = { importPayload, importTick };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">计算器中心</h1>
      <PositionImportBar positions={positions} onImport={handleImport} />
      <div className="flex gap-2 overflow-x-auto border-b border-border pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap px-3 py-2 text-sm ${tab === t.id ? 'tab-active' : 'text-muted'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'ev' && <EVCalculator />}
      {tab === 'profit' && <ProfitCalculator settings={settings} {...importProps} />}
      {tab === 'stop' && <StopCalculator settings={settings} {...importProps} />}
      {tab === 'batch' && <BatchCalculator settings={settings} {...importProps} />}
      {tab === 'cost' && <CostCalculator settings={settings} {...importProps} />}
      {tab === 'matrix' && <MatrixCalculator {...importProps} />}
      {tab === 'opp' && <OpportunityCostTab settings={settings} />}
      {tab === 'mos' && <MarginOfSafetyTab settings={settings} {...importProps} />}
      {tab === 'fee' && <FeeDragTab settings={settings} {...importProps} />}

      <MungerQuote />
    </div>
  );
}

function EVCalculator() {
  const [winProb, setWinProb] = useState(55);
  const [gain, setGain] = useState(15);
  const [loss, setLoss] = useState(8);
  const { ev, ratio } = expectedValue(winProb, gain, loss);
  const advice = evAdvice(ev, ratio);
  const kelly = kellyFraction(winProb, gain, loss);

  return (
    <div className="card space-y-4">
      <p className="text-sm text-muted">
        好的决策 = 正确评估每种结果的概率 × 对应收益，选期望值最高的选项
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="上涨概率 (%)" value={winProb} onChange={setWinProb} />
        <Field label="预期涨幅 (%)" value={gain} onChange={setGain} />
        <Field label="预期跌幅 (%)" value={loss} onChange={setLoss} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <ResultBox title="期望值 EV" value={formatPct(ev)} highlight={ev >= 0 ? 'profit' : 'loss'} />
        <ResultBox title="盈亏比" value={ratio.toFixed(2)} />
        <ResultBox title="Kelly 建议仓位" value={formatPct(kelly * 100)} sub="半 Kelly 更保守" />
      </div>
      <div className={`rounded-lg p-3 text-sm ${advice.level === 'good' ? 'bg-green-50 text-profit dark:bg-green-950/30' : advice.level === 'ok' ? 'bg-orange-50 text-warn dark:bg-orange-950/30' : 'bg-red-50 text-loss dark:bg-red-950/30'}`}>
        {advice.level === 'good' ? '✅' : advice.level === 'ok' ? '⚠️' : '❌'} {advice.text}
      </div>
      <blockquote className="border-l-4 border-blue-500 pl-3 text-sm text-muted italic">
        宁愿等待期望值明确为正的机会，也不要用情绪驱动决策 — 查理·芒格
      </blockquote>
    </div>
  );
}

function ProfitCalculator({
  settings,
  importPayload,
  importTick,
}: {
  settings: typeof import('../types').DEFAULT_SETTINGS;
  importPayload: PositionImportPayload | null;
  importTick: number;
}) {
  const [price, setPrice] = useState(10);
  const [shares, setShares] = useState(1000);
  const [board, setBoard] = useState<Board>('sz_main');
  const [targetProfit, setTargetProfit] = useState(500);

  const applyImport = useCallback((p: PositionImportPayload) => {
    setPrice(p.price);
    setShares(p.shares);
    setBoard(p.board);
  }, []);

  useEffect(() => {
    if (importPayload && importTick > 0) applyImport(importPayload);
  }, [importTick, importPayload, applyImport]);

  const buy = totalBuyCost(price, shares, board, settings);
  const sellP = targetSellPrice(price, shares, board, settings, targetProfit);
  const sell = netSellProceeds(sellP, shares, board, settings);
  const actualProfit = sell.net - buy.totalCost;
  const actualPct = buy.totalCost > 0 ? (actualProfit / buy.totalCost) * 100 : 0;

  return (
    <div className="card space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="买入价格" value={price} onChange={setPrice} step={0.01} />
        <Field label="股数" value={shares} onChange={setShares} />
        <BoardSelect board={board} onChange={setBoard} />
        <Field label="目标盈利 (元)" value={targetProfit} onChange={setTargetProfit} />
      </div>
      <div className="grid gap-2 text-sm md:grid-cols-2">
        <DetailBlock title="买入明细" items={[
          ['买入金额', formatMoney(buy.amount)],
          ['佣金', formatMoney(buy.commission)],
          ...(isShanghai(board) ? [['过户费', formatMoney(buy.transfer!)]] : []),
          ['买入总成本', formatMoney(buy.totalCost)],
        ]} />
        <DetailBlock title="目标卖出明细" items={[
          ['需卖出价格', formatMoney(sellP)],
          ['卖出金额', formatMoney(sell.amount)],
          ['印花税', formatMoney(sell.stampTax!)],
          ['佣金', formatMoney(sell.commission!)],
          ...(isShanghai(board) ? [['过户费', formatMoney(sell.transfer!)]] : []),
          ['到手净额', formatMoney(sell.net)],
        ]} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <ResultBox title="实际净利润" value={`¥${formatMoney(actualProfit)}`} highlight={actualProfit >= 0 ? 'profit' : 'loss'} />
        <ResultBox title="实际收益率" value={formatPct(actualPct)} />
        <ResultBox title="手续费合计" value={`¥${formatMoney(buy.total + sell.total)}`} />
      </div>
    </div>
  );
}

function StopCalculator({
  settings,
  importPayload,
  importTick,
}: {
  settings: typeof import('../types').DEFAULT_SETTINGS;
  importPayload: PositionImportPayload | null;
  importTick: number;
}) {
  const { cashBalance } = usePortfolio();
  const [price, setPrice] = useState(10);
  const [shares, setShares] = useState(1000);
  const [board, setBoard] = useState<Board>('sz_main');
  const [currentPrice, setCurrentPrice] = useState(0);
  const [totalAssets, setTotalAssets] = useState(100000);
  const [maxLoss, setMaxLoss] = useState(2000);
  const [partialShares, setPartialShares] = useState(100);

  useEffect(() => {
    if (importPayload && importTick > 0) {
      setPrice(importPayload.price);
      setShares(importPayload.shares);
      setBoard(importPayload.board);
      const posValue = importPayload.price * importPayload.shares;
      setTotalAssets(Math.round(posValue + cashBalance));
    }
  }, [importTick, importPayload, cashBalance]);

  const partial = partialShares > 0 && partialShares < shares ? partialShares : 0;
  const analysis = stopLossAnalysis(
    price,
    shares,
    board,
    settings,
    maxLoss,
    currentPrice > 0 ? currentPrice : undefined,
    totalAssets,
    partial > 0 ? partial : undefined,
  );

  const recovery = recoveryAfterLossPct(-analysis.lossPctAtStop);
  const impactAtStop = totalAssets > 0 ? (analysis.lossAtStop / totalAssets) * 100 : 0;

  return (
    <div className="card space-y-4">
      <p className="text-sm text-muted">
        设定「最多亏多少」反推止损价；填入<strong>现价</strong>看是否该卖，填<strong>减仓股数</strong>看部分卖出效果。
        想分批卖完整方案 → 切到「分批卖出」Tab。
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="买入成本价" value={price} onChange={setPrice} step={0.01} />
        <Field label="持仓股数" value={shares} onChange={setShares} />
        <Field label="当前现价" value={currentPrice} onChange={setCurrentPrice} step={0.01} />
        <BoardSelect board={board} onChange={setBoard} />
        <Field label="总资金（市值+现金，算影响比例）" value={totalAssets} onChange={setTotalAssets} />
        <Field label="最大可承受亏损 (元)" value={maxLoss} onChange={setMaxLoss} />
        <Field label="拟减仓股数（可选）" value={partialShares} onChange={setPartialShares} />
      </div>

      {analysis.warning && (
        <p className="rounded-lg bg-orange-50 px-3 py-2 text-sm text-warn dark:bg-orange-950/30">{analysis.warning}</p>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <ResultBox title="止损价格" value={`¥${formatMoney(analysis.stopPrice)}`} sub="跌到此价卖出，亏损≈上限" />
        <ResultBox title="触发时亏损" value={`¥${formatMoney(analysis.lossAtStop)}`} highlight="loss" />
        <ResultBox title="对总资金影响" value={formatPct(-impactAtStop)} highlight="loss" />
      </div>

      {analysis.current && (
        <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-2 text-sm">
          <div className="font-medium">按现价 ¥{formatMoney(currentPrice)} 全部卖出</div>
          <div className="grid gap-2 md:grid-cols-3">
            <div>
              <span className="text-muted">实亏 </span>
              <span className={pnlColor(-analysis.current.loss)}>¥{formatMoney(analysis.current.loss)}</span>
              <span className="text-muted"> ({formatPct(-analysis.current.lossPct)})</span>
            </div>
            <div>
              <span className="text-muted">到手 </span>
              <span>¥{formatMoney(analysis.current.sellNet)}</span>
            </div>
            <div>
              <span className="text-muted">占资金 </span>
              <span className="text-loss">{formatPct(-analysis.current.impactPct)}</span>
            </div>
          </div>
          <p className={analysis.current.triggered ? 'text-loss font-medium' : 'text-muted'}>
            {analysis.current.priceVsStop}
          </p>
        </div>
      )}

      {analysis.partial && currentPrice > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-1 text-sm dark:border-blue-900 dark:bg-blue-950/20">
          <div className="font-medium">减仓 {analysis.partial.shares} 股 @ ¥{formatMoney(currentPrice)}</div>
          <div>到手 ¥{formatMoney(analysis.partial.sellNet)} · 该部分亏损 ¥{formatMoney(analysis.partial.loss)}</div>
          <div className="text-muted">
            剩余 {analysis.partial.remainingShares} 股 · 剩余成本约 ¥{formatMoney(analysis.partial.remainingCost)}
          </div>
        </div>
      )}

      <p className="text-sm text-muted">
        若触发止损后仍持有，需涨 {formatPct(recovery)} 才能回本（手续费不对称）。
      </p>
    </div>
  );
}

function BatchCalculator({
  settings,
  importPayload,
  importTick,
}: {
  settings: typeof import('../types').DEFAULT_SETTINGS;
  importPayload: PositionImportPayload | null;
  importTick: number;
}) {
  const [avgCost, setAvgCost] = useState(10);
  const [shares, setShares] = useState(1000);
  const [current, setCurrent] = useState(12);
  const [board, setBoard] = useState<Board>('sz_main');
  const [batches, setBatches] = useState(3);

  useEffect(() => {
    if (importPayload && importTick > 0) {
      setAvgCost(importPayload.price);
      setShares(importPayload.shares);
      setBoard(importPayload.board);
      setCurrent(importPayload.price);
    }
  }, [importTick, importPayload]);

  const plan = batchSellPlan(avgCost, shares, current, board, settings, batches);

  return (
    <div className="card space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="买入均价" value={avgCost} onChange={setAvgCost} step={0.01} />
        <Field label="总股数" value={shares} onChange={setShares} />
        <Field label="当前价格" value={current} onChange={setCurrent} step={0.01} />
        <BoardSelect board={board} onChange={setBoard} />
        <div>
          <label className="label">分批数</label>
          <select className="input" value={batches} onChange={(e) => setBatches(Number(e.target.value))}>
            {[2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n} 批</option>
            ))}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-muted">
              <th className="py-1">批次</th>
              <th>股数</th>
              <th>到手</th>
              <th>盈亏</th>
              <th>剩余</th>
              <th>剩余平衡价</th>
            </tr>
          </thead>
          <tbody>
            {plan.rows.map((r) => (
              <tr key={r.batch} className="border-b border-border/50">
                <td className="py-2">{r.batch}</td>
                <td>{r.shares}</td>
                <td>{formatMoney(r.netProceeds)}</td>
                <td className={pnlColor(r.batchPnl)}>{formatMoney(r.batchPnl)}</td>
                <td>{r.remainingShares}</td>
                <td>{formatMoney(r.breakEvenPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:grid-cols-3 text-sm">
        <div>已套现：¥{formatMoney(plan.totalNet)}</div>
        <div className={pnlColor(plan.remainingPnl)}>剩余浮盈/亏：¥{formatMoney(plan.remainingPnl)}</div>
        <div className="text-muted">手续费：¥{formatMoney(plan.totalFee)}</div>
      </div>
    </div>
  );
}

function CostCalculator({
  settings,
  importPayload,
  importTick,
}: {
  settings: typeof import('../types').DEFAULT_SETTINGS;
  importPayload: PositionImportPayload | null;
  importTick: number;
}) {
  const [lots, setLots] = useState([{ price: 10, shares: 500 }, { price: 9.5, shares: 500 }]);
  const [board, setBoard] = useState<Board>('sz_main');
  const [current, setCurrent] = useState(10.5);

  useEffect(() => {
    if (importPayload && importTick > 0) {
      setLots([{ price: importPayload.price, shares: importPayload.shares }]);
      setBoard(importPayload.board);
      setCurrent(importPayload.price);
    }
  }, [importTick, importPayload]);

  const avg = weightedAverageCost(lots, board, settings);
  const sell = netSellProceeds(current, avg.totalShares, board, settings);
  const pnl = sell.net - avg.totalCost;
  const pnlPct = avg.totalCost > 0 ? (pnl / avg.totalCost) * 100 : 0;

  return (
    <div className="card space-y-4">
      <BoardSelect board={board} onChange={setBoard} />
      {lots.map((lot, i) => (
        <div key={i} className="grid grid-cols-2 gap-2">
          <Field label={`第 ${i + 1} 次价格`} value={lot.price} onChange={(v) => {
            const next = [...lots];
            next[i] = { ...next[i], price: v };
            setLots(next);
          }} step={0.01} />
          <Field label="股数" value={lot.shares} onChange={(v) => {
            const next = [...lots];
            next[i] = { ...next[i], shares: v };
            setLots(next);
          }} />
        </div>
      ))}
      <button type="button" className="btn-ghost text-xs" onClick={() => setLots([...lots, { price: 0, shares: 0 }])}>
        + 添加一笔
      </button>
      <Field label="当前价格" value={current} onChange={setCurrent} step={0.01} />
      <div className="grid gap-3 md:grid-cols-3">
        <ResultBox title="加权成本" value={`¥${formatMoney(avg.avgCost)}`} />
        <ResultBox title="总股数" value={String(avg.totalShares)} />
        <ResultBox title="总成本(含费)" value={`¥${formatMoney(avg.totalCost)}`} />
        <ResultBox title="整体盈亏" value={`¥${formatMoney(pnl)}`} highlight={pnl >= 0 ? 'profit' : 'loss'} />
        <ResultBox title="盈亏比例" value={formatPct(pnlPct)} />
      </div>
    </div>
  );
}

function MatrixCalculator({
  importPayload,
  importTick,
}: {
  importPayload: PositionImportPayload | null;
  importTick: number;
}) {
  const [base, setBase] = useState(10);
  const [bullPct, setBullPct] = useState(20);
  const [bearPct, setBearPct] = useState(15);
  const [probBull, setProbBull] = useState(40);

  useEffect(() => {
    if (importPayload && importTick > 0) setBase(importPayload.price);
  }, [importTick, importPayload]);

  const m = scenarioMatrix(base, bullPct, bearPct, probBull);

  return (
    <div className="card space-y-4">
      <p className="text-sm text-muted">
        排列组合思维：列出主要情景及其概率，加权得到期望结果，避免只想象一种未来
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="基准价格" value={base} onChange={setBase} step={0.01} />
        <Field label="牛市概率 (%)" value={probBull} onChange={setProbBull} />
        <Field label="牛市涨幅 (%)" value={bullPct} onChange={setBullPct} />
        <Field label="熊市跌幅 (%)" value={bearPct} onChange={setBearPct} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {m.cells.map((c) => (
          <div key={c.label} className="rounded-lg border border-border p-3">
            <div className="font-medium">{c.label}</div>
            <div className="text-lg">¥{formatMoney(c.price)}</div>
            <div className="text-sm text-muted">概率 {c.prob}% · {formatPct(c.change)}</div>
          </div>
        ))}
      </div>
      <ResultBox title="概率加权期望价" value={`¥${formatMoney(m.expectedPrice)}`} sub={`情景价差 ¥${formatMoney(m.spread)}`} />
    </div>
  );
}

function Field({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" type="number" step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
    </div>
  );
}

function BoardSelect({ board, onChange }: { board: Board; onChange: (b: Board) => void }) {
  return (
    <div>
      <label className="label">交易所</label>
      <select className="input" value={board} onChange={(e) => onChange(e.target.value as Board)}>
        {(['sh_main', 'sz_main', 'gem', 'star', 'bse'] as Board[]).map((b) => (
          <option key={b} value={b}>{boardLabel(b)}</option>
        ))}
      </select>
    </div>
  );
}

function ResultBox({ title, value, sub, highlight }: { title: string; value: string; sub?: string; highlight?: 'profit' | 'loss' }) {
  const cls = highlight === 'profit' ? 'text-profit' : highlight === 'loss' ? 'text-loss' : '';
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <div className="text-xs text-muted">{title}</div>
      <div className={`text-xl font-bold ${cls}`}>{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

function DetailBlock({ title, items }: { title: string; items: string[][] }) {
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <div className="mb-2 font-medium">{title}</div>
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between text-muted">
          <span>{k}</span>
          <span className="text-text">{v}</span>
        </div>
      ))}
    </div>
  );
}
