# 股票决策辅助系统

个人投资管理 Web App：算清楚再决策。含持仓管理、费率精确计算、芒格式期望值/Kelly/情景矩阵、决策自检清单。

## 功能

- 持仓总览 + 仓位风险看板（饼图/条形图/HHI 集中度）
- 实时行情（新浪 → 腾讯降级，Express 代理）
- 计算器 9 Tab：期望值、盈利目标、止损、分批卖出、综合成本、情景矩阵、机会成本、安全边际、手续费曲线
- **v1.2**：多组合管理、持仓一键带入计算器、冷静 24h 待确认、PWA 离线安装
- 单股详情 + 情景滑条 + 决策自检清单
- 交易日志 + **复盘统计/理由标签云**
- localStorage 持久化 + JSON 导入导出
- 深色/浅色模式 + 页脚免责声明

## 本地开发

需 Node.js 18+ 与 npm：

```bash
cd stock-decision-assistant
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..

# 终端 1
cd server && npm run dev

# 终端 2
cd client && npm run dev
```

浏览器打开 http://localhost:5173

## VPS 部署

```bash
cd stock-decision-assistant
docker compose up -d --build
```

访问 `http://你的VPS:3001`

建议前面加 Nginx/Caddy 反向代理 + HTTPS + Basic Auth。

## 费率默认值

华宝证券：佣金 0.01154%，沪市过户费 0.002%，卖出印花税 0.1%。可在设置页修改。

## 数据说明

- 数据存在浏览器 localStorage，换设备需导入备份
- 行情接口为公开免费源，仅供个人参考，不构成投资建议
