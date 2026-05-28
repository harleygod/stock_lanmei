import { useMemo, useState } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import LogStats, { filterLogsByTag } from '../components/LogStats';
import { formatMoney, uid } from '../utils/format';
import type { TradeLog } from '../types';

const ACTIONS: TradeLog['action'][] = ['buy', 'sell', 'add', 'reduce'];
const ACTION_LABEL: Record<TradeLog['action'], string> = {
  buy: '买入',
  sell: '卖出',
  add: '加仓',
  reduce: '减仓',
};

export default function LogsPage() {
  const { data, update } = useAppContext();
  const [filterCode, setFilterCode] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    stockName: '',
    stockCode: '',
    action: 'buy' as TradeLog['action'],
    price: '',
    quantity: '',
    fee: '',
    reason: '',
  });

  const filtered = useMemo(() => {
    let list = [...data.logs].sort((a, b) => b.date.localeCompare(a.date));
    if (filterCode) list = list.filter((l) => l.stockCode.includes(filterCode));
    if (filterTag) list = filterLogsByTag(list, filterTag);
    return list;
  }, [data.logs, filterCode, filterTag]);

  const addLog = () => {
    if (!form.stockCode || !form.price || !form.quantity || !form.reason.trim()) {
      alert('请填写完整信息，操作理由必填');
      return;
    }
    const log: TradeLog = {
      id: uid(),
      date: form.date,
      stockName: form.stockName || form.stockCode,
      stockCode: form.stockCode.replace(/\D/g, ''),
      action: form.action,
      price: parseFloat(form.price),
      quantity: parseInt(form.quantity, 10),
      fee: form.fee ? parseFloat(form.fee) : undefined,
      reason: form.reason.trim(),
      createdAt: new Date().toISOString(),
    };
    update((d) => ({ ...d, logs: [log, ...d.logs] }));
    setForm({ ...form, price: '', quantity: '', fee: '', reason: '' });
  };

  const removeLog = (id: string) => {
    if (!confirm('删除该记录？')) return;
    update((d) => ({ ...d, logs: d.logs.filter((l) => l.id !== id) }));
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">交易记录日志</h1>
      <p className="text-sm text-muted">每笔操作必须填写理由，用于复盘、避免情绪化交易</p>

      <div className="card grid gap-3 md:grid-cols-2">
        <div>
          <label className="label">日期</label>
          <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div>
          <label className="label">操作类型</label>
          <select className="input" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value as TradeLog['action'] })}>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{ACTION_LABEL[a]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">股票代码</label>
          <input className="input" value={form.stockCode} onChange={(e) => setForm({ ...form, stockCode: e.target.value })} />
        </div>
        <div>
          <label className="label">股票名称</label>
          <input className="input" value={form.stockName} onChange={(e) => setForm({ ...form, stockName: e.target.value })} />
        </div>
        <div>
          <label className="label">价格</label>
          <input className="input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </div>
        <div>
          <label className="label">数量</label>
          <input className="input" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        </div>
        <div>
          <label className="label">实际手续费（可选）</label>
          <input className="input" type="number" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="label">操作理由 *</label>
          <textarea className="input min-h-[80px]" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="为什么在这个价位做这笔操作？" />
        </div>
        <button type="button" onClick={addLog} className="btn-primary md:col-span-2">记录</button>
      </div>

      <LogStats logs={data.logs} activeTag={filterTag} onFilterTag={setFilterTag} />

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs"
          placeholder="按代码筛选"
          value={filterCode}
          onChange={(e) => setFilterCode(e.target.value.replace(/\D/g, ''))}
        />
        {filterTag && (
          <button type="button" className="btn-ghost text-xs" onClick={() => setFilterTag(null)}>
            清除标签筛选：{filterTag}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center text-muted py-8">暂无记录</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((log) => (
            <div key={log.id} className="card text-sm">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-medium">{log.stockName}</span>
                  <span className="ml-2 text-muted">{log.stockCode}</span>
                  <span className="ml-2 rounded bg-surface-2 px-2 py-0.5 text-xs">{ACTION_LABEL[log.action]}</span>
                </div>
                <button type="button" className="text-xs text-loss" onClick={() => removeLog(log.id)}>删除</button>
              </div>
              <div className="mt-1 text-muted">{log.date} · ¥{formatMoney(log.price)} × {log.quantity}</div>
              <p className="mt-2 border-l-2 border-blue-500 pl-2 italic">{log.reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
