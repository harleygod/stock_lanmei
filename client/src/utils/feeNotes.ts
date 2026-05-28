/** A 股费率说明（供设置页展示） */
export const FEE_EXPLAIN = {
  commission: '买卖双向收取，华宝默认约 0.01154%，不足 5 元按 5 元计',
  stampTax:
    '卖出单边 0.1%，国家统一税率。沪市、深市、创业板、科创板相同，买入不收',
  transfer:
    '仅沪市（主板+科创板）收取 0.002%，买入卖出均收；深市、创业板、北交所不收',
  buyTotal: {
    sh: '佣金 + 过户费（最低 5 元佣金）',
    sz: '佣金（最低 5 元）',
  },
  sellTotal: {
    sh: '印花税 0.1% + 佣金 + 过户费（最低 5 元佣金）',
    sz: '印花税 0.1% + 佣金（最低 5 元）',
  },
} as const;

export function feeSummaryLines(minCommission: boolean): string[] {
  const min = minCommission ? '已启用' : '未启用';
  return [
    `佣金：双向，不足 5 元按 5 元（${min}）`,
    '印花税 0.1%：仅卖出，沪深统一，无地区差别',
    '过户费 0.002%：仅沪市，深市不收',
  ];
}
