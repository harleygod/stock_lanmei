import type { TradeLog } from '../types';

const ACTION_LABEL: Record<TradeLog['action'], string> = {
  buy: '买入',
  sell: '卖出',
  add: '加仓',
  reduce: '减仓',
};

const TAG_PATTERNS: { tag: string; pattern: RegExp }[] = [
  { tag: '止损', pattern: /止损/ },
  { tag: '摊平补仓', pattern: /摊|补跌|补仓|加仓降成本/ },
  { tag: '看好基本面', pattern: /业绩|基本面|行业|估值|成长/ },
  { tag: '追热点', pattern: /热点|题材|概念|消息/ },
  { tag: '直觉驱动', pattern: /感觉|应该|觉得|可能|猜测/ },
  { tag: '止盈', pattern: /止盈|获利|兑现/ },
  { tag: '减仓控险', pattern: /减仓|控仓|风险|集中/ },
  { tag: '技术形态', pattern: /突破|支撑|均线|形态|趋势/ },
];

const VAGUE_PATTERN = /感觉|应该|觉得|可能|猜测/;
const LOSS_ADD_PATTERN = /摊|补跌|补仓|跌.*加|亏损.*加/;

export function analyzeLogs(logs: TradeLog[]) {
  const total = logs.length;
  const buyCount = logs.filter((l) => l.action === 'buy' || l.action === 'add').length;
  const sellCount = logs.filter((l) => l.action === 'sell' || l.action === 'reduce').length;

  const tagCounts = new Map<string, number>();
  for (const log of logs) {
    for (const { tag, pattern } of TAG_PATTERNS) {
      if (pattern.test(log.reason)) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  const monthlyMap = new Map<string, number>();
  for (const log of logs) {
    const month = log.date.slice(0, 7);
    monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + 1);
  }
  const monthly = [...monthlyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({ month, count }));

  const actionDist = (['buy', 'sell', 'add', 'reduce'] as TradeLog['action'][]).map((action) => ({
    name: ACTION_LABEL[action],
    value: logs.filter((l) => l.action === action).length,
  })).filter((d) => d.value > 0);

  const vagueCount = logs.filter((l) => VAGUE_PATTERN.test(l.reason)).length;
  const lossAddCount = logs.filter(
    (l) => (l.action === 'add' || l.action === 'buy') && LOSS_ADD_PATTERN.test(l.reason),
  ).length;

  const insights: string[] = [];
  if (total > 0) {
    const vaguePct = ((vagueCount / total) * 100).toFixed(0);
    if (vagueCount > 0) {
      insights.push(
        `${vaguePct}% 的操作理由包含「感觉/应该」等模糊词 — 建议用数据替代直觉`,
      );
    }
    if (lossAddCount > 0) {
      insights.push(
        `有 ${lossAddCount} 次加仓理由涉及摊平/补跌 — 请审视是否存在摊平心理`,
      );
    }
    const recent30 = logs.filter((l) => {
      const d = new Date(l.date);
      const now = new Date();
      return (now.getTime() - d.getTime()) / 86400000 <= 30;
    });
    if (recent30.length >= 5) {
      insights.push(`过去 30 天操作 ${recent30.length} 次 — 频繁交易可能被手续费侵蚀`);
    }
  }

  return {
    total,
    buyCount,
    sellCount,
    topTags,
    monthly,
    actionDist,
    vagueCount,
    lossAddCount,
    insights,
  };
}

export function filterLogsByTag(logs: TradeLog[], tag: string): TradeLog[] {
  const pattern = TAG_PATTERNS.find((t) => t.tag === tag)?.pattern;
  if (!pattern) return logs;
  return logs.filter((l) => pattern.test(l.reason));
}
