import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";
import { ApiError } from "../api/client";

export interface AsyncState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
  setData: (fn: T | ((prev: T | null) => T)) => void;
}

/** Loads data on mount / when deps change, with loading and error state. */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fnRef
      .current()
      .then((d) => active && setDataState(d))
      .catch((e: unknown) => active && setError(e instanceof ApiError ? e : new ApiError("INTERNAL", "Something went wrong while loading.", 0)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((v: T | ((prev: T | null) => T)) => {
    setDataState((prev) => (typeof v === "function" ? (v as (p: T | null) => T)(prev) : v));
  }, []);
  return { data, error, loading, reload, setData };
}
