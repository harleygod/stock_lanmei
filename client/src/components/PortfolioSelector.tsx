import { usePortfolio } from '../hooks/usePortfolio';

export default function PortfolioSelector() {
  const { portfolios, activePortfolioId, switchPortfolio } = usePortfolio();

  if (portfolios.length <= 1) {
    return (
      <span className="hidden text-xs text-muted md:inline">
        {portfolios[0]?.name ?? '默认组合'}
      </span>
    );
  }

  return (
    <select
      className="hidden max-w-[120px] rounded border border-border bg-surface px-2 py-1 text-xs md:inline"
      value={activePortfolioId}
      onChange={(e) => switchPortfolio(e.target.value)}
    >
      {portfolios.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
