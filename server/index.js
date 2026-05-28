import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'zh-CN,zh;q=0.9',
};

function isTradingHoursCN() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const cn = new Date(utc + 8 * 3600000);
  const day = cn.getDay();
  if (day === 0 || day === 6) return false;
  const mins = cn.getHours() * 60 + cn.getMinutes();
  return (mins >= 570 && mins <= 690) || (mins >= 780 && mins <= 900);
}

function decodeGbK(buffer) {
  try {
    return new TextDecoder('gbk').decode(buffer);
  } catch {
    return Buffer.from(buffer).toString('binary');
  }
}

/** sz002475 / sh600522 → 东方财富 secid */
function toEastMoneySecId(symbol) {
  const s = symbol.toLowerCase();
  const market = s.slice(0, 2);
  const code = s.slice(2);
  if (market === 'sh') return `1.${code}`;
  if (market === 'bj') return `0.${code}`;
  return `0.${code}`;
}

function buildQuote(symbol, data) {
  return {
    code: symbol.toLowerCase(),
    ...data,
    isClosed: !isTradingHoursCN(),
    updatedAt: new Date().toISOString(),
  };
}

async function fetchEastMoney(symbol) {
  const secid = toEastMoneySecId(symbol);
  const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f57,f58,f43,f44,f45,f46,f47,f48,f60,f169,f170`;
  const res = await fetch(url, {
    headers: {
      ...FETCH_HEADERS,
      Referer: 'https://quote.eastmoney.com/',
    },
  });
  if (!res.ok) throw new Error(`eastmoney http ${res.status}`);
  const json = await res.json();
  if (!json?.data?.f43) throw new Error('eastmoney empty');

  const d = json.data;
  const price = d.f43 / 100;
  if (!price || Number.isNaN(price)) throw new Error('eastmoney price');

  return buildQuote(symbol, {
    name: d.f58 || symbol,
    price,
    prevClose: (d.f60 ?? 0) / 100,
    open: (d.f46 ?? 0) / 100,
    high: (d.f44 ?? 0) / 100,
    low: (d.f45 ?? 0) / 100,
    volume: d.f47 ?? 0,
    source: 'eastmoney',
  });
}

async function fetchSina(symbol) {
  const url = `https://hq.sinajs.cn/list=${symbol}`;
  const res = await fetch(url, {
    headers: {
      ...FETCH_HEADERS,
      Referer: 'https://finance.sina.com.cn',
    },
  });
  if (!res.ok) throw new Error(`sina http ${res.status}`);
  const buf = await res.arrayBuffer();
  const text = decodeGbK(buf);
  const match = text.match(/="([^"]*)"/);
  if (!match) throw new Error('sina parse');
  const parts = match[1].split(',');
  if (parts.length < 32) throw new Error('sina fields');

  const price = parseFloat(parts[3]);
  if (!price || Number.isNaN(price)) throw new Error('sina price');

  return buildQuote(symbol, {
    name: parts[0],
    price,
    prevClose: parseFloat(parts[2]) || 0,
    open: parseFloat(parts[1]) || 0,
    high: parseFloat(parts[4]) || 0,
    low: parseFloat(parts[5]) || 0,
    volume: parseFloat(parts[8]) || 0,
    source: 'sina',
  });
}

async function fetchTencent(symbol) {
  const url = `https://qt.gtimg.cn/q=${symbol}`;
  const res = await fetch(url, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`tencent http ${res.status}`);
  const text = decodeGbK(await res.arrayBuffer());
  const match = text.match(/="([^"]*)"/);
  if (!match) throw new Error('tencent parse');
  const parts = match[1].split('~');
  const price = parseFloat(parts[3]);
  if (!price || Number.isNaN(price)) throw new Error('tencent price');

  return buildQuote(symbol, {
    name: parts[1] || symbol,
    price,
    prevClose: parseFloat(parts[4]) || 0,
    open: parseFloat(parts[5]) || 0,
    high: parseFloat(parts[33]) || parseFloat(parts[4]) || 0,
    low: parseFloat(parts[34]) || parseFloat(parts[4]) || 0,
    volume: parseFloat(parts[6]) || 0,
    source: 'tencent',
  });
}

const PROVIDERS = [
  { name: 'eastmoney', fn: fetchEastMoney },
  { name: 'sina', fn: fetchSina },
  { name: 'tencent', fn: fetchTencent },
];

async function fetchQuote(symbol) {
  const errors = [];
  for (const p of PROVIDERS) {
    try {
      const data = await p.fn(symbol);
      console.log(`[quote] ${symbol} ok via ${p.name}`);
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[quote] ${symbol} ${p.name} failed: ${msg}`);
      errors.push(`${p.name}: ${msg}`);
    }
  }
  throw new Error(errors.join('; '));
}

app.get('/api/quote/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toLowerCase();
  try {
    const data = await fetchQuote(symbol);
    return res.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[quote] ${symbol} all failed: ${msg}`);
    return res.status(502).json({ error: msg, code: symbol });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).send('Build client first: npm run build');
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Stock proxy server http://0.0.0.0:${PORT}`);
});
