'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/fetch';

interface QueryResult<T> {
  url: string;
  data: T | null;
  error: string | null;
}

/**
 * Fetches `url` with apiFetch whenever it changes. Responses for a URL the
 * component has since moved away from are ignored, so a slow request can never
 * overwrite a newer one. While a new URL loads, the last data stays available.
 */
export function useApiQuery<T>(url: string) {
  const [result, setResult] = useState<QueryResult<T> | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<T>(url)
      .then(data => { if (active) setResult({ url, data, error: null }); })
      .catch((e: unknown) => {
        if (active) setResult({ url, data: null, error: e instanceof Error ? e.message : String(e) });
      });
    return () => { active = false; };
  }, [url]);

  const isCurrent = result?.url === url;
  return {
    data: result?.data ?? null,
    error: isCurrent ? result.error : null,
    loading: !isCurrent,
  };
}
