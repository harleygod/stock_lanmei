import type { Board, FeeSettings } from '../types';
import { isShanghai } from './stockCode';

const TRANSFER_FEE_RATE = 0.00002;

export function calcCommission(amount: number, settings: FeeSettings): number {
  const raw = amount * settings.commissionRate;
  if (settings.minCommission) return Math.max(raw, 5);
  return raw;
}

export function buyFee(amount: number, board: Board, settings: FeeSettings) {
  const commission = calcCommission(amount, settings);
  const transfer = isShanghai(board) ? amount * TRANSFER_FEE_RATE : 0;
  return { commission, transfer, total: commission + transfer };
}

export function sellFee(amount: number, board: Board, settings: FeeSettings) {
  const stampTax = amount * settings.stampTaxRate;
  const commission = calcCommission(amount, settings);
  const transfer = isShanghai(board) ? amount * TRANSFER_FEE_RATE : 0;
  return { stampTax, commission, transfer, total: stampTax + commission + transfer };
}

export function buyRate(board: Board, settings: FeeSettings): number {
  const base = settings.commissionRate;
  return isShanghai(board) ? base + TRANSFER_FEE_RATE : base;
}

export function sellRate(board: Board, settings: FeeSettings): number {
  return settings.stampTaxRate + buyRate(board, settings);
}

/** 含买入手续费的实际成本总额 */
export function totalBuyCost(price: number, shares: number, board: Board, settings: FeeSettings) {
  const amount = price * shares;
  const fee = buyFee(amount, board, settings);
  return { amount, ...fee, totalCost: amount + fee.total };
}

/** 卖出到手净额 */
export function netSellProceeds(price: number, shares: number, board: Board, settings: FeeSettings) {
  const amount = price * shares;
  const fee = sellFee(amount, board, settings);
  return { amount, ...fee, net: amount - fee.total };
}

/** 回本需涨幅（含卖出费用） */
export function breakEvenGainPct(costPrice: number, currentPrice: number, board: Board, settings: FeeSettings): number {
  if (currentPrice <= 0 || costPrice <= 0) return 0;
  const sellR = sellRate(board, settings);
  const target = costPrice * (1 + sellR);
  if (currentPrice >= target) return 0;
  return ((target - currentPrice) / currentPrice) * 100;
}

/** 亏损后回本所需涨幅（不对称性） */
export function recoveryAfterLossPct(lossPct: number): number {
  if (lossPct >= 0) return 0;
  const r = Math.abs(lossPct) / 100;
  if (r >= 1) return Infinity;
  return (r / (1 - r)) * 100;
}

/** 期望值 EV = P(win)*gain - P(loss)*loss */
export function expectedValue(winProb: number, gainPct: number, lossPct: number) {
  const pWin = winProb / 100;
  const pLoss = 1 - pWin;
  const ev = pWin * gainPct - pLoss * lossPct;
  const ratio = lossPct > 0 ? gainPct / lossPct : Infinity;
  return { ev, ratio, pLoss: pLoss * 100 };
}

export function evAdvice(ev: number, ratio: number): { level: 'good' | 'ok' | 'bad'; text: string } {
  if (ev > 5 && ratio > 2) {
    return { level: 'good', text: '期望值良好，可以考虑入场' };
  }
  if (ev >= 0) {
    return { level: 'ok', text: '期望值一般，建议等更好机会' };
  }
  return { level: 'bad', text: '期望值为负，赔率不利，不建议操作' };
}

/** Kelly 公式：f* = (bp - q) / b，b=盈亏比 */
export function kellyFraction(winProb: number, gainPct: number, lossPct: number): number {
  if (lossPct <= 0 || gainPct <= 0) return 0;
  const b = gainPct / lossPct;
  const p = winProb / 100;
  const q = 1 - p;
  const f = (b * p - q) / b;
  return Math.max(0, Math.min(1, f));
}

/** HHI 集中度指数 0~1，越高越集中 */
export function herfindahlIndex(weights: number[]): number {
  if (weights.length === 0) return 0;
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return weights.reduce((sum, w) => sum + (w / total) ** 2, 0);
}

export function positionMetrics(
  costPrice: number,
  currentPrice: number,
  shares: number,
  board: Board,
  settings: FeeSettings,
  totalPortfolioValue: number,
) {
  const buy = totalBuyCost(costPrice, shares, board, settings);
  const marketValue = currentPrice * shares;
  const sell = netSellProceeds(currentPrice, shares, board, settings);
  const pnl = sell.net - buy.totalCost;
  const pnlPct = buy.totalCost > 0 ? (pnl / buy.totalCost) * 100 : 0;
  const weight = totalPortfolioValue > 0 ? (marketValue / totalPortfolioValue) * 100 : 0;
  const breakEven = breakEvenGainPct(costPrice, currentPrice, board, settings);

  return {
    marketValue,
    buyCost: buy.totalCost,
    pnl,
    pnlPct,
    weight,
    breakEvenGainPct: breakEven,
    estimatedSellFee: sell.total,
  };
}

/** 目标盈利：反推卖出价 */
export function targetSellPrice(
  buyPrice: number,
  shares: number,
  board: Board,
  settings: FeeSettings,
  targetProfit: number,
): number {
  const buy = totalBuyCost(buyPrice, shares, board, settings);
  const targetNet = buy.totalCost + targetProfit;
  let low = buyPrice;
  let high = buyPrice * 3;
  for (let i = 0; i < 80; i++) {
    const mid = (low + high) / 2;
    const net = netSellProceeds(mid, shares, board, settings).net;
    if (net < targetNet) low = mid;
    else high = mid;
  }
  return Math.ceil(high * 100) / 100;
}

/** 止损价：最大可承受亏损 */
export function stopLossPrice(
  buyPrice: number,
  shares: number,
  board: Board,
  settings: FeeSettings,
  maxLoss: number,
): number {
  const buy = totalBuyCost(buyPrice, shares, board, settings);
  const targetNet = buy.totalCost - maxLoss;
  let low = buyPrice * 0.01;
  let high = buyPrice;
  for (let i = 0; i < 80; i++) {
    const mid = (low + high) / 2;
    const net = netSellProceeds(mid, shares, board, settings).net;
    if (net > targetNet) low = mid;
    else high = mid;
  }
  return Math.floor(high * 100) / 100;
}

/** 加权平均成本（多笔买入） */
export function weightedAverageCost(
  lots: { price: number; shares: number }[],
  board: Board,
  settings: FeeSettings,
) {
  let totalShares = 0;
  let totalCost = 0;
  for (const lot of lots) {
    const { totalCost: tc } = totalBuyCost(lot.price, lot.shares, board, settings);
    totalShares += lot.shares;
    totalCost += tc;
  }
  return {
    avgCost: totalShares > 0 ? totalCost / totalShares : 0,
    totalShares,
    totalCost,
  };
}

/** 分批卖出方案 */
export function batchSellPlan(
  avgCost: number,
  totalShares: number,
  currentPrice: number,
  board: Board,
  settings: FeeSettings,
  batches: number,
) {
  const perBatch = Math.floor(totalShares / batches);
  const remainder = totalShares - perBatch * batches;
  const rows: {
    batch: number;
    shares: number;
    sellPrice: number;
    netProceeds: number;
    batchPnl: number;
    remainingShares: number;
    breakEvenPrice: number;
  }[] = [];

  let remaining = totalShares;
  let remainingCostBasis = avgCost * totalShares;

  for (let i = 0; i < batches; i++) {
    const shares = i === batches - 1 ? perBatch + remainder : perBatch;
    const sell = netSellProceeds(currentPrice, shares, board, settings);
    const costBasis = avgCost * shares;
    const batchPnl = sell.net - costBasis;
    remaining -= shares;
    remainingCostBasis -= costBasis;
    const breakEvenPrice =
      remaining > 0 ? remainingCostBasis / remaining : 0;

    rows.push({
      batch: i + 1,
      shares,
      sellPrice: currentPrice,
      netProceeds: sell.net,
      batchPnl,
      remainingShares: remaining,
      breakEvenPrice,
    });
  }

  const totalNet = rows.reduce((s, r) => s + r.netProceeds, 0);
  const totalFee = rows.reduce(
    (s, r) => s + sellFee(r.sellPrice * r.shares, board, settings).total,
    0,
  );
  const remainingValue = remaining * currentPrice;
  const remainingPnl = remainingValue - remainingCostBasis;

  return { rows, totalNet, totalFee, remainingPnl, remainingShares: remaining };
}

/** 情景模拟 */
export function scenarioPnl(
  costPrice: number,
  shares: number,
  scenarioPrice: number,
  board: Board,
  settings: FeeSettings,
  totalAssets: number,
) {
  const buy = totalBuyCost(costPrice, shares, board, settings);
  const sell = netSellProceeds(scenarioPrice, shares, board, settings);
  const pnl = sell.net - buy.totalCost;
  const impact = totalAssets > 0 ? (pnl / totalAssets) * 100 : 0;
  const breakEven = breakEvenGainPct(costPrice, scenarioPrice, board, settings);
  return { pnl, impact, breakEvenGainPct: breakEven };
}

/** 2x2 情景矩阵（排列组合思维） */
export function scenarioMatrix(
  baseCase: number,
  bullPct: number,
  bearPct: number,
  probBull: number,
) {
  const probBear = 100 - probBull;
  const bull = baseCase * (1 + bullPct / 100);
  const bear = baseCase * (1 - bearPct / 100);
  const ev = (probBull / 100) * bull + (probBear / 100) * bear;
  return {
    cells: [
      { label: '牛市情景', price: bull, prob: probBull, change: bullPct },
      { label: '熊市情景', price: bear, prob: probBear, change: -bearPct },
    ],
    expectedPrice: ev,
    spread: bull - bear,
  };
}

/** 换仓手续费：卖出 A + 买入 B */
export function swapCost(
  sellPrice: number,
  sellShares: number,
  sellBoard: Board,
  buyPrice: number,
  buyShares: number,
  buyBoard: Board,
  settings: FeeSettings,
) {
  const sell = netSellProceeds(sellPrice, sellShares, sellBoard, settings);
  const buy = totalBuyCost(buyPrice, buyShares, buyBoard, settings);
  const sellFeeTotal = sell.total;
  const buyFeeTotal = buy.total;
  return {
    sellFee: sellFeeTotal,
    buyFee: buyFeeTotal,
    total: sellFeeTotal + buyFeeTotal,
    sellNet: sell.net,
    buyCost: buy.totalCost,
  };
}

/** 机会成本对比：持有 A vs 换仓 B */
export function opportunityCostCompare(
  aWinProb: number,
  aGain: number,
  aLoss: number,
  bWinProb: number,
  bGain: number,
  bLoss: number,
  investedAmount: number,
  swapFeeTotal: number,
) {
  const evA = expectedValue(aWinProb, aGain, aLoss);
  const evB = expectedValue(bWinProb, bGain, bLoss);
  const swapCostPct = investedAmount > 0 ? (swapFeeTotal / investedAmount) * 100 : 0;
  const evDiff = evB.ev - evA.ev;
  const evDiffAdjusted = evDiff - swapCostPct;

  let level: 'swap' | 'hold' | 'neutral';
  let text: string;
  if (evDiff > 3) {
    level = 'swap';
    text = '换仓期望值显著更高，可考虑调仓';
  } else if (evDiff < -3) {
    level = 'hold';
    text = '持有 A 期望值更高，勿因短期波动频繁换仓';
  } else {
    level = 'neutral';
    text = '两者接近，换仓收益不足以覆盖成本和不确定性';
  }

  return { evA: evA.ev, evB: evB.ev, evDiff, evDiffAdjusted, swapCostPct, swapFeeTotal, level, text };
}

/** 安全边际 */
export function marginOfSafety(fairValue: number, marginPct: number, buyPrice: number) {
  const maxAcceptablePrice = fairValue * (1 - marginPct / 100);
  const discountRate = fairValue > 0 ? ((fairValue - buyPrice) / fairValue) * 100 : 0;
  const inSafetyZone = buyPrice <= maxAcceptablePrice;
  const needDropPct =
    !inSafetyZone && buyPrice > 0 ? ((buyPrice - maxAcceptablePrice) / buyPrice) * 100 : 0;
  const premiumPct = buyPrice > maxAcceptablePrice && maxAcceptablePrice > 0
    ? ((buyPrice - maxAcceptablePrice) / maxAcceptablePrice) * 100
    : 0;

  return { maxAcceptablePrice, discountRate, inSafetyZone, needDropPct, premiumPct };
}

/** 手续费拖拽曲线数据点 */
export function feeDragCurve(
  buyPrice: number,
  shares: number,
  board: Board,
  settings: FeeSettings,
  steps = 40,
) {
  const buy = totalBuyCost(buyPrice, shares, board, settings);
  const maxProfit = buy.totalCost * 0.5;
  const points: { targetProfit: number; feeRatio: number; totalFee: number; netProfit: number }[] = [];

  for (let i = 1; i <= steps; i++) {
    const targetProfit = (maxProfit * i) / steps;
    const sellP = targetSellPrice(buyPrice, shares, board, settings, targetProfit);
    const sell = netSellProceeds(sellP, shares, board, settings);
    const totalFee = buy.total + sell.total;
    const netProfit = sell.net - buy.totalCost;
    const feeRatio = netProfit + totalFee > 0 ? (totalFee / (netProfit + totalFee)) * 100 : 100;
    points.push({ targetProfit, feeRatio, totalFee, netProfit });
  }

  let breakeven50: number | null = null;
  let minProfitUnder20Pct: number | null = null;
  for (const p of points) {
    if (breakeven50 === null && p.feeRatio <= 50) breakeven50 = p.targetProfit;
    if (p.feeRatio <= 20) minProfitUnder20Pct = p.targetProfit;
  }

  return { points, buyTotalCost: buy.totalCost, breakeven50, minProfitUnder20Pct };
}
