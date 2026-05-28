import { useCallback, useEffect, useState } from 'react';
import type { AppDataV2 } from '../types';
import { DEFAULT_DATA } from '../types';
import { loadData, migrateData, saveData } from '../utils/migrate';

export function useAppData() {
  const [data, setData] = useState<AppDataV2>(loadData);

  useEffect(() => {
    saveData(data);
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
        setData(migrateData(parsed));
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
