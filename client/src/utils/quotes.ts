export const MUNGER_QUOTES = [
  '反过来想，总是反过来想。 — 查理·芒格',
  '知道自己在什么圈圈内，比圈子有多大更重要。',
  '亏损 50% 后需要涨 100% 才能回本 — 保护本金是第一纪律。',
  '机会成本是看不见的代价 — 每个「持有」都是对另一个选择的放弃。',
  '以合理价格买伟大公司，好过以伟大价格买合理公司 — 但首先要留出安全边际。',
  '宁愿等待期望值明确为正的机会，也不要用情绪驱动决策。',
  '如果知道我会死在哪里，我就永远不去那里。',
];

export function randomQuote(): string {
  return MUNGER_QUOTES[Math.floor(Math.random() * MUNGER_QUOTES.length)];
}
