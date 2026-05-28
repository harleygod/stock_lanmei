import { useRef } from 'react';
import { useAppContext } from '../hooks/useAppContext';

export default function SettingsPage() {
  const { data, update, exportJson, importJson, clearAll } = useAppContext();
  const fileRef = useRef<HTMLInputElement>(null);
  const s = data.settings;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">设置</h1>

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
