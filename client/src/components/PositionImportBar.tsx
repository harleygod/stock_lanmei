import type { Position } from '../types';

interface PositionImportBarProps {
  positions: Position[];
  onImport: (position: Position) => void;
}

export default function PositionImportBar({ positions, onImport }: PositionImportBarProps) {
  if (positions.length === 0) return null;

  return (
    <div className="card flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[200px]">
        <label className="label">从持仓一键带入</label>
        <select
          className="input"
          defaultValue=""
          onChange={(e) => {
            const p = positions.find((x) => x.id === e.target.value);
            if (p) onImport(p);
            e.target.value = '';
          }}
        >
          <option value="" disabled>
            选择股票…
          </option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.code}) · ¥{p.costPrice} × {p.shares}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-muted pb-2">带入成本价、股数、板块到当前计算器</p>
    </div>
  );
}
