import { useCallback, useEffect, useState } from 'react';
import type { AppData } from '../types';
import { DEFAULT_DATA } from '../types';

const STORAGE_KEY = 'stock-decision-assistant-v1';

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_DATA);
    const parsed = JSON.parse(raw) as AppData;
    return { ...DEFAULT_DATA, ...parsed, settings: { ...DEFAULT_DATA.settings, ...parsed.settings } };
  } catch {
    return structuredClone(DEFAULT_DATA);
  }
}

function save(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useAppData() {
  const [data, setData] = useState<AppData>(load);

  useEffect(() => {
    save(data);
  }, [data]);

  const update = useCallback((fn: (prev: AppData) => AppData) => {
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
        const parsed = JSON.parse(reader.result as string) as AppData;
        setData({ ...DEFAULT_DATA, ...parsed });
      } catch {
        alert('导入失败：文件格式不正确');
      }
    };
    reader.readAsText(file);
  }, []);

  const clearAll = useCallback(() => {
    if (confirm('确定清空所有数据？此操作不可恢复。')) {
      setData(structuredClone(DEFAULT_DATA));
    }
  }, []);

  return { data, update, exportJson, importJson, clearAll };
}
