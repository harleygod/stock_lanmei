import type { Board, AppSettings } from '../types';
import { boardLabel } from '../utils/stockCode';

export function Field({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}

export function BoardSelect({
  board,
  onChange,
}: {
  board: Board;
  onChange: (b: Board) => void;
}) {
  return (
    <div>
      <label className="label">交易所</label>
      <select className="input" value={board} onChange={(e) => onChange(e.target.value as Board)}>
        {(['sh_main', 'sz_main', 'gem', 'star', 'bse'] as Board[]).map((b) => (
          <option key={b} value={b}>
            {boardLabel(b)}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ResultBox({
  title,
  value,
  sub,
  highlight,
}: {
  title: string;
  value: string;
  sub?: string;
  highlight?: 'profit' | 'loss';
}) {
  const cls = highlight === 'profit' ? 'text-profit' : highlight === 'loss' ? 'text-loss' : '';
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <div className="text-xs text-muted">{title}</div>
      <div className={`text-xl font-bold ${cls}`}>{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

export type CalcSettings = AppSettings;
