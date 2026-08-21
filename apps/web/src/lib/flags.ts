import { useQuery } from "@tanstack/react-query";

async function fetchFlags(): Promise<Record<string, boolean>> {
  const res = await fetch("/api/flags", { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load flags: ${res.status}`);
  return res.json() as Promise<Record<string, boolean>>;
}

/** DEV_PLAN.md §8: every non-trivial feature ships behind a flag. */
export function useFlag(key: string): boolean {
  const { data } = useQuery({ queryKey: ["flags"], queryFn: fetchFlags, staleTime: 60_000 });
  return data?.[key] ?? false;
}
