import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

export interface TaskFilters {
  status?: string;
  priority?: string;
  dueFrom?: string;
  dueTo?: string;
  projectId?: string;
}

const KEYS: (keyof TaskFilters)[] = ["status", "priority", "dueFrom", "dueTo", "projectId"];

// Filters live entirely in the URL's query string (?status=...&priority=...)
// so a filtered task list can be copied and shared, per spec.
export function useQueryFilters(): [TaskFilters, (patch: Partial<TaskFilters>) => void] {
  const [params, setParams] = useSearchParams();

  const filters: TaskFilters = {};
  KEYS.forEach((k) => {
    const v = params.get(k);
    if (v) filters[k] = v;
  });

  const update = useCallback(
    (patch: Partial<TaskFilters>) => {
      const next = new URLSearchParams(params);
      Object.entries(patch).forEach(([k, v]) => {
        if (!v) next.delete(k);
        else next.set(k, v);
      });
      setParams(next, { replace: true });
    },
    [params, setParams]
  );

  return [filters, update];
}
