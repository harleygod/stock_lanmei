import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

function isTradingHoursCN() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const cn = new Date(utc + 8 * 3600000);
  const day = cn.getDay();
  if (day === 0 || day === 6) return false;
  const mins = cn.getHours() * 60 + cn.getMinutes();
  return (mins >= 570 && mins <= 690) || (mins >= 780 && mins <= 900);
}

async function fetchSina(symbol) {
  const url = `https://hq.sinajs.cn/list=${symbol}`;
  const res = await fetch(url, {
    headers: { Referer: 'https://finance.sina.com.cn' },
  });
  if (!res.ok) throw new Error('sina failed');
  const text = await res.text();
  const match = text.match(/="([^"]*)"/);
  if (!match) throw new Error('sina parse');
  const parts = match[1].split(',');
  if (parts.length < 32) throw new Error('sina fields');

  const price = parseFloat(parts[3]);
  if (!price || Number.isNaN(price)) throw new Error('sina price');

  return {
    code: symbol,
    name: parts[0],
    price,
    prevClose: parseFloat(parts[2]) || 0,
    open: parseFloat(parts[1]) || 0,
    high: parseFloat(parts[4]) || 0,
    low: parseFloat(parts[5]) || 0,
    volume: parseFloat(parts[8]) || 0,
    isClosed: !isTradingHoursCN(),
    source: 'sina',
    updatedAt: new Date().toISOString(),
  };
}

async function fetchTencent(symbol) {
  const url = `https://qt.gtimg.cn/q=${symbol}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('tencent failed');
  const buf = await res.arrayBuffer();
  const text = new TextDecoder('gbk').decode(buf);
  const match = text.match(/="([^"]*)"/);
  if (!match) throw new Error('tencent parse');
  const parts = match[1].split('~');
  const price = parseFloat(parts[3]);
  if (!price || Number.isNaN(price)) throw new Error('tencent price');

  return {
    code: symbol,
    name: parts[1] || symbol,
    price,
    prevClose: parseFloat(parts[4]) || 0,
    open: parseFloat(parts[5]) || 0,
    high: parseFloat(parts[33]) || parseFloat(parts[4]) || 0,
    low: parseFloat(parts[34]) || parseFloat(parts[4]) || 0,
    volume: parseFloat(parts[6]) || 0,
    isClosed: !isTradingHoursCN(),
    source: 'tencent',
    updatedAt: new Date().toISOString(),
  };
}

app.get('/api/quote/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toLowerCase();
  try {
    const data = await fetchSina(symbol);
    return res.json(data);
  } catch {
    try {
      const data = await fetchTencent(symbol);
      return res.json(data);
    } catch (e) {
      return res.status(502).json({ error: String(e) });
    }
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).send('Build client first: npm run build');
  });
});

app.listen(PORT, () => {
  console.log(`Stock proxy server http://localhost:${PORT}`);
});
