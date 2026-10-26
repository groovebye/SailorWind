/**
 * Umami custom events (the script is loaded in the root layout when
 * UMAMI_WEBSITE_ID is set). No-op on the server, in dev, or when blocked.
 * Keep event data non-personal: no emails, names or ids.
 */
type UmamiData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: { track: (event: string, data?: UmamiData) => void };
  }
}

export const EVENTS = {
  SIGNUP: "signup",
  VERIFY_RESENT: "verify_resent",
  PASSWORD_RESET_REQUESTED: "password_reset_requested",
  BOAT_ADDED: "boat_added",
  PASSAGE_CREATED: "passage_created",
} as const;

export function track(event: (typeof EVENTS)[keyof typeof EVENTS], data?: UmamiData): void {
  if (typeof window === "undefined") return;
  try {
    window.umami?.track(event, data);
  } catch {
    // analytics must never break the app
  }
}
