import { useEffect, useRef, useState } from "react";
import type { ActiveLocation } from "@fishmap/types";
import { searchLocations } from "./search";

const DEBOUNCE_MS = 350;

export function useLocationSearch(query: string) {
  const [results, setResults] = useState<ActiveLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const found = await searchLocations(query, controller.signal);
        setResults(found);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Search failed");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return { results, loading, error };
}
