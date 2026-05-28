import { useRef, useState } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { usePortfolio } from '../hooks/usePortfolio';
import { createDefaultPortfolio } from '../types';

export default function SettingsPage() {
  const { exportJson, importJson, clearAll } = useAppContext();
  const { data, update, portfolios, activePortfolioId, switchPortfolio } = usePortfolio();
  const fileRef = useRef<HTMLInputElement>(null);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const s = data.settings;

  const addPortfolio = () => {
    const name = newPortfolioName.trim() || `组合 ${portfolios.length + 1}`;
    const p = createDefaultPortfolio(name);
    update((d) => ({
      ...d,
      portfolios: [...d.portfolios, p],
      activePortfolioId: p.id,
    }));
    setNewPortfolioName('');
  };

  const renamePortfolio = (id: string, name: string) => {
    update((d) => ({
      ...d,
      portfolios: d.portfolios.map((p) => (p.id === id ? { ...p, name } : p)),
    }));
  };

  const deletePortfolio = (id: string) => {
    if (portfolios.length <= 1) {
      alert('至少保留一个组合');
      return;
    }
    if (!confirm('删除该组合及其全部持仓和日志？')) return;
    update((d) => {
      const next = d.portfolios.filter((p) => p.id !== id);
      return {
        ...d,
        portfolios: next,
        activePortfolioId: d.activePortfolioId === id ? next[0].id : d.activePortfolioId,
        pendingOps: d.pendingOps.filter((op) => op.portfolioId !== id),
      };
    });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">设置</h1>

      <div className="card space-y-4">
        <h2 className="font-semibold">多组合管理</h2>
        <p className="text-sm text-muted">不同账户或策略可拆分为独立组合，数据互不影响</p>
        <div className="space-y-2">
          {portfolios.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 p-2">
              <input
                className="input max-w-[160px] text-sm"
                value={p.name}
                onChange={(e) => renamePortfolio(p.id, e.target.value)}
              />
              <span className="text-xs text-muted">{p.positions.length} 持仓 · {p.logs.length} 日志</span>
              {p.id === activePortfolioId && (
                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300">当前</span>
              )}
              {p.id !== activePortfolioId && (
                <button type="button" className="btn-ghost text-xs" onClick={() => switchPortfolio(p.id)}>
                  切换
                </button>
              )}
              <button type="button" className="text-xs text-loss" onClick={() => deletePortfolio(p.id)}>
                删除
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="input max-w-xs"
            placeholder="新组合名称"
            value={newPortfolioName}
            onChange={(e) => setNewPortfolioName(e.target.value)}
          />
          <button type="button" onClick={addPortfolio} className="btn-primary text-sm">+ 新建组合</button>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">冷静期设置</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={s.cooldownEnabled}
            onChange={(e) =>
              update((d) => ({
                ...d,
                settings: { ...d.settings, cooldownEnabled: e.target.checked },
              }))
            }
          />
          卖出/减仓时启用冷静期（默认开启）
        </label>
        <div>
          <label className="label">冷静期时长（小时）</label>
          <input
            className="input max-w-md"
            type="number"
            min={1}
            max={168}
            value={s.cooldownHours}
            onChange={(e) =>
              update((d) => ({
                ...d,
                settings: { ...d.settings, cooldownHours: Number(e.target.value) || 24 },
              }))
            }
          />
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">费率设置（华宝证券默认）</h2>
        <div>
          <label className="label">佣金费率（如 0.01154% 填 0.0001154）</label>
          <input
            className="input max-w-md"
            type="number"
            step="0.0000001"
            value={s.commissionRate}
            onChange={(e) =>
              update((d) => ({
                ...d,
                settings: { ...d.settings, commissionRate: parseFloat(e.target.value) || 0 },
              }))
            }
          />
          <p className="mt-1 text-xs text-muted">当前约 {(s.commissionRate * 100).toFixed(4)}%</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={s.minCommission}
            onChange={(e) =>
              update((d) => ({
                ...d,
                settings: { ...d.settings, minCommission: e.target.checked },
              }))
            }
          />
          启用最低佣金 5 元
        </label>
        <div>
          <label className="label">印花税（卖出，国家强制）</label>
          <input className="input max-w-md bg-surface-2" disabled value={`${(s.stampTaxRate * 100).toFixed(2)}%`} />
        </div>
        <div>
          <label className="label">行情刷新间隔（秒）</label>
          <input
            className="input max-w-md"
            type="number"
            min={5}
            value={s.refreshIntervalSec}
            onChange={(e) =>
              update((d) => ({
                ...d,
                settings: { ...d.settings, refreshIntervalSec: Number(e.target.value) || 15 },
              }))
            }
          />
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">数据管理</h2>
        <p className="text-sm text-muted">所有数据保存在浏览器 localStorage，请定期导出备份</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportJson} className="btn-primary">导出 JSON</button>
          <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost">导入 JSON</button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJson(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      <div className="card border-red-200 dark:border-red-900">
        <h2 className="font-semibold text-loss">危险区</h2>
        <button type="button" onClick={clearAll} className="btn-ghost mt-2 border-loss text-loss">
          清空所有数据
        </button>
      </div>
    </div>
  );
}
