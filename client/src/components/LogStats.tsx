import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { analyzeLogs, filterLogsByTag } from '../utils/logAnalytics';
import type { TradeLog } from '../types';

const COLORS = ['#2563eb', '#16a34a', '#ea580c', '#9333ea', '#dc2626', '#0891b2'];

interface LogStatsProps {
  logs: TradeLog[];
  onFilterTag: (tag: string | null) => void;
  activeTag: string | null;
}

export default function LogStats({ logs, onFilterTag, activeTag }: LogStatsProps) {
  const stats = useMemo(() => analyzeLogs(logs), [logs]);

  if (logs.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">复盘统计</h2>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard title="总操作" value={String(stats.total)} />
        <StatCard title="买入/加仓" value={String(stats.buyCount)} />
        <StatCard title="卖出/减仓" value={String(stats.sellCount)} />
        <StatCard title="模糊理由" value={String(stats.vagueCount)} sub="含感觉/应该等" />
      </div>

      {stats.insights.length > 0 && (
        <div className="card space-y-2 border-warn/30">
          <h3 className="font-medium text-warn">复盘提示</h3>
          {stats.insights.map((t, i) => (
            <p key={i} className="text-sm">{t}</p>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {stats.monthly.length > 0 && (
          <div className="card">
            <h3 className="mb-2 font-medium">按月操作频次</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.monthly}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {stats.actionDist.length > 0 && (
          <div className="card">
            <h3 className="mb-2 font-medium">操作类型分布</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={stats.actionDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                  {stats.actionDist.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {stats.topTags.length > 0 && (
        <div className="card">
          <h3 className="mb-2 font-medium">理由关键词</h3>
          <div className="flex flex-wrap gap-2">
            {stats.topTags.map(({ tag, count }) => (
              <button
                key={tag}
                type="button"
                onClick={() => onFilterTag(activeTag === tag ? null : tag)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  activeTag === tag
                    ? 'bg-blue-600 text-white'
                    : 'bg-surface-2 text-text hover:bg-blue-100 dark:hover:bg-blue-950'
                }`}
              >
                {tag} ({count})
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <div className="text-xs text-muted">{title}</div>
      <div className="text-xl font-bold">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

export { filterLogsByTag };
