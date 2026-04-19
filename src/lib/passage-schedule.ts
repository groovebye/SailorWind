/**
 * Passage Schedule Engine — Server (Prisma access)
 *
 * Re-exports client-safe schedule helpers + adds DB-aware buildPassageSchedule
 * which resolves leg routes from the database.
 */

import { getLegRoute } from "@/lib/leg-route";

export {
  type LegSchedule,
  normalizeDeparture,
  buildClientSchedule,
} from "@/lib/passage-schedule-client";

export interface PassageSchedule {
  legs: import("@/lib/passage-schedule-client").LegSchedule[];
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
 * Server-only — uses Prisma via getLegRoute.
 */
export async function buildPassageSchedule(
  passage: PassageLike,
  useResolvedRoutes: boolean = true,
): Promise<PassageSchedule> {
  const stops = passage.waypoints.filter(w => w.isStop);
  const { normalizeDeparture } = await import("@/lib/passage-schedule-client");
  const depDate = normalizeDeparture(passage.departure);
  const depHour = depDate.getHours();
  const depMinute = depDate.getMinutes();

  let currentTime = depDate.getTime();
  const legs: import("@/lib/passage-schedule-client").LegSchedule[] = [];

  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i].port;
    const to = stops[i + 1].port;

    let distanceNm = to.coastlineNm - from.coastlineNm;
    let routeMode: "auto" | "manual" = "auto";
    let departureOverride: string | null | undefined;

    if (useResolvedRoutes) {
      try {
        const route = await getLegRoute(
          passage.id, i,
          { name: from.name, lat: from.lat, lon: from.lon },
          { name: to.name, lat: to.lat, lon: to.lon },
        );
        distanceNm = route.distanceNm;
        routeMode = route.mode as "auto" | "manual";
        departureOverride = route.departureOverride;
      } catch {
        // Fallback to coastlineNm difference
      }
    }

    if (departureOverride) {
      currentTime = normalizeDeparture(departureOverride).getTime();
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

    if (passage.mode === "daily" && i < stops.length - 2) {
      const nextDay = new Date(arriveTime);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(depHour, depMinute, 0, 0);
      if (nextDay.getTime() < arriveTime.getTime()) {
        nextDay.setDate(nextDay.getDate() + 1);
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
