/**
 * Coast table-list: La Coruña → Gibraltar
 * =======================================
 * ONE continuous, route-ordered list of every marina, refuge/reserve port and
 * notable anchorage, sequenced along the cruising route:
 *   Galicia (south of La Coruña) → Portugal (N → S) → SW Spain (Gulf of Cádiz)
 *   → Strait of Gibraltar.
 *
 * This continues the existing northern list (Gijón=0 … La Coruña=160) — the
 * `coastlineNm` value is an ORDERING key only (per the P2 decision), derived at
 * seed time as cumulative great-circle distance from La Coruña (start 160) along
 * the ordered coordinates. Real leg distances come from resolved route geometry.
 *
 * Sourcing rules (safety-critical data):
 *  - Every entry carries `sources` (URLs actually used) and a `confidence`.
 *  - Nothing is invented: unknown fields are null and `confidence` is lowered.
 *  - `verifyNeeded` lists fields to cross-check against official charts before use.
 *
 * Populated per region as the background research lands. Keep ROUTE ORDER.
 */

export type CoastEntryType = "marina" | "port" | "anchorage" | "cape";
export type Confidence = "official" | "curated" | "estimated";

export type CoastEntry = {
  // Identity & position
  name: string;
  slug: string;
  type: CoastEntryType;
  lat: number;
  lon: number;
  country: string;            // ISO-ish: "ES" | "PT" | "GI"
  region: string;             // e.g. "Galicia / Rías Baixas", "Portugal / Algarve"
  coastSegment: CoastSegment;
  coastlineNm: number | null; // derived at seed time (ordering key); null until computed

  // Facilities (null = unknown, not "absent")
  fuel: boolean | null;
  water: boolean | null;
  electric: boolean | null;
  repairs: boolean | null;
  customs: boolean | null;
  showers?: boolean | null;
  laundry?: boolean | null;
  wifi?: boolean | null;

  // Marina/harbour detail
  shelter?: "good" | "moderate" | "poor" | null;
  maxDraft?: number | null;   // metres
  maxLength?: number | null;  // metres (max LOA)
  berthCount?: number | null;
  visitorBerths?: number | null;
  marinaName?: string | null;
  marinaHours?: string | null;
  vhfCh?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;

  // Pilotage & local knowledge
  approachNotes?: string | null;        // entrance, leading marks, hazards, bar/swell
  approachDescription?: string | null;  // longer narrative
  swellSensitivity?: string | null;
  bestTideEntry?: string | null;
  notes?: string | null;                // why stop; refuge value; crew change/provisioning
  passageNotes?: string | null;

  // Safety
  orcaRisk?: "none" | "low" | "medium" | "high" | null;
  orcaNotes?: string | null;

  // Provenance
  sources: string[];
  confidence: Confidence;
  verifyNeeded?: string[];
};

/** Ordered coastal segments continuing south from the existing northern list. */
export const COAST_SEGMENTS = [
  "galicia-costa-morte",   // La Coruña → Camariñas → Muxía → Fisterra
  "galicia-rias-baixas",   // Muros → Arousa → Pontevedra → Vigo → Baiona → A Guarda
  "portugal-norte",        // Caminha → Viana → Póvoa → Leixões → Aveiro
  "portugal-centro",       // Figueira → Nazaré → Peniche → Cascais → Lisbon → Sesimbra → Setúbal → Sines
  "portugal-algarve",      // Sagres → Lagos → Portimão → Vilamoura → Faro → VRSA
  "cadiz-gulf",            // Ayamonte → Mazagón → Chipiona → Cádiz → Barbate → Tarifa
  "gibraltar-strait",      // La Línea → Gibraltar
] as const;
export type CoastSegment = (typeof COAST_SEGMENTS)[number];

/**
 * THE LIST. Route-ordered, north→south then west→east toward Gibraltar.
 * Filled per region from the background research (sourced, confidence-tagged).
 */
export const COAST_SOUTH: CoastEntry[] = [
  // ── galicia-costa-morte ───────────────────────────────────────────
  // ── galicia-rias-baixas ──────────────────────────────────────────
  // ── portugal-norte ───────────────────────────────────────────────
  // ── portugal-centro ──────────────────────────────────────────────
  // ── portugal-algarve ─────────────────────────────────────────────
  // ── cadiz-gulf ───────────────────────────────────────────────────
  // ── gibraltar-strait ─────────────────────────────────────────────
];
