import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { usePortfolio } from '../hooks/usePortfolio';
import { getEffectivePrice, useStockQuotes } from '../hooks/useStockQuotes';
import { herfindahlIndex, positionMetrics } from '../utils/calculations';
import { formatMoney, formatPct, pnlColor, uid } from '../utils/format';
import { boardLabel, inferBoard, isShanghai } from '../utils/stockCode';
import type { Board, Position } from '../types';

const COLORS = ['#2563eb', '#16a34a', '#ea580c', '#9333ea', '#0891b2', '#dc2626', '#64748b'];

function weightColor(w: number) {
  if (w >= 35) return '#dc2626';
  if (w >= 20) return '#ea580c';
  return '#16a34a';
}

export default function HomePage() {
  const { data, positions, portfolio, cashBalance, updatePortfolio, setCashBalance } = usePortfolio();
  const codes = positions.map((p) => p.code);
  const { quotes, loading, error, manualMode, refresh } = useStockQuotes(
    codes,
    data.settings.refreshIntervalSec,
  );

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    costPrice: '',
    shares: '',
    board: 'sz_main' as Board,
    note: '',
  });

  const enriched = useMemo(() => {
    const items = positions.map((p) => {
      const { price, isClosed, source } = getEffectivePrice(p.code, quotes, p.manualPrice);
      return { position: p, price, isClosed, source };
    });
    const stockMarketValue = items.reduce((s, i) => s + i.price * i.position.shares, 0);
    const totalAssets = stockMarketValue + cashBalance;
    return items.map((i) => ({
      ...i,
      metrics: positionMetrics(
        i.position.costPrice,
        i.price,
        i.position.shares,
        i.position.board,
        data.settings,
        totalAssets,
      ),
    }));
  }, [positions, data.settings, quotes, cashBalance]);

  const totalInvest = enriched.reduce((s, e) => s + e.metrics.buyCost, 0);
  const totalValue = enriched.reduce((s, e) => s + e.metrics.marketValue, 0);
  const totalAssets = totalValue + cashBalance;
  const cashWeight = totalAssets > 0 ? (cashBalance / totalAssets) * 100 : 0;
  const totalPnl = enriched.reduce((s, e) => s + e.metrics.pnl, 0);
  const totalPnlPct = totalInvest > 0 ? (totalPnl / totalInvest) * 100 : 0;
  const hhiWeights = [...enriched.map((e) => e.metrics.marketValue), ...(cashBalance > 0 ? [cashBalance] : [])];
  const hhi = herfindahlIndex(hhiWeights);

  const pieData = [
    ...enriched.map((e) => ({
      name: e.position.name || e.position.code,
      value: e.metrics.marketValue,
      weight: e.metrics.weight,
    })),
    ...(cashBalance > 0
      ? [{ name: '现金', value: cashBalance, weight: cashWeight }]
      : []),
  ];

  const barData = [
    ...enriched.map((e) => ({
      name: (e.position.name || e.position.code).slice(0, 6),
      weight: e.metrics.weight,
      fill: weightColor(e.metrics.weight),
    })),
    ...(cashBalance > 0
      ? [{ name: '现金', weight: cashWeight, fill: '#64748b' }]
      : []),
  ];

  const warnings = enriched.flatMap((e) => {
    const w: string[] = [];
    const label = e.position.name || e.position.code;
    if (e.metrics.weight > 30) {
      w.push(`⚠️ ${label} 仓位占比 ${formatPct(e.metrics.weight)}，集中风险高，建议控制在 20-25%`);
    }
    if (e.metrics.pnlPct < -15) {
      w.push(
        `📉 ${label} 当前亏损 ${formatPct(e.metrics.pnlPct)}，回本需上涨 ${formatPct(e.metrics.breakEvenGainPct)}，请评估止损`,
      );
    }
    return w;
  });

  const addPosition = () => {
    const code = form.code.replace(/\D/g, '');
    if (!code || !form.costPrice || !form.shares) return;
    const pos: Position = {
      id: uid(),
      name: form.name || code,
      code,
      costPrice: parseFloat(form.costPrice),
      shares: parseInt(form.shares, 10),
      board: form.board || inferBoard(code),
      note: form.note,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updatePortfolio((p) => ({ ...p, positions: [...p.positions, pos] }));
    setForm({ name: '', code: '', costPrice: '', shares: '', board: 'sz_main', note: '' });
    setShowForm(false);
  };

  const removePosition = (id: string) => {
    if (!confirm('删除该持仓？')) return;
    updatePortfolio((p) => ({ ...p, positions: p.positions.filter((x) => x.id !== id) }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">持仓总览 · {portfolio.name}</h1>
        <div className="flex gap-2">
          <button type="button" onClick={refresh} className="btn-ghost text-xs" disabled={loading}>
            {loading ? '刷新中…' : '刷新行情'}
          </button>
          <button type="button" onClick={() => setShowForm(!showForm)} className="btn-primary text-xs">
            + 添加持仓
          </button>
        </div>
      </div>

      {(error || manualMode) && (
        <div className="rounded-lg border border-warn/30 bg-orange-50 px-3 py-2 text-sm text-warn dark:bg-orange-950/30">
          {error || '手动模式：可在持仓中覆盖现价'}
        </div>
      )}

      {showForm && (
        <div className="card grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">股票代码</label>
            <input
              className="input"
              value={form.code}
              onChange={(e) => {
                const code = e.target.value;
                setForm({ ...form, code, board: inferBoard(code) });
              }}
              placeholder="如 002475 / 600519"
            />
            {form.code.replace(/\D/g, '').length >= 3 && (
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 font-medium ${isShanghai(form.board) ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'}`}>
                  {isShanghai(form.board) ? '上海' : '深圳'}
                </span>
                <span className="text-muted">{boardLabel(form.board)}</span>
                <span className="text-muted">· 自动识别</span>
              </div>
            )}
          </div>
          <div>
            <label className="label">名称（选填）</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={form.code.replace(/\D/g, '') || ''} />
          </div>
          <div>
            <label className="label">成本价（元）</label>
            <input className="input" type="number" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
          </div>
          <div>
            <label className="label">持仓股数</label>
            <input className="input" type="number" value={form.shares} onChange={(e) => setForm({ ...form, shares: e.target.value })} />
          </div>
          <div>
            <label className="label">板块（可手动覆盖）</label>
            <select className="input" value={form.board} onChange={(e) => setForm({ ...form, board: e.target.value as Board })}>
              {(['sh_main', 'sz_main', 'gem', 'star', 'bse'] as Board[]).map((b) => (
                <option key={b} value={b}>{boardLabel(b)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button type="button" onClick={addPosition} className="btn-primary w-full">保存</button>
          </div>
        </div>
      )}

      <div className="card flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label className="label">可用余额（元）</label>
          <input
            className="input"
            type="number"
            min={0}
            step={0.01}
            value={cashBalance || ''}
            placeholder="0"
            onChange={(e) => setCashBalance(parseFloat(e.target.value) || 0)}
          />
        </div>
        <p className="pb-2 text-xs text-muted">
          仓位占比 = 个股市值 ÷（持仓市值 + 余额）
          <Link to="/guide" className="ml-1 text-blue-600">使用说明</Link>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard title="总投入" value={`¥${formatMoney(totalInvest)}`} sub="含买入手续费" />
        <StatCard title="当前市值" value={`¥${formatMoney(totalValue)}`} />
        <StatCard title="可用余额" value={`¥${formatMoney(cashBalance)}`} sub={cashWeight > 0 ? formatPct(cashWeight) : undefined} />
        <StatCard title="总资产" value={`¥${formatMoney(totalAssets)}`} sub="市值 + 余额" />
        <StatCard
          title="总盈亏"
          value={`¥${formatMoney(totalPnl)}`}
          sub={formatPct(totalPnlPct)}
          subClass={pnlColor(totalPnl)}
        />
        <StatCard title="持股 / 集中度" value={`${positions.length} 只`} sub={`HHI ${(hhi * 100).toFixed(1)}%`} />
      </div>

      {positions.length === 0 ? (
        <div className="card space-y-2 text-center text-muted py-12">
          <p>暂无持仓，点击「添加持仓」开始</p>
          <p className="text-sm">
            别忘了填写上方「可用余额」，仓位占比才准确。
            <Link to="/guide" className="ml-1 text-blue-600">查看使用说明</Link>
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="pb-2">股票</th>
                <th>成本/现价</th>
                <th>盈亏</th>
                <th>仓位</th>
                <th>回本需涨</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {enriched.map((e) => (
                <tr key={e.position.id} className="border-b border-border/50">
                  <td className="py-3">
                    <Link to={`/position/${e.position.id}`} className="font-medium text-blue-600">
                      {e.position.name}
                    </Link>
                    <div className="text-xs text-muted">{e.position.code}</div>
                    {e.isClosed && <span className="text-xs text-muted">已收盘</span>}
                  </td>
                  <td>
                    <div>{formatMoney(e.position.costPrice)}</div>
                    <div className={pnlColor(e.price - e.position.costPrice)}>{formatMoney(e.price)}</div>
                  </td>
                  <td className={pnlColor(e.metrics.pnl)}>
                    {formatMoney(e.metrics.pnl)}
                    <div className="text-xs">{formatPct(e.metrics.pnlPct)}</div>
                  </td>
                  <td>{formatPct(e.metrics.weight)}</td>
                  <td className="text-warn">
                    {e.metrics.pnl < 0 ? formatPct(e.metrics.breakEvenGainPct) : '—'}
                  </td>
                  <td>
                    <button type="button" className="text-xs text-loss" onClick={() => removePosition(e.position.id)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pieData.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card">
            <h2 className="mb-2 font-semibold">仓位分布</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name} ${e.weight.toFixed(0)}%`}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `¥${formatMoney(v)}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <h2 className="mb-2 font-semibold">仓位风险条</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} layout="vertical">
                <XAxis type="number" domain={[0, 100]} unit="%" />
                <YAxis type="category" dataKey="name" width={60} />
                <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                <Bar dataKey="weight" radius={4} />
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs text-muted">绿 &lt;20% · 黄 20-35% · 红 &gt;35%</p>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="card space-y-2 border-warn/40">
          <h2 className="font-semibold text-warn">风险提醒</h2>
          {warnings.map((w, i) => (
            <p key={i} className="text-sm">{w}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, sub, subClass }: { title: string; value: string; sub?: string; subClass?: string }) {
  return (
    <div className="card">
      <div className="text-xs text-muted">{title}</div>
      <div className="text-lg font-bold">{value}</div>
      {sub && <div className={`text-sm ${subClass ?? 'text-muted'}`}>{sub}</div>}
    </div>
  );
}
