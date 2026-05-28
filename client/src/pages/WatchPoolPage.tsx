import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio } from '../hooks/usePortfolio';
import { usePortfolioMetrics } from '../hooks/usePortfolioMetrics';
import { getEffectivePrice, useStockQuotes } from '../hooks/useStockQuotes';
import { watchPoolAnalysis } from '../utils/calculations';
import { MAX_WATCH_POOL } from '../utils/constants';
import { positionToWatchDraft } from '../utils/stockBridge';
import { formatMoney, formatPct, pnlColor, uid } from '../utils/format';
import { boardLabel, inferBoard, isShanghai } from '../utils/stockCode';
import type { Board, WatchItem } from '../types';

const SIGNAL_LABEL: Record<string, { text: string; cls: string }> = {
  ready: { text: '可买入', cls: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  near: { text: '接近触发', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  wait: { text: '继续观望', cls: 'bg-surface-2 text-muted' },
  high: { text: '偏高慎入', cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
};

const POSITION_CLS: Record<string, string> = {
  低位: 'text-profit',
  中位: 'text-muted',
  高位: 'text-warn',
};

const EMPTY_FORM = {
  name: '',
  code: '',
  board: 'sz_main' as Board,
  reason: '',
  triggerPrice: '',
  refLow: '',
  refHigh: '',
  winProb: '55',
  gainPct: '15',
  lossPct: '8',
  maxBuyAmount: '3000',
};

export default function WatchPoolPage() {
  const { data, portfolio, cashBalance, positions, updatePortfolio, isInWatchPool } = usePortfolio();
  const { quotes: posQuotes } = usePortfolioMetrics();
  const watchPool = portfolio.watchPool ?? [];
  const codes = watchPool.map((w) => w.code);
  const { quotes, loading, error, refresh } = useStockQuotes(codes, data.settings.refreshIntervalSec);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const enriched = useMemo(
    () =>
      watchPool.map((item) => {
        const { price } = getEffectivePrice(item.code, quotes, undefined);
        const analysis =
          price > 0
            ? watchPoolAnalysis(item, price, item.board, data.settings)
            : null;
        return { item, price, analysis };
      }),
    [watchPool, quotes, data.settings],
  );

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(false);
  };

  const openEdit = (item: WatchItem) => {
    setEditId(item.id);
    setForm({
      name: item.name,
      code: item.code,
      board: item.board,
      reason: item.reason,
      triggerPrice: String(item.triggerPrice),
      refLow: item.refLow != null ? String(item.refLow) : '',
      refHigh: item.refHigh != null ? String(item.refHigh) : '',
      winProb: String(item.winProb),
      gainPct: String(item.gainPct),
      lossPct: String(item.lossPct),
      maxBuyAmount: String(item.maxBuyAmount),
    });
    setShowForm(true);
  };

  const saveItem = () => {
    const code = form.code.replace(/\D/g, '');
    const triggerPrice = parseFloat(form.triggerPrice);
    if (!code || !triggerPrice) return;

    const now = new Date().toISOString();
    const payload: WatchItem = {
      id: editId ?? uid(),
      name: form.name || code,
      code,
      board: form.board || inferBoard(code),
      reason: form.reason.trim(),
      triggerPrice,
      refLow: form.refLow ? parseFloat(form.refLow) : undefined,
      refHigh: form.refHigh ? parseFloat(form.refHigh) : undefined,
      winProb: parseFloat(form.winProb) || 55,
      gainPct: parseFloat(form.gainPct) || 15,
      lossPct: parseFloat(form.lossPct) || 8,
      maxBuyAmount: parseFloat(form.maxBuyAmount) || 3000,
      createdAt: editId ? watchPool.find((w) => w.id === editId)?.createdAt ?? now : now,
      updatedAt: now,
    };

    updatePortfolio((p) => {
      const pool = p.watchPool ?? [];
      if (editId) {
        return { ...p, watchPool: pool.map((w) => (w.id === editId ? payload : w)) };
      }
      if (pool.length >= MAX_WATCH_POOL) return p;
      return { ...p, watchPool: [...pool, payload] };
    });
    resetForm();
  };

  const addFromPosition = (positionId: string) => {
    const p = positions.find((x) => x.id === positionId);
    if (!p || isInWatchPool(p.code)) return;
    const { price } = getEffectivePrice(p.code, posQuotes, p.manualPrice);
    const draft = positionToWatchDraft(p, price);
    const now = new Date().toISOString();
    updatePortfolio((pf) => {
      const pool = pf.watchPool ?? [];
      if (pool.length >= MAX_WATCH_POOL) return pf;
      return {
        ...pf,
        watchPool: [...pool, { ...draft, id: uid(), createdAt: now, updatedAt: now }],
      };
    });
  };

  const removeItem = (id: string) => {
    if (!confirm('从观察池移除？')) return;
    updatePortfolio((p) => ({
      ...p,
      watchPool: (p.watchPool ?? []).filter((w) => w.id !== id),
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">观察池</h1>
          <p className="text-sm text-muted">
            先建目标再行动 · 最多 {MAX_WATCH_POOL} 只 · 可用现金 ¥{formatMoney(cashBalance)}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={refresh} className="btn-ghost text-xs" disabled={loading}>
            {loading ? '刷新中…' : '刷新行情'}
          </button>
          <button
            type="button"
            className="btn-primary text-xs"
            disabled={watchPool.length >= MAX_WATCH_POOL && !editId}
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            + 加入观察
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-2 text-sm dark:border-blue-900 dark:bg-blue-950/20">
        <strong className="text-text">怎么用：</strong>
        周末选 {MAX_WATCH_POOL} 只靠谱标的，写下理由和<strong>买入触发价</strong>；周一设定「这周必须买一只，仓位不超过
        ¥3000」。到价 + 期望值正 + 处于低位 → 才动手，避免空仓看别人涨。
      </div>

      {positions.length > 0 && watchPool.length < MAX_WATCH_POOL && (
        <div className="card flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="label">从持仓快速加入观察池</label>
            <select
              className="input"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) addFromPosition(e.target.value);
                e.target.value = '';
              }}
            >
              <option value="" disabled>选择持仓…</option>
              {positions
                .filter((p) => !isInWatchPool(p.code))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code}) · 成本 ¥{formatMoney(p.costPrice)}
                  </option>
                ))}
            </select>
          </div>
          <p className="pb-2 text-xs text-muted">自动带入成本价、板块，触发价默认 min(成本,现价)</p>
        </div>
      )}

      {(error) && (
        <div className="rounded-lg border border-warn/30 bg-orange-50 px-3 py-2 text-sm text-warn dark:bg-orange-950/30">
          {error}
        </div>
      )}

      {showForm && (
        <div className="card space-y-3">
          <h2 className="font-medium">{editId ? '编辑观察标的' : '新增观察标的'}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">股票代码</label>
              <input
                className="input"
                value={form.code}
                onChange={(e) => {
                  const code = e.target.value;
                  setForm({ ...form, code, board: inferBoard(code) });
                }}
                placeholder="如 600690 / 002475"
              />
              {form.code.replace(/\D/g, '').length >= 3 && (
                <div className="mt-1 text-xs text-muted">
                  {isShanghai(form.board) ? '上海' : '深圳'} · {boardLabel(form.board)}
                </div>
              )}
            </div>
            <div>
              <label className="label">名称（可选）</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="海尔智家" />
            </div>
            <div className="md:col-span-2">
              <label className="label">选入理由</label>
              <textarea
                className="input min-h-[72px]"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="白电龙头，PE 合理，业绩稳定…"
              />
            </div>
            <div>
              <label className="label">买入触发价 (元)</label>
              <input className="input" type="number" step="0.01" value={form.triggerPrice} onChange={(e) => setForm({ ...form, triggerPrice: e.target.value })} placeholder="19.00" />
            </div>
            <div>
              <label className="label">计划最大买入 (元)</label>
              <input className="input" type="number" value={form.maxBuyAmount} onChange={(e) => setForm({ ...form, maxBuyAmount: e.target.value })} />
            </div>
            <div>
              <label className="label">区间低点 (可选)</label>
              <input className="input" type="number" step="0.01" value={form.refLow} onChange={(e) => setForm({ ...form, refLow: e.target.value })} placeholder="不填则按触发价推算" />
            </div>
            <div>
              <label className="label">区间高点 (可选)</label>
              <input className="input" type="number" step="0.01" value={form.refHigh} onChange={(e) => setForm({ ...form, refHigh: e.target.value })} placeholder="不填则按触发价推算" />
            </div>
            <div>
              <label className="label">上涨概率 (%)</label>
              <input className="input" type="number" value={form.winProb} onChange={(e) => setForm({ ...form, winProb: e.target.value })} />
            </div>
            <div>
              <label className="label">预期涨幅 / 跌幅 (%)</label>
              <div className="flex gap-2">
                <input className="input" type="number" value={form.gainPct} onChange={(e) => setForm({ ...form, gainPct: e.target.value })} placeholder="涨" />
                <input className="input" type="number" value={form.lossPct} onChange={(e) => setForm({ ...form, lossPct: e.target.value })} placeholder="跌" />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-primary text-sm" onClick={saveItem}>保存</button>
            <button type="button" className="btn-ghost text-sm" onClick={resetForm}>取消</button>
          </div>
        </div>
      )}

      {watchPool.length === 0 ? (
        <div className="card py-12 text-center text-muted">
          观察池为空。周末花 30 分钟选 {MAX_WATCH_POOL} 只票，写下理由和触发价，打破「不知道买什么」的循环。
        </div>
      ) : (
        <div className="space-y-3">
          {enriched.map(({ item, price, analysis }) => {
            const sig = analysis ? SIGNAL_LABEL[analysis.signal] : null;
            return (
              <div key={item.id} className="card space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-bold">{item.name}</span>
                      <span className="text-sm text-muted">{item.code}</span>
                      {sig && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sig.cls}`}>
                          {sig.text}
                        </span>
                      )}
                    </div>
                    {item.reason && <p className="mt-1 text-sm text-muted">{item.reason}</p>}
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button type="button" className="btn-ghost" onClick={() => openEdit(item)}>编辑</button>
                    <button type="button" className="btn-ghost text-loss" onClick={() => removeItem(item.id)}>移除</button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat label="现价" value={price > 0 ? `¥${formatMoney(price)}` : '—'} />
                  <Stat label="触发价" value={`¥${formatMoney(item.triggerPrice)}`} sub={analysis?.atOrBelowTrigger ? '已到/低于触发' : analysis ? `还差 ${formatPct(analysis.gapToTriggerPct)}` : undefined} />
                  <Stat
                    label="位置评估"
                    value={analysis?.positionLabel ?? '—'}
                    valueCls={analysis ? POSITION_CLS[analysis.positionLabel] : undefined}
                    sub={analysis ? `区间 ${formatMoney(analysis.refLow)} ~ ${formatMoney(analysis.refHigh)}` : undefined}
                  />
                  <Stat
                    label="期望值 EV"
                    value={analysis ? formatPct(analysis.ev) : '—'}
                    valueCls={analysis ? pnlColor(analysis.ev) : undefined}
                    sub={analysis ? analysis.advice.text : undefined}
                  />
                </div>

                {analysis && (
                  <div className="grid gap-3 sm:grid-cols-3 rounded-lg bg-surface-2 p-3 text-sm">
                    <div>
                      <span className="text-muted">入场评分 </span>
                      <span className="font-medium">{analysis.entryScore}/100</span>
                    </div>
                    <div>
                      <span className="text-muted">盈亏比 </span>
                      <span>{analysis.ratio.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted">建议股数 </span>
                      <span>
                        {analysis.suggestedShares
                          ? `${analysis.suggestedShares} 股 · 约 ¥${formatMoney(analysis.estBuyAmount ?? 0)}`
                          : '—'}
                      </span>
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted">
                  公式：入场评分 = 触发价距离 + 期望值 EV + 高低位（低位加分）。到价且 EV≥0 且非高位 → 可买入。
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  valueCls,
}: {
  label: string;
  value: string;
  sub?: string;
  valueCls?: string;
}) {
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-lg font-bold ${valueCls ?? ''}`}>{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}
