import { useEffect, useMemo, useState } from 'react';
import { usePortfolio } from '../../hooks/usePortfolio';
import { opportunityCostCompare, swapCost } from '../../utils/calculations';
import { formatMoney, formatPct } from '../../utils/format';
import { BoardSelect, Field, ResultBox, type CalcSettings } from './Shared';
import type { Board } from '../../types';

export default function OpportunityCostTab({ settings }: { settings: CalcSettings }) {
  const { positions } = usePortfolio();
  const [posId, setPosId] = useState('');

  const [aWin, setAWin] = useState(50);
  const [aGain, setAGain] = useState(12);
  const [aLoss, setALoss] = useState(8);
  const [aPrice, setAPrice] = useState(10);
  const [aShares, setAShares] = useState(1000);
  const [aBoard, setABoard] = useState<Board>('sz_main');

  const [bWin, setBWin] = useState(55);
  const [bGain, setBGain] = useState(18);
  const [bLoss, setBLoss] = useState(10);
  const [bPrice, setBPrice] = useState(15);
  const [bShares, setBShares] = useState(800);
  const [bBoard, setBBoard] = useState<Board>('sz_main');

  const selected = positions.find((p) => p.id === posId);

  const loadFromPosition = (id: string) => {
    setPosId(id);
    const p = positions.find((x) => x.id === id);
    if (!p) return;
    setAPrice(p.costPrice);
    setAShares(p.shares);
    setABoard(p.board);
  };

  const swap = swapCost(aPrice, aShares, aBoard, bPrice, bShares, bBoard, settings);
  const invested = aPrice * aShares;
  const result = useMemo(
    () => opportunityCostCompare(aWin, aGain, aLoss, bWin, bGain, bLoss, invested, swap.total),
    [aWin, aGain, aLoss, bWin, bGain, bLoss, invested, swap.total],
  );

  const levelCls =
    result.level === 'swap'
      ? 'bg-green-50 text-profit dark:bg-green-950/30'
      : result.level === 'hold'
        ? 'bg-red-50 text-loss dark:bg-red-950/30'
        : 'bg-orange-50 text-warn dark:bg-orange-950/30';

  return (
    <div className="card space-y-4">
      <p className="text-sm text-muted">
        持有的代价 = 放弃的最佳 alternative。比较持有 A 与换仓 B，哪个期望值更高。
      </p>

      {positions.length > 0 && (
        <div>
          <label className="label">从持仓快速带入 A</label>
          <select className="input max-w-md" value={posId} onChange={(e) => loadFromPosition(e.target.value)}>
            <option value="">手动输入</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
          {selected && (
            <p className="mt-1 text-xs text-muted">已带入 {selected.name} 成本价与股数</p>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border p-3">
          <h3 className="font-medium">选项 A（当前持有）</h3>
          <Field label="当前价/成本" value={aPrice} onChange={setAPrice} step={0.01} />
          <Field label="股数" value={aShares} onChange={setAShares} />
          <BoardSelect board={aBoard} onChange={setABoard} />
          <Field label="上涨概率 (%)" value={aWin} onChange={setAWin} />
          <Field label="预期涨幅 (%)" value={aGain} onChange={setAGain} />
          <Field label="预期跌幅 (%)" value={aLoss} onChange={setALoss} />
        </div>
        <div className="space-y-3 rounded-lg border border-border p-3">
          <h3 className="font-medium">选项 B（换仓目标）</h3>
          <Field label="计划买入价" value={bPrice} onChange={setBPrice} step={0.01} />
          <Field label="股数" value={bShares} onChange={setBShares} />
          <BoardSelect board={bBoard} onChange={setBBoard} />
          <Field label="上涨概率 (%)" value={bWin} onChange={setBWin} />
          <Field label="预期涨幅 (%)" value={bGain} onChange={setBGain} />
          <Field label="预期跌幅 (%)" value={bLoss} onChange={setBLoss} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <ResultBox title="A 期望值" value={formatPct(result.evA)} />
        <ResultBox title="B 期望值" value={formatPct(result.evB)} />
        <ResultBox
          title="EV 差值 (B-A)"
          value={formatPct(result.evDiff)}
          highlight={result.evDiff > 0 ? 'profit' : result.evDiff < 0 ? 'loss' : undefined}
        />
        <ResultBox title="换仓手续费" value={`¥${formatMoney(result.swapFeeTotal)}`} sub={`占投入 ${formatPct(result.swapCostPct)}`} />
      </div>

      <ResultBox
        title="调整后 EV 差值（扣除换仓成本）"
        value={formatPct(result.evDiffAdjusted)}
        sub="一次性手续费折算为百分比"
      />

      <div className={`rounded-lg p-3 text-sm ${levelCls}`}>
        {result.level === 'swap' ? '✅' : result.level === 'hold' ? '❌' : '⚠️'} {result.text}
      </div>
    </div>
  );
}
