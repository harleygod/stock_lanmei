import { useMemo, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio } from '../../hooks/usePortfolio';
import { usePortfolioMetrics, type PortfolioMetricKey } from '../../hooks/usePortfolioMetrics';
import PortfolioMetricSelect from '../PortfolioMetricSelect';
import { getEffectivePrice, useStockQuotes } from '../../hooks/useStockQuotes';
import {
  compareWatchPoolOpportunity,
  opportunityCostScenario,
  resolveWatchBuyPlan,
  swapCost,
} from '../../utils/calculations';
import { formatMoney, formatPct, pnlColor } from '../../utils/format';
import { BoardSelect, Field, ResultBox, type CalcSettings } from './Shared';
import type { Board, StockImportPayload, WatchItem } from '../../types';

type AMode = 'cash' | 'position' | 'manual';
type BPriceMode = 'trigger' | 'current';

const SIGNAL_SHORT: Record<string, string> = {
  ready: '可买',
  near: '接近',
  wait: '观望',
  high: '偏高',
};

export default function OpportunityCostTab({
  settings,
  importPayload,
  importTick,
}: {
  settings: CalcSettings;
  importPayload?: StockImportPayload | null;
  importTick?: number;
}) {
  const { positions } = usePortfolio();
  const { cashBalance, watchPool } = usePortfolioMetrics();

  const watchCodes = watchPool.map((w) => w.code);
  const posCodes = positions.map((p) => p.code);
  const allCodes = [...new Set([...watchCodes, ...posCodes])];
  const { quotes } = useStockQuotes(allCodes, settings.refreshIntervalSec);

  const [aMode, setAMode] = useState<AMode>(cashBalance > 0 ? 'cash' : 'manual');
  const [posId, setPosId] = useState('');
  const [cashMetricKey, setCashMetricKey] = useState<PortfolioMetricKey>('cashBalance');
  const [customCash, setCustomCash] = useState(0);
  const [cashAmount, setCashAmount] = useState(cashBalance || 20000);

  const [aWin, setAWin] = useState(50);
  const [aGain, setAGain] = useState(12);
  const [aLoss, setALoss] = useState(8);
  const [aPrice, setAPrice] = useState(10);
  const [aShares, setAShares] = useState(1000);
  const [aBoard, setABoard] = useState<Board>('sz_main');

  const [watchId, setWatchId] = useState('');
  const [bPriceMode, setBPriceMode] = useState<BPriceMode>('trigger');
  const [bWin, setBWin] = useState(55);
  const [bGain, setBGain] = useState(18);
  const [bLoss, setBLoss] = useState(10);
  const [bPrice, setBPrice] = useState(15);
  const [bShares, setBShares] = useState(800);
  const [bBoard, setBBoard] = useState<Board>('sz_main');

  useEffect(() => {
    if (aMode === 'cash' && cashMetricKey === 'cashBalance' && cashBalance > 0) {
      setCashAmount(cashBalance);
    }
  }, [cashBalance, aMode, cashMetricKey]);

  const applyWatchToB = useCallback(
    (w: WatchItem, mode: BPriceMode) => {
      const { price } = getEffectivePrice(w.code, quotes, undefined);
      const plan = resolveWatchBuyPlan(w, price, settings, mode);
      setBWin(w.winProb);
      setBGain(w.gainPct);
      setBLoss(w.lossPct);
      setBPrice(plan.bPrice);
      setBShares(plan.bShares || Math.max(100, Math.floor(w.maxBuyAmount / plan.bPrice / 100) * 100));
      setBBoard(w.board);
    },
    [quotes, settings],
  );

  const loadFromPosition = useCallback(
    (id: string) => {
      setPosId(id);
      setAMode('position');
      const p = positions.find((x) => x.id === id);
      if (!p) return;
      setAPrice(p.costPrice);
      setAShares(p.shares);
      setABoard(p.board);
    },
    [positions],
  );

  const loadFromWatch = useCallback(
    (id: string) => {
      setWatchId(id);
      const w = watchPool.find((x) => x.id === id);
      if (!w) return;
      applyWatchToB(w, bPriceMode);
    },
    [watchPool, bPriceMode, applyWatchToB],
  );

  useEffect(() => {
    if (!importPayload || !importTick || importTick <= 0) return;
    if (importPayload.source === 'position') {
      loadFromPosition(importPayload.id);
    } else if (importPayload.source === 'watch') {
      loadFromWatch(importPayload.id);
    }
  }, [importTick, importPayload, loadFromPosition, loadFromWatch]);

  const selectedPos = positions.find((p) => p.id === posId);
  const selectedWatch = watchPool.find((w) => w.id === watchId);

  const sideA = useMemo(() => {
    if (aMode === 'cash') {
      return { mode: 'cash' as const, cashAmount };
    }
    return {
      mode: 'position' as const,
      price: aPrice,
      shares: aShares,
      board: aBoard,
      winProb: aWin,
      gainPct: aGain,
      lossPct: aLoss,
    };
  }, [aMode, cashAmount, aPrice, aShares, aBoard, aWin, aGain, aLoss]);

  const result = useMemo(
    () =>
      opportunityCostScenario(sideA, bWin, bGain, bLoss, bPrice, bShares, bBoard, settings),
    [sideA, bWin, bGain, bLoss, bPrice, bShares, bBoard, settings],
  );

  const swap = useMemo(() => {
    if (aMode === 'cash') {
      return { total: result.swapFeeTotal, label: '买入 B 手续费' };
    }
    return { total: swapCost(aPrice, aShares, aBoard, bPrice, bShares, bBoard, settings).total, label: '换仓手续费' };
  }, [aMode, aPrice, aShares, aBoard, bPrice, bShares, bBoard, settings, result.swapFeeTotal]);

  const watchRankings = useMemo(() => {
    const quoteMap: Record<string, { price: number }> = {};
    for (const w of watchPool) {
      const { price } = getEffectivePrice(w.code, quotes, undefined);
      if (price > 0) quoteMap[w.code] = { price };
    }
    return compareWatchPoolOpportunity(sideA, watchPool, quoteMap, settings, bPriceMode);
  }, [sideA, watchPool, quotes, settings, bPriceMode]);

  const bAnalysis = selectedWatch
    ? resolveWatchBuyPlan(
        selectedWatch,
        getEffectivePrice(selectedWatch.code, quotes, undefined).price,
        settings,
        bPriceMode,
      ).analysis
    : null;

  const levelCls =
    result.level === 'swap'
      ? 'bg-green-50 text-profit dark:bg-green-950/30'
      : result.level === 'hold'
        ? 'bg-red-50 text-loss dark:bg-red-950/30'
        : 'bg-orange-50 text-warn dark:bg-orange-950/30';

  const aLabel =
    aMode === 'cash'
      ? `闲置现金 ¥${formatMoney(cashAmount)}`
      : aMode === 'position' && selectedPos
        ? `持有 ${selectedPos.name}`
        : '选项 A（当前持有）';

  const bLabel = selectedWatch ? `观察池 · ${selectedWatch.name}` : '选项 B（换仓目标）';

  return (
    <div className="card space-y-4">
      <p className="text-sm text-muted">
        持有的代价 = 放弃的最佳 alternative。可从<strong>观察池</strong>选换仓目标，或用<strong>闲置现金</strong>对比「不动 vs 买一只」。
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="label">选项 A：你在持有什么？</label>
          <select
            className="input"
            value={aMode === 'cash' ? '__cash__' : posId || '__manual__'}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '__cash__') {
                setAMode('cash');
                setCashAmount(cashBalance || cashAmount);
                setPosId('');
              } else if (v === '__manual__') {
                setAMode('manual');
                setPosId('');
              } else {
                loadFromPosition(v);
              }
            }}
          >
            <option value="__cash__">闲置现金（不动 = EV 0）</option>
            <option value="__manual__">手动输入 A</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                持仓 · {p.name} ({p.code})
              </option>
            ))}
          </select>
          {aMode === 'cash' && (
            <p className="mt-1 text-xs text-muted">
              主页可用余额 ¥{formatMoney(cashBalance)} · 空仓观望的机会成本 = 观察池里更好的标的
            </p>
          )}
        </div>
        <div>
          <label className="label">选项 B：从观察池带入</label>
          {watchPool.length === 0 ? (
            <p className="text-sm text-muted">
              观察池为空 → <Link to="/watch" className="text-blue-600 underline">先去建 5 只观察标的</Link>
            </p>
          ) : (
            <>
              <select className="input" value={watchId} onChange={(e) => loadFromWatch(e.target.value)}>
                <option value="">手动输入 B</option>
                {watchPool.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code}) · 触发 ¥{formatMoney(w.triggerPrice)}
                  </option>
                ))}
              </select>
              {selectedWatch && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <select
                    className="input max-w-[140px] text-xs"
                    value={bPriceMode}
                    onChange={(e) => {
                      const mode = e.target.value as BPriceMode;
                      setBPriceMode(mode);
                      applyWatchToB(selectedWatch, mode);
                    }}
                  >
                    <option value="trigger">按计划触发价</option>
                    <option value="current">按现价</option>
                  </select>
                  {bAnalysis && (
                    <span className="text-xs text-muted">
                      {bAnalysis.positionLabel} · EV {formatPct(bAnalysis.ev)} · {SIGNAL_SHORT[bAnalysis.signal]}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border p-3">
          <h3 className="font-medium">{aLabel}</h3>
          {aMode === 'cash' ? (
            <>
              <PortfolioMetricSelect
                label="闲置资金（选项 A）"
                metricKey={cashMetricKey}
                onMetricKeyChange={setCashMetricKey}
                customValue={customCash}
                onCustomValueChange={setCustomCash}
                onResolvedChange={setCashAmount}
                allowedKeys={['cashBalance', 'totalAssets', 'stockMarketValue', 'custom']}
                hint="现金不动 EV=0%，选你要拿来对比的可用资金"
              />
              <p className="text-xs text-muted">当前对比金额 ¥{formatMoney(cashAmount)}</p>
            </>
          ) : (
            <>
              <Field label="当前价/成本" value={aPrice} onChange={setAPrice} step={0.01} />
              <Field label="股数" value={aShares} onChange={setAShares} />
              <BoardSelect board={aBoard} onChange={setABoard} />
              <Field label="上涨概率 (%)" value={aWin} onChange={setAWin} />
              <Field label="预期涨幅 (%)" value={aGain} onChange={setAGain} />
              <Field label="预期跌幅 (%)" value={aLoss} onChange={setALoss} />
            </>
          )}
        </div>
        <div className="space-y-3 rounded-lg border border-border p-3">
          <h3 className="font-medium">{bLabel}</h3>
          {selectedWatch?.reason && (
            <p className="text-xs text-muted line-clamp-2">理由：{selectedWatch.reason}</p>
          )}
          <Field label="计划买入价" value={bPrice} onChange={setBPrice} step={0.01} />
          <Field label="股数" value={bShares} onChange={setBShares} />
          <BoardSelect board={bBoard} onChange={setBBoard} />
          <Field label="上涨概率 (%)" value={bWin} onChange={setBWin} />
          <Field label="预期涨幅 (%)" value={bGain} onChange={setBGain} />
          <Field label="预期跌幅 (%)" value={bLoss} onChange={setBLoss} />
          {selectedWatch && (
            <p className="text-xs text-muted">
              计划上限 ¥{formatMoney(selectedWatch.maxBuyAmount)} · 参数来自观察池，可微调
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <ResultBox title="A 期望值" value={formatPct(result.evA)} sub={aMode === 'cash' ? '现金=0%' : undefined} />
        <ResultBox title="B 期望值" value={formatPct(result.evB)} />
        <ResultBox
          title="EV 差值 (B-A)"
          value={formatPct(result.evDiff)}
          highlight={result.evDiff > 0 ? 'profit' : result.evDiff < 0 ? 'loss' : undefined}
        />
        <ResultBox
          title={swap.label}
          value={`¥${formatMoney(swap.total)}`}
          sub={`占投入 ${formatPct(result.swapCostPct)}`}
        />
      </div>

      <ResultBox
        title="调整后 EV 差值（扣除换仓/买入成本）"
        value={formatPct(result.evDiffAdjusted)}
        sub="一次性手续费折算为百分比"
      />

      <div className={`rounded-lg p-3 text-sm ${levelCls}`}>
        {result.level === 'swap' ? '✅' : result.level === 'hold' ? '❌' : '⚠️'} {result.text}
      </div>

      {watchPool.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-sm">观察池排名：谁最值得换仓/出手？</h3>
          <p className="text-xs text-muted">
            按「调整后 EV 差值」排序 · 使用与上方相同的 A 方案 · 买入价按「{bPriceMode === 'trigger' ? '触发价' : '现价'}」
          </p>
          {watchRankings.length === 0 ? (
            <p className="text-sm text-muted">暂无有效对比（请检查观察池计划买入金额与股价）。</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-left text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2">标的</th>
                    <th className="px-3 py-2">位置</th>
                    <th className="px-3 py-2">B EV</th>
                    <th className="px-3 py-2">EV 差(调)</th>
                    <th className="px-3 py-2">信号</th>
                    <th className="px-3 py-2">建议</th>
                  </tr>
                </thead>
                <tbody>
                  {watchRankings.map((row, i) => (
                    <tr
                      key={row.id}
                      className={`border-t border-border ${row.id === watchId ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
                    >
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-left text-blue-600 hover:underline"
                          onClick={() => loadFromWatch(row.id)}
                        >
                          {i + 1}. {row.name}
                        </button>
                        <div className="text-xs text-muted">{row.code} · ¥{formatMoney(row.bPrice)}</div>
                      </td>
                      <td className="px-3 py-2">{row.analysis.positionLabel}</td>
                      <td className="px-3 py-2">{formatPct(row.evB)}</td>
                      <td className={`px-3 py-2 font-medium ${pnlColor(row.evDiffAdjusted)}`}>
                        {formatPct(row.evDiffAdjusted)}
                      </td>
                      <td className="px-3 py-2">{SIGNAL_SHORT[row.analysis.signal]}</td>
                      <td className="px-3 py-2 text-xs">
                        {row.level === 'swap' ? '值得考虑' : row.level === 'hold' ? '不如持有A' : '差不多'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
