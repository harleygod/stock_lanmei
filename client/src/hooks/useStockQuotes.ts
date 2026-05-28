import { useCallback, useEffect, useRef, useState } from 'react';
import type { StockQuote } from '../types';
import { isTradingHours } from '../utils/stockCode';
import { toQuoteSymbol } from '../utils/stockCode';

interface QuoteState {
  quotes: Record<string, StockQuote>;
  loading: boolean;
  error: string | null;
  manualMode: boolean;
}

async function fetchQuote(symbol: string): Promise<StockQuote | null> {
  const res = await fetch(`/api/quote/${symbol}`);
  if (!res.ok) return null;
  return res.json();
}

export function useStockQuotes(codes: string[], intervalSec = 15) {
  const [state, setState] = useState<QuoteState>({
    quotes: {},
    loading: false,
    error: null,
    manualMode: false,
  });
  const timerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (codes.length === 0) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    const symbols = [...new Set(codes.map((c) => toQuoteSymbol(c)))];
    const results = await Promise.all(symbols.map(fetchQuote));
    const failed = results.every((r) => r === null);

    if (failed) {
      setState((s) => ({
        ...s,
        loading: false,
        error: '行情接口异常，已切换手动模式',
        manualMode: true,
      }));
      return;
    }

    const quotes: Record<string, StockQuote> = {};
    for (const q of results) {
      if (q) quotes[q.code] = q;
    }
    setState({ quotes, loading: false, error: null, manualMode: false });
  }, [codes]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!isTradingHours()) return;
    timerRef.current = window.setInterval(refresh, intervalSec * 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refresh, intervalSec]);

  return { ...state, refresh };
}

export function getEffectivePrice(
  code: string,
  quotes: Record<string, StockQuote>,
  manualPrice?: number,
): { price: number; isClosed: boolean; source: StockQuote['source'] } {
  const symbol = toQuoteSymbol(code);
  const q = quotes[symbol];
  if (manualPrice != null && manualPrice > 0) {
    return { price: manualPrice, isClosed: q?.isClosed ?? true, source: 'manual' };
  }
  if (q) return { price: q.price, isClosed: q.isClosed, source: q.source };
  return { price: 0, isClosed: true, source: 'manual' };
}
