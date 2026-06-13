// src/hooks/useMultiSelect.js — 全选联动规则（§1.7 / §5.3）
// 通用规则：支持多选 + 全选双向同步
//
// 应用场景：
//   - §1.5 抛个钩子「指定给谁讲」
//   - §5.3 时间胶囊「送给谁」

import { useState, useCallback, useMemo } from 'react';

export function useMultiSelect(options = []) {
  const [selected, setSelected] = useState([]);

  const allOptionIds = useMemo(() => options.map(o => typeof o === 'string' ? o : o.id || o), [options]);

  const isAllSelected = useMemo(
    () => allOptionIds.length > 0 && allOptionIds.every(id => selected.includes(id)),
    [selected, allOptionIds]
  );

  const toggle = useCallback((id) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const toggleAll = useCallback(() => {
    if (isAllSelected) {
      setSelected([]);
    } else {
      setSelected([...allOptionIds]);
    }
  }, [isAllSelected, allOptionIds]);

  const clear = useCallback(() => setSelected([]), []);

  return {
    selected,
    setSelected,
    isAllSelected,
    toggle,
    toggleAll,
    clear,
    count: selected.length,
  };
}
