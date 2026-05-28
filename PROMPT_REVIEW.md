# 优化版 Prompt 补充说明

> 基于你的原始 Prompt，以下是可行性结论、修正项、以及芒格/多学科思维增强。

## 可行性：完全可以做

你的技术选型合理：
- React + TS + Tailwind + Recharts + localStorage → 纯前端可独立运行
- Express 代理 → 解决新浪/腾讯跨域，VPS 上一容器即可
- 无需数据库/登录 → 部署极简，适合个人工具

**已实现项目路径：** `stock-decision-assistant/`

---

## 原始 Prompt 需修正的地方

### 1. 回本涨幅公式（重要）

原公式：
```
回本需涨幅 = (成本价 - 当前价) / 当前价 × 100%
```

**问题：** 未计入卖出时的印花税+佣金+过户费，会**低估**实际所需涨幅。

**修正：**
```
卖出费率 = 印花税 + 佣金 + 过户费(沪市)
目标价 = 成本价 × (1 + 卖出费率)   // 简化：成本按买入价计
回本需涨幅 = (目标价 - 当前价) / 当前价 × 100%
```

### 2. 盈亏金额应含手续费

主页「盈亏金额」建议用：
```
浮动盈亏 = 当前价卖出到手净额 - 买入总成本(含买入费)
```
否则与交割单会对不上。

### 3. localStorage 数据结构（你 Prompt 截断处补全）

```typescript
interface AppData {
  version: 1;
  positions: Position[];
  logs: TradeLog[];
  settings: AppSettings;
}

interface Position {
  id: string;
  name: string;
  code: string;           // 纯数字，如 "002475"
  costPrice: number;
  shares: number;
  board: Board;
  manualPrice?: number;   // 行情失败时手动覆盖
  note?: string;
  createdAt: string;
  updatedAt: string;
}

interface TradeLog {
  id: string;
  date: string;           // YYYY-MM-DD
  stockName: string;
  stockCode: string;
  action: 'buy' | 'sell' | 'add' | 'reduce';
  price: number;
  quantity: number;
  fee?: number;
  reason: string;         // 必填
  createdAt: string;
}

interface AppSettings {
  commissionRate: number; // 0.0001154
  minCommission: boolean;
  stampTaxRate: number;   // 0.001 固定
  theme: 'light' | 'dark';
  refreshIntervalSec: number;
}
```

---

## 芒格/多学科思维增强（已加入或建议加入）

| 模块 | 思维模型 | 说明 |
|------|----------|------|
| Tab: 期望值 | **概率×收益** | EV = P(win)×gain - P(loss)×loss |
| Tab: 期望值 | **Kelly 公式** | 最优仓位比例 f* = (bp-q)/b，建议半 Kelly |
| Tab: 止损 | **不对称回本** | 亏 20% 需涨 25% 才能回本，亏 50% 需涨 100% |
| Tab: 情景矩阵 | **排列组合** | 牛/熊两情景 + 概率 → 加权期望价 |
| 主页 | **HHI 集中度** | 单一数字衡量组合集中风险 |
| 决策清单 | **反事实检验** | 「若现在是现金还买吗？」— 沉没成本偏差 |
| 日志 | **事前验尸** | 强制写理由，复盘时对照结果 |

### 建议后续 v1.1 增加

1. **机会成本对比 Tab**：持有 A vs 换仓 B 的 EV 差
2. **安全边际计算器**：目标价 = 估值 × (1 - 安全边际%)
3. **日志统计**：有理由 vs 无理由操作的比例、亏损操作理由词云
4. **费率拖拽可视化**：手续费占盈利的比例随目标利润变化曲线

---

## 金句库（可随机展示在计算器底部）

- 「反过来想，总是反过来想。」— 芒格
- 「知道自己在什么圈圈内，比圈子有多大更重要。」
- 「亏损 50% 后需要涨 100% 才能回本 — 保护本金是第一纪律。」

---

## 部署建议

1. Docker 一键：`docker compose up -d --build`
2. Nginx 反代 + HTTPS
3. Basic Auth 防公网扫描
4. 定期从设置页导出 JSON 备份（localStorage 清缓存会丢数据）

---

## 免责声明

本工具仅做数学辅助与决策结构化，不构成投资建议。行情数据来自公开接口，可能有延迟或误差。
