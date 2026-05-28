import { useEffect } from 'react';
import type { PositionImportPayload } from '../types';

export function usePositionImport(
  payload: PositionImportPayload | null,
  tick: number,
  apply: (p: PositionImportPayload) => void,
) {
  useEffect(() => {
    if (payload && tick > 0) apply(payload);
  }, [tick, payload, apply]);
}
