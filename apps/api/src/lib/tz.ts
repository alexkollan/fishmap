// Open-Meteo's `timezone=auto` returns naive local wall-clock strings with no
// UTC offset (e.g. "2026-08-21T00:00"). `new Date(...)` on that string is
// parsed as the *runtime's* local time, not the location's — silently wrong
// for anyone (browser or server) not sitting in the same zone as the data
// point. Convert once here so every WeatherHour.time downstream is an
// unambiguous UTC instant, safe to `new Date()` anywhere.
function timeZoneOffsetMs(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) if (p.type !== "literal") parts[p.type] = p.value;

  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asIfUtc - date.getTime();
}

export function zonedNaiveToUtcIso(naive: string, timeZone: string): string {
  const guess = new Date(`${naive}Z`);
  const offsetMs = timeZoneOffsetMs(timeZone, guess);
  return new Date(guess.getTime() - offsetMs).toISOString();
}
