"use client";

import { useEffect, useState } from "react";
import type { ApiClientResult } from "./apiClient";

export interface UseAdminDataResult<T> {
  data: T | null;
  loading: boolean;
  /** Set for any non-403 failure (network error, validation, 500, etc.)
   *  — the message to show in a generic error state. 401 never reaches
   *  here: apiClient.ts's apiFetch() redirects to /admin/login itself
   *  once refresh fails, before returning control to a caller. */
  error: string | null;
  /** True specifically for 403 — a valid session, insufficient role.
   *  Kept distinct from `error` so a page can render a dedicated "you
   *  don't have permission" state instead of a generic failure banner. */
  forbidden: boolean;
  reload: () => void;
}

/**
 * The shared data-fetching lifecycle every dashboard page needs
 * (loading → success | error | forbidden), used identically across all
 * six admin pages — the threshold where a shared hook earns its keep
 * over repeating the same states and effect six times.
 *
 * Two things this deliberately avoids, both flagged by this codebase's
 * React 19 lint rules on the first two attempts at this file: calling
 * `setLoading(true)` synchronously at the top of the effect body
 * (`react-hooks/set-state-in-effect` — can trigger extra render
 * cascades) and reading a ref's `.current` during render to derive
 * `loading` (a newer "cannot access refs during render" rule — ref
 * reads aren't guaranteed current under concurrent rendering). The fix
 * is React's own documented pattern for "reset state when a dependency
 * changes": a conditional `setState` call in the render body itself
 * (not in an effect, not from a ref) — React special-cases this,
 * re-rendering immediately with the new state before committing, no
 * extra visible frame.
 *
 * `fetcher` is expected to be a fresh closure each render (capturing
 * the calling component's current filter/page state) — intentionally
 * not itself a dependency. `deps` is what should trigger a refetch
 * (e.g. `[page, filters.status]`); serialized to a string key so both
 * the effect and the render-phase check can compare against it —
 * exhaustive-deps can't statically analyze that, hence the disable.
 */
export function useAdminData<T>(fetcher: () => Promise<ApiClientResult<T>>, deps: unknown[]): UseAdminDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [loading, setLoading] = useState(true);

  const depsKey = JSON.stringify([...deps, reloadToken]);
  const [trackedKey, setTrackedKey] = useState(depsKey);

  if (trackedKey !== depsKey) {
    setTrackedKey(depsKey);
    setLoading(true);
  }

  useEffect(() => {
    let ignore = false;

    fetcher().then((result) => {
      if (ignore) return;
      if (result.success) {
        setData(result.data);
        setError(null);
        setForbidden(false);
      } else if (result.status === 403) {
        setForbidden(true);
      } else {
        setError(result.errors[0]?.message ?? "Something went wrong.");
      }
      setLoading(false);
    });

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey]);

  return {
    data,
    loading,
    // Suppress a stale error/forbidden from a previous deps value while
    // the current one is still in flight.
    error: loading ? null : error,
    forbidden: loading ? false : forbidden,
    reload: () => setReloadToken((t) => t + 1),
  };
}
