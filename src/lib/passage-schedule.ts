/**
 * Passage Schedule Engine
 *
 * Single source of truth for leg departure/arrival times.
 * Used by: passage dashboard, leg page, timeline, tides, execution.
 *
 * Rules for daily mode:
 * - Leg 1 departs at passage departure datetime
 * - Leg N+1 departs next calendar day at passage departure hour
 * - If previous arrival is later than preferred hour, still depart next day
 */

import { getLegRoute } from "@/lib/leg-route";

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

export interface PassageSchedule {
  legs: LegSchedule[];
  totalDistanceNm: number;
  totalHours: number;
}

interface PortLike {
  name: string;
  slug: string;
  lat: number;
  lon: number;
  coastlineNm: number;
}

interface WaypointLike {
  port: PortLike;
  isStop: boolean;
  isCape: boolean;
}

interface PassageLike {
  id: string;
  departure: Date | string;
  speed: number;
  mode: "daily" | "nonstop";
  waypoints: WaypointLike[];
}

/**
 * Build complete passage schedule with per-leg times.
 * Optionally uses resolved route distances (from manual routes).
 */
export async function buildPassageSchedule(
  passage: PassageLike,
  useResolvedRoutes: boolean = true,
): Promise<PassageSchedule> {
  const stops = passage.waypoints.filter(w => w.isStop);
  const depDate = new Date(passage.departure);
  const depHour = depDate.getUTCHours();
  const depMinute = depDate.getUTCMinutes();

  let currentTime = depDate.getTime();
  const legs: LegSchedule[] = [];

  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i].port;
    const to = stops[i + 1].port;

    // Get distance — use resolved route if available
    let distanceNm = to.coastlineNm - from.coastlineNm;
    let routeMode: "auto" | "manual" = "auto";

    if (useResolvedRoutes) {
      try {
        const route = await getLegRoute(
          passage.id, i,
          { name: from.name, lat: from.lat, lon: from.lon },
          { name: to.name, lat: to.lat, lon: to.lon },
        );
        distanceNm = route.distanceNm;
        routeMode = route.mode as "auto" | "manual";
      } catch {
        // Fallback to coastlineNm difference
      }
    }

    const hours = distanceNm / passage.speed;
    const departTime = new Date(currentTime);
    const arriveTime = new Date(currentTime + hours * 3600000);

    legs.push({
      legIndex: i,
      from,
      to,
      distanceNm: Math.round(distanceNm * 10) / 10,
      hours: Math.round(hours * 10) / 10,
      departTime,
      arriveTime,
      routeMode,
    });

    // Compute next departure
    if (passage.mode === "daily" && i < stops.length - 2) {
      // Next day at same hour as original departure
      const nextDay = new Date(arriveTime);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      nextDay.setUTCHours(depHour, depMinute, 0, 0);
      // If somehow arrival is after next day's preferred time, still use next day
      if (nextDay.getTime() < arriveTime.getTime()) {
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      }
      currentTime = nextDay.getTime();
    } else {
      currentTime = arriveTime.getTime();
    }
  }

  return {
    legs,
    totalDistanceNm: Math.round(legs.reduce((s, l) => s + l.distanceNm, 0) * 10) / 10,
    totalHours: Math.round(legs.reduce((s, l) => s + l.hours, 0) * 10) / 10,
  };
}

/**
 * Client-side schedule computation (no DB access, uses coastlineNm distances).
 * Used by passage dashboard and leg page for immediate rendering.
 */
export function buildClientSchedule(
  departure: string | Date,
  speed: number,
  mode: "daily" | "nonstop",
  stops: { name: string; slug: string; lat: number; lon: number; coastlineNm: number }[],
  resolvedDistances?: Record<number, number>, // legIndex → distanceNm
): LegSchedule[] {
  const depDate = new Date(departure);
  const depHour = depDate.getUTCHours();
  const depMinute = depDate.getUTCMinutes();

  let currentTime = depDate.getTime();
  const legs: LegSchedule[] = [];

  for (let i = 0; i < stops.length - 1; i++) {
    const distanceNm = resolvedDistances?.[i] ?? (stops[i + 1].coastlineNm - stops[i].coastlineNm);
    const hours = distanceNm / speed;
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
