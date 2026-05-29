/**
 * Passage Schedule Engine — Client-Safe
 *
 * Pure client-side schedule computation (no DB access, no Prisma imports).
 * Used by passage dashboard and leg page for immediate rendering.
 *
 * Rules for "always local time" (timezone-independent):
 * - A departure is a naive wall-clock ("2026-06-15T08:00"), no timezone.
 * - We anchor it to a FIXED instant by appending "Z" (parse as UTC), and we
 *   sequence the schedule purely with UTC getters/setters. This makes the
 *   result identical on any machine/browser timezone — "what you type is what
 *   you see" — provided the display layer also renders in UTC (fmtLocal + "UTC").
 * - This is the single canonical schedule engine. The server wrapper
 *   (passage-schedule.ts) and the timeline engine (passage-computation buildLegs)
 *   both delegate here so all three never diverge.
 *
 * Rules for daily mode:
 * - Leg 1 departs at passage departure datetime
 * - Leg N+1 departs next calendar day at passage departure hour
 * - Per-leg overrides take precedence over chained timing
 */

export interface LegSchedule {
  legIndex: number;
  from: { name: string; slug: string; lat: number; lon: number; coastlineNm: number };
  to: { name: string; slug: string; lat: number; lon: number; coastlineNm: number };
  distanceNm: number;
  hours: number;
  departTime: Date;
  arriveTime: Date;
  routeMode: "auto" | "manual";
}

/**
 * Normalize a departure value (Date | ISO string | "YYYY-MM-DDTHH:mm" local) to a Date.
 * Always treats the wall-clock part as the user's intended time, regardless of TZ markers.
 */
export function normalizeDeparture(input: string | Date): Date {
  if (input instanceof Date) return input;
  // Strip any TZ marker, then anchor the wall-clock to UTC so parsing is
  // identical regardless of the machine/browser timezone.
  const stripped = input.replace("Z", "").replace(/[+-]\d{2}:?\d{2}$/, "").slice(0, 16);
  return new Date(stripped + "Z");
}

/**
 * Format a Date's UTC wall-clock as a `datetime-local` input value
 * ("YYYY-MM-DDTHH:mm"). Mirror of normalizeDeparture for the edit UI.
 */
export function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function buildClientSchedule(
  departure: string | Date,
  speed: number,
  mode: "daily" | "nonstop",
  stops: { name: string; slug: string; lat: number; lon: number; coastlineNm: number }[],
  resolvedDistances?: Record<number, number>,
  legDepartureOverrides?: Record<number, string>,
): LegSchedule[] {
  const depDate = normalizeDeparture(departure);
  const depHour = depDate.getUTCHours();
  const depMinute = depDate.getUTCMinutes();

  let currentTime = depDate.getTime();
  const legs: LegSchedule[] = [];

  for (let i = 0; i < stops.length - 1; i++) {
    const distanceNm = resolvedDistances?.[i] ?? (stops[i + 1].coastlineNm - stops[i].coastlineNm);
    const hours = distanceNm / speed;

    // Apply per-leg override if present
    const override = legDepartureOverrides?.[i];
    if (override) {
      currentTime = normalizeDeparture(override).getTime();
    }

    const departTime = new Date(currentTime);
    const arriveTime = new Date(currentTime + hours * 3600000);

    legs.push({
      legIndex: i,
      from: stops[i],
      to: stops[i + 1],
      distanceNm: Math.round(distanceNm * 10) / 10,
      hours: Math.round(hours * 10) / 10,
      departTime,
      arriveTime,
      routeMode: resolvedDistances?.[i] ? "manual" : "auto",
    });

    if (mode === "daily" && i < stops.length - 2) {
      const nextDay = new Date(arriveTime);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      nextDay.setUTCHours(depHour, depMinute, 0, 0);
      if (nextDay.getTime() < arriveTime.getTime()) {
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      }
      currentTime = nextDay.getTime();
    } else {
      currentTime = arriveTime.getTime();
    }
  }

  return legs;
}
