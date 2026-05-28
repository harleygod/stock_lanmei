import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted">{children}</div>
    </div>
  );
}

export default function GuidePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">使用说明</h1>
      <p className="text-sm text-muted">
        本工具帮你「算清楚再决策」——所有盈亏、仓位、回本涨幅均含手续费，不构成投资建议。
      </p>

      <Section title="快速开始">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            在 <Link to="/" className="text-blue-600">持仓</Link> 页点击「添加持仓」，填写股票代码、成本价、股数。
          </li>
          <li>
            在持仓页上方设置 <strong className="text-text">可用余额</strong>（账户里还没买股票的现金），仓位占比会按「市值 + 余额」计算。
          </li>
          <li>
            交易时间会自动刷新行情；非交易时间显示收盘价。刷新失败可在单股详情里手动覆盖现价。
          </li>
          <li>看顶部卡片：总投入、市值、余额、总资产、总盈亏。</li>
        </ol>
      </Section>

      <Section title="持仓页说明">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-text">盈亏</strong>：按「现在卖出到手净额 − 买入总成本（含买入费）」计算，与交割单更接近。
          </li>
          <li>
            <strong className="text-text">回本需涨</strong>：含卖出印花税和佣金，不是简单的「成本减现价」。
          </li>
          <li>
            <strong className="text-text">仓位</strong> = 该股市值 ÷（全部持仓市值 + 可用余额）。未填余额时，仓位会偏高。
          </li>
          <li>饼图含「现金」切片；HHI 集中度也计入现金。</li>
          <li>单股红色/黄色警告：仓位 &gt;30% 或亏损 &gt;15% 时提醒。</li>
        </ul>
      </Section>

      <Section title="计算器各 Tab 何时用">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-text">期望值</strong>：评估上涨概率 × 涨幅 vs 下跌概率 × 跌幅，看 EV 和 Kelly 仓位。</li>
          <li><strong className="text-text">盈利目标</strong>：想赚 X 元，反推需要卖到多少价（含全部费用）。</li>
          <li><strong className="text-text">止损</strong>：最多亏多少，反推止损价；注意「亏 20% 需涨 25% 才回本」。</li>
          <li><strong className="text-text">分批卖出</strong>：规划分几批卖、每批到手多少。</li>
          <li><strong className="text-text">综合成本</strong>：多次加仓后的加权平均成本。</li>
          <li><strong className="text-text">情景矩阵</strong>：牛/熊两种情景 + 概率，算期望结果。</li>
          <li><strong className="text-text">机会成本</strong>：持有 A vs 换仓 B，哪个期望值更高。</li>
          <li><strong className="text-text">安全边际</strong>：保守估值 × 折扣，判断当前价是否买贵了。</li>
          <li><strong className="text-text">手续费曲线</strong>：小目标盈利时，手续费占毛利润的比例。</li>
        </ul>
        <p>顶部「从持仓一键带入」可快速填入成本价和股数。</p>
      </Section>

      <Section title="日志与冷静 24 小时">
        <ul className="list-disc space-y-2 pl-5">
          <li>每笔操作必须填写<strong className="text-text">理由</strong>，方便复盘、避免情绪化交易。</li>
          <li>卖出/减仓可勾选「冷静 24 小时后再确认」，先进入「待确认」Tab，到期后再执行。</li>
          <li>日志页下方有复盘统计和理由关键词，帮你发现「摊平」「直觉」等模式。</li>
        </ul>
      </Section>

      <Section title="设置与备份">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <Link to="/settings" className="text-blue-600">设置</Link> 可改佣金、最低 5 元、多组合、冷静期时长。
          </li>
          <li>费率说明：印花税 0.1% 仅卖出、沪深统一；过户费 0.002% 仅沪市；佣金双向，默认不足 5 元按 5 元。</li>
          <li>数据存在浏览器 localStorage，请定期「导出 JSON」备份；换设备用「导入 JSON」恢复。</li>
        </ul>
      </Section>

      <Section title="常见问题">
        <dl className="space-y-3">
          <div>
            <dt className="font-medium text-text">行情获取失败？</dt>
            <dd className="mt-1">
              需 Node 后端转发 `/api/quote`（Docker 部署不要只托管静态文件）。云服务器 IP 可能被新浪/腾讯限流，本项目已优先用东方财富接口。可手动覆盖现价，计算不受影响。
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text">换设备后数据没了？</dt>
            <dd className="mt-1">在旧设备设置页导出 JSON，新设备导入即可。</dd>
          </div>
          <div>
            <dt className="font-medium text-text">仓位占比为什么和券商 App 不一样？</dt>
            <dd className="mt-1">请填写可用余额；本工具按「市值 + 现金」算总资产，未填余额时会把 100% 都算在股票上。</dd>
          </div>
          <div>
            <dt className="font-medium text-text">沪市和深市费率差在哪？</dt>
            <dd className="mt-1">印花税两边一样（卖出 0.1%）；差别在过户费——只有沪市主板和科创板有 0.002%。</dd>
          </div>
        </dl>
      </Section>

      <div className="text-center">
        <Link to="/" className="btn-primary inline-block text-sm">返回持仓</Link>
      </div>
    </div>
  );
}
