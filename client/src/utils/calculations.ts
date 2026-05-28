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

/** 给定买卖价，计算扣费后实际盈亏 */
export function tradePnl(
  buyPrice: number,
  sellPrice: number,
  shares: number,
  board: Board,
  settings: FeeSettings,
) {
  const buy = totalBuyCost(buyPrice, shares, board, settings);
  const sell = netSellProceeds(sellPrice, shares, board, settings);
  const pnl = sell.net - buy.totalCost;
  const pnlPct = buy.totalCost > 0 ? (pnl / buy.totalCost) * 100 : 0;
  const priceDiff = sellPrice - buyPrice;
  const priceDiffPct = buyPrice > 0 ? (priceDiff / buyPrice) * 100 : 0;
  return { buy, sell, pnl, pnlPct, priceDiff, priceDiffPct };
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

export type PricePositionLabel = '低位' | '中位' | '高位';

/** 相对区间评估股价处于高位/低位 */
export function assessPricePosition(
  price: number,
  refLow: number,
  refHigh: number,
): { score: number; label: PricePositionLabel } {
  const range = refHigh - refLow;
  if (range <= 0) return { score: 50, label: '中位' };
  const score = Math.max(0, Math.min(100, ((price - refLow) / range) * 100));
  const label: PricePositionLabel = score <= 30 ? '低位' : score >= 70 ? '高位' : '中位';
  return { score, label };
}

export type WatchEntrySignal = 'ready' | 'near' | 'wait' | 'high';

export interface WatchPoolInput {
  triggerPrice: number;
  refLow?: number;
  refHigh?: number;
  winProb: number;
  gainPct: number;
  lossPct: number;
  maxBuyAmount?: number;
}

/** 观察池综合分析：触发价 + 期望值 + 高低位 */
export function watchPoolAnalysis(
  item: WatchPoolInput,
  currentPrice: number,
  board: Board,
  settings: FeeSettings,
) {
  const refLow = item.refLow ?? item.triggerPrice * 0.85;
  const refHigh = item.refHigh ?? item.triggerPrice * 1.25;
  const position = assessPricePosition(currentPrice, refLow, refHigh);
  const { ev, ratio } = expectedValue(item.winProb, item.gainPct, item.lossPct);
  const advice = evAdvice(ev, ratio);

  const atOrBelowTrigger = currentPrice <= item.triggerPrice;
  const gapToTrigger = item.triggerPrice - currentPrice;
  const gapToTriggerPct = item.triggerPrice > 0 ? (gapToTrigger / item.triggerPrice) * 100 : 0;

  let entryScore = 0;
  if (atOrBelowTrigger) entryScore += 40;
  else entryScore += Math.max(0, 20 - Math.max(0, gapToTriggerPct));
  if (ev > 5) entryScore += 30;
  else if (ev >= 0) entryScore += 15;
  if (position.label === '低位') entryScore += 30;
  else if (position.label === '中位') entryScore += 15;
  entryScore = Math.min(100, entryScore);

  let signal: WatchEntrySignal;
  if (atOrBelowTrigger && ev >= 0 && position.label !== '高位') signal = 'ready';
  else if (gapToTriggerPct <= 3 && gapToTriggerPct >= -2 && ev >= 0) signal = 'near';
  else if (position.label === '高位') signal = 'high';
  else signal = 'wait';

  const buyRateEst = buyRate(board, settings);
  const estCostPerShare = currentPrice > 0 ? currentPrice * (1 + buyRateEst) : 0;
  const suggestedShares =
    item.maxBuyAmount && estCostPerShare > 0
      ? Math.max(0, Math.floor(item.maxBuyAmount / estCostPerShare / 100) * 100)
      : undefined;

  return {
    refLow,
    refHigh,
    positionScore: position.score,
    positionLabel: position.label,
    ev,
    ratio,
    advice,
    atOrBelowTrigger,
    gapToTrigger,
    gapToTriggerPct,
    entryScore,
    signal,
    suggestedShares,
    estBuyAmount: suggestedShares ? suggestedShares * estCostPerShare : undefined,
  };
}

export type OpportunitySideA =
  | { mode: 'cash'; cashAmount: number }
  | {
      mode: 'position';
      price: number;
      shares: number;
      board: Board;
      winProb: number;
      gainPct: number;
      lossPct: number;
    };

/** 观察池标的买入计划：触发价或现价 + 建议股数 */
export function resolveWatchBuyPlan(
  item: WatchPoolInput & { board: Board },
  currentPrice: number,
  settings: FeeSettings,
  priceMode: 'trigger' | 'current' = 'trigger',
) {
  const bPrice =
    priceMode === 'trigger'
      ? item.triggerPrice
      : currentPrice > 0
        ? currentPrice
        : item.triggerPrice;
  const analysis = watchPoolAnalysis(item, bPrice, item.board, settings);
  const bShares = analysis.suggestedShares ?? 0;
  return { bPrice, bShares, analysis };
}

/** 机会成本：持有 A（持仓或闲置现金）vs 买入观察池标的 B */
export function opportunityCostScenario(
  sideA: OpportunitySideA,
  bWinProb: number,
  bGainPct: number,
  bLossPct: number,
  bPrice: number,
  bShares: number,
  bBoard: Board,
  settings: FeeSettings,
) {
  let aWin: number;
  let aGain: number;
  let aLoss: number;
  let invested: number;
  let swapFeeTotal: number;

  if (sideA.mode === 'cash') {
    aWin = 50;
    aGain = 0;
    aLoss = 0;
    invested = sideA.cashAmount;
    swapFeeTotal =
      bShares > 0 && bPrice > 0
        ? totalBuyCost(bPrice, bShares, bBoard, settings).total
        : 0;
  } else {
    aWin = sideA.winProb;
    aGain = sideA.gainPct;
    aLoss = sideA.lossPct;
    invested = sideA.price * sideA.shares;
    swapFeeTotal =
      bShares > 0
        ? swapCost(sideA.price, sideA.shares, sideA.board, bPrice, bShares, bBoard, settings).total
        : 0;
  }

  return {
    ...opportunityCostCompare(aWin, aGain, aLoss, bWinProb, bGainPct, bLossPct, invested, swapFeeTotal),
    invested,
  };
}

/** 批量：当前 A 方案 vs 观察池全部标的 */
export function compareWatchPoolOpportunity(
  sideA: OpportunitySideA,
  items: (WatchPoolInput & { id: string; name: string; code: string; board: Board })[],
  quotes: Record<string, { price: number }>,
  settings: FeeSettings,
  priceMode: 'trigger' | 'current' = 'trigger',
) {
  return items
    .map((item) => {
      const q = quotes[item.code];
      const currentPrice = q?.price ?? 0;
      const plan = resolveWatchBuyPlan(item, currentPrice, settings, priceMode);
      if (plan.bShares <= 0) return null;
      const result = opportunityCostScenario(
        sideA,
        item.winProb,
        item.gainPct,
        item.lossPct,
        plan.bPrice,
        plan.bShares,
        item.board,
        settings,
      );
      return {
        id: item.id,
        name: item.name,
        code: item.code,
        ...plan,
        ...result,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => b.evDiffAdjusted - a.evDiffAdjusted);
}

/** 卖出回本/盈利目标价与涨幅 */
export function sellRecoveryTargets(
  costBasis: number,
  shares: number,
  currentPrice: number,
  board: Board,
  settings: FeeSettings,
  targetProfit = 0,
) {
  if (shares <= 0 || costBasis <= 0 || currentPrice <= 0) return null;
  const avgCost = costBasis / shares;
  const breakEvenPrice = targetSellPrice(avgCost, shares, board, settings, 0);
  const profitPrice =
    targetProfit > 0 ? targetSellPrice(avgCost, shares, board, settings, targetProfit) : undefined;
  const breakEvenRisePct = ((breakEvenPrice - currentPrice) / currentPrice) * 100;
  const profitRisePct = profitPrice ? ((profitPrice - currentPrice) / currentPrice) * 100 : undefined;
  return { avgCost, breakEvenPrice, profitPrice, breakEvenRisePct, profitRisePct };
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

/** 反推卖出价：使到手净额 = targetNet */
function findPriceForTargetNet(
  shares: number,
  board: Board,
  settings: FeeSettings,
  targetNet: number,
  searchLow: number,
  searchHigh: number,
): number {
  let low = searchLow;
  let high = searchHigh;
  for (let i = 0; i < 80; i++) {
    const mid = (low + high) / 2;
    const net = netSellProceeds(mid, shares, board, settings).net;
    if (net < targetNet) low = mid;
    else high = mid;
  }
  return Math.round(high * 100) / 100;
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
  if (maxLoss <= 0) return buyPrice;
  const targetNet = buy.totalCost - maxLoss;
  const netAtBuy = netSellProceeds(buyPrice, shares, board, settings).net;

  if (targetNet > netAtBuy) {
    return findPriceForTargetNet(shares, board, settings, targetNet, buyPrice, buyPrice * 2);
  }
  return findPriceForTargetNet(shares, board, settings, targetNet, 0.01, buyPrice);
}

/** 止损 + 现价 + 减仓情景分析 */
export function stopLossAnalysis(
  buyPrice: number,
  shares: number,
  board: Board,
  settings: FeeSettings,
  maxLoss: number,
  currentPrice?: number,
  totalAssets?: number,
  partialSellShares?: number,
  targetProfit = 500,
) {
  const buy = totalBuyCost(buyPrice, shares, board, settings);
  const stopPrice = stopLossPrice(buyPrice, shares, board, settings, maxLoss);
  const sellAtStop = netSellProceeds(stopPrice, shares, board, settings);
  const lossAtStop = buy.totalCost - sellAtStop.net;
  const lossPctAtStop = buy.totalCost > 0 ? (lossAtStop / buy.totalCost) * 100 : 0;

  let warning: string | undefined;
  const netAtBuy = netSellProceeds(buyPrice, shares, board, settings).net;
  if (maxLoss < buy.totalCost - netAtBuy) {
    warning =
      '提示：你设定的最大亏损小于「按成本价卖出」的亏损，止损线会在成本价上方，请调大最大亏损或检查参数。';
  }

  const result: {
    stopPrice: number;
    lossAtStop: number;
    lossPctAtStop: number;
    warning?: string;
    current?: {
      loss: number;
      lossPct: number;
      sellNet: number;
      triggered: boolean;
      impactPct: number;
      priceVsStop: string;
    };
    partial?: {
      shares: number;
      loss: number;
      sellNet: number;
      remainingShares: number;
      remainingCost: number;
      remainingMarketValue: number;
      remainingWeightPct: number;
      recovery?: NonNullable<ReturnType<typeof sellRecoveryTargets>>;
    };
    recovery?: NonNullable<ReturnType<typeof sellRecoveryTargets>>;
  } = { stopPrice, lossAtStop, lossPctAtStop, warning };

  if (currentPrice != null && currentPrice > 0) {
    const sellNow = netSellProceeds(currentPrice, shares, board, settings);
    const lossNow = buy.totalCost - sellNow.net;
    const triggered = currentPrice <= stopPrice;
    const impactPct = totalAssets && totalAssets > 0 ? (lossNow / totalAssets) * 100 : 0;
    let priceVsStop = '现价高于止损线，尚未触发';
    if (Math.abs(currentPrice - stopPrice) < 0.02) priceVsStop = '现价接近止损线';
    else if (triggered) priceVsStop = '现价已低于止损线，按纪律应考虑卖出';

    result.current = {
      loss: lossNow,
      lossPct: buy.totalCost > 0 ? (lossNow / buy.totalCost) * 100 : 0,
      sellNet: sellNow.net,
      triggered,
      impactPct,
      priceVsStop,
    };

    result.recovery = sellRecoveryTargets(
      buy.totalCost,
      shares,
      currentPrice,
      board,
      settings,
      targetProfit,
    ) ?? undefined;
  }

  if (partialSellShares != null && partialSellShares > 0 && partialSellShares < shares) {
    const px = currentPrice && currentPrice > 0 ? currentPrice : buyPrice;
    const sellPart = netSellProceeds(px, partialSellShares, board, settings);
    const costPart = (buy.totalCost / shares) * partialSellShares;
    const remainingShares = shares - partialSellShares;
    const remainingCost = buy.totalCost - costPart;
    const remainingMarketValue = px * remainingShares;
    const remainingWeightPct =
      totalAssets && totalAssets > 0 ? (remainingMarketValue / totalAssets) * 100 : 0;
    const recovery = sellRecoveryTargets(
      remainingCost,
      remainingShares,
      px,
      board,
      settings,
      targetProfit,
    );

    result.partial = {
      shares: partialSellShares,
      loss: costPart - sellPart.net,
      sellNet: sellPart.net,
      remainingShares,
      remainingCost,
      remainingMarketValue,
      remainingWeightPct,
      ...(recovery ? { recovery } : {}),
    };
  }

  return result;
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

/** 给定目标净利润，计算手续费占毛利润比例 */
export function computeFeeDragAtTarget(
  buyPrice: number,
  shares: number,
  board: Board,
  settings: FeeSettings,
  targetProfit: number,
) {
  const buy = totalBuyCost(buyPrice, shares, board, settings);
  const sellP = targetSellPrice(buyPrice, shares, board, settings, Math.max(0, targetProfit));
  const sell = netSellProceeds(sellP, shares, board, settings);
  const totalFee = buy.total + sell.total;
  const netProfit = sell.net - buy.totalCost;
  const grossProfit = netProfit + totalFee;
  const feeRatio = grossProfit > 0 ? (totalFee / grossProfit) * 100 : 100;
  return {
    targetProfit,
    sellPrice: sellP,
    totalFee,
    netProfit,
    grossProfit,
    feeRatio,
    buyTotalCost: buy.totalCost,
  };
}

/** 二分：达到「手续费/毛利润 ≤ ratioCap%」所需的最小目标盈利 */
function minProfitForFeeRatioAtMost(
  buyPrice: number,
  shares: number,
  board: Board,
  settings: FeeSettings,
  ratioCap: number,
): number | null {
  const buy = totalBuyCost(buyPrice, shares, board, settings);
  if (buy.totalCost <= 0 || shares <= 0) return null;

  const probe = (p: number) => computeFeeDragAtTarget(buyPrice, shares, board, settings, p).feeRatio;

  let high = Math.max(200, buy.totalCost * 0.05);
  while (high < buy.totalCost && probe(high) > ratioCap) {
    high = Math.min(high * 2, buy.totalCost);
  }
  if (probe(high) > ratioCap) return null;

  let low = 1;
  if (probe(low) <= ratioCap) return Math.ceil(low * 100) / 100;

  for (let i = 0; i < 64; i++) {
    const mid = (low + high) / 2;
    if (probe(mid) > ratioCap) low = mid;
    else high = mid;
  }
  return Math.ceil(high * 100) / 100;
}

/** 手续费拖拽曲线：目标盈利 vs 手续费占毛利润比例 */
export function feeDragCurve(
  buyPrice: number,
  shares: number,
  board: Board,
  settings: FeeSettings,
  steps = 40,
) {
  const buy = totalBuyCost(buyPrice, shares, board, settings);
  if (buy.totalCost <= 0 || shares <= 0) {
    return {
      points: [],
      buyTotalCost: 0,
      roundTripFeeAtCost: 0,
      breakeven50: null,
      minProfitUnder20Pct: null,
    };
  }

  const roundTripFeeAtCost =
    buy.total + sellFee(buy.amount, board, settings).total;

  const minProfit = Math.max(50, roundTripFeeAtCost * 2);
  const maxProfit = Math.max(minProfit * 4, buy.totalCost * 0.15);

  const points: ReturnType<typeof computeFeeDragAtTarget>[] = [];
  for (let i = 1; i <= steps; i++) {
    const targetProfit = minProfit + ((maxProfit - minProfit) * i) / steps;
    points.push(computeFeeDragAtTarget(buyPrice, shares, board, settings, targetProfit));
  }

  const breakeven50 = minProfitForFeeRatioAtMost(buyPrice, shares, board, settings, 50);
  const minProfitUnder20Pct = minProfitForFeeRatioAtMost(buyPrice, shares, board, settings, 20);

  return {
    points,
    buyTotalCost: buy.totalCost,
    roundTripFeeAtCost,
    breakeven50,
    minProfitUnder20Pct,
  };
}
