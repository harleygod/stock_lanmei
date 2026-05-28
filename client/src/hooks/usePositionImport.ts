import { useEffect } from 'react';
import type { StockImportPayload } from '../types';

export function usePositionImport(
  payload: StockImportPayload | null,
  tick: number,
  apply: (p: StockImportPayload) => void,
) {
  useEffect(() => {
    if (payload && tick > 0) apply(payload);
  }, [tick, payload, apply]);
}
