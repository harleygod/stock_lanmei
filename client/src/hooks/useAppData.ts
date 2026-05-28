import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppDataV2 } from '../types';
import { DEFAULT_DATA } from '../types';
import { migrateData } from '../utils/migrate';

const API = '/api/data';

async function fetchData(): Promise<AppDataV2 | null> {
  try {
    const res = await fetch(API);
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ? migrateData(json.data) : null;
  } catch {
    return null;
  }
}

async function postData(data: AppDataV2): Promise<void> {
  try {
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch {
    // silent fail - data still in memory
  }
}

export function useAppData() {
  const [data, setData] = useState<AppDataV2>(() => {
    // Try localStorage first for instant load, then sync with server
    try {
      const raw = localStorage.getItem('stock-decision-assistant-v2');
      if (raw) {
        const parsed = migrateData(JSON.parse(raw));
        // Migrate localStorage to server on next tick
        setTimeout(() => postData(parsed), 0);
        return parsed;
      }
    } catch {}
    return structuredClone(DEFAULT_DATA);
  });
  const [loading, setLoading] = useState(true);
  const lastSaved = useRef<string>('');

  // Load from server on mount
  useEffect(() => {
    fetchData().then((serverData) => {
      if (serverData) {
        // Use server data if it has more positions or is newer
        const serverCount = serverData.portfolios.reduce((s, p) => s + p.positions.length, 0);
        const localCount = data.portfolios.reduce((s, p) => s + p.positions.length, 0);
        if (serverCount >= localCount) {
          // Also save to localStorage for fast startup next time
          try { localStorage.setItem('stock-decision-assistant-v2', JSON.stringify(serverData)); } catch {}
          setData(serverData);
        }
      } else if (data.portfolios.reduce((s, p) => s + p.positions.length, 0) > 0) {
        // No server data but we have local data → push to server
        postData(data);
      }
      setLoading(false);
    });
  }, []);

  // Save to server on data change (debounced)
  useEffect(() => {
    const json = JSON.stringify(data);
    if (json === lastSaved.current) return;
    lastSaved.current = json;
    const timer = setTimeout(() => postData(data), 500);
    // Also save to localStorage as backup
    try { localStorage.setItem('stock-decision-assistant-v2', json); } catch {}
    return () => clearTimeout(timer);
  }, [data]);

  const update = useCallback((fn: (prev: AppDataV2) => AppDataV2) => {
    setData((prev) => fn(prev));
  }, []);

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const importJson = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        const migrated = migrateData(parsed);
        setData(migrated);
        postData(migrated);
      } catch {
        alert('导入失败：文件格式不正确');
      }
    };
    reader.readAsText(file);
  }, []);

  const clearAll = useCallback(() => {
    if (confirm('确定清空所有数据？此操作不可恢复。')) {
      const fresh = structuredClone(DEFAULT_DATA);
      setData(fresh);
      localStorage.removeItem('stock-decision-assistant-v2');
      localStorage.removeItem('stock-decision-assistant-v1');
      postData(fresh);
    }
  }, []);

  return { data, update, exportJson, importJson, clearAll, loading };
}
