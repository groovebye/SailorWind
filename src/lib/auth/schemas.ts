import * as z from "zod";

// Normalise first, then validate the format (pasted addresses often carry spaces).
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Please enter a valid email address." }).max(254));

export const passwordSchema = z
  .string()
  .min(8, { error: "Password must be at least 8 characters." })
  .max(128, { error: "Password is too long." })
  .regex(/[a-zA-Z]/, { error: "Password must contain a letter." })
  .regex(/[0-9]/, { error: "Password must contain a number." });

const name = z.string().trim().min(1, { error: "Name is required." }).max(80);

/** FormData gives "" for empty inputs — treat that as "not provided". */
const optNum = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z.number({ error: `${label} must be a number.` }).min(min, { error: `${label} must be ≥ ${min}.` }).max(max, { error: `${label} must be ≤ ${max}.` }).optional(),
  );
const reqNum = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z.number({ error: `${label} is required.` }).min(min, { error: `${label} must be ≥ ${min}.` }).max(max, { error: `${label} must be ≤ ${max}.` }),
  );
const optText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());

export const boatSchema = z.object({
  name: z.string().trim().min(1, { error: "Boat name is required." }).max(60),
  model: optText(80),
  loaMeters: reqNum(3, 40, "Length (LOA)"),
  draftMeters: reqNum(0.3, 6, "Draft"),
  engineCruiseKt: reqNum(1, 20, "Cruising speed"),
  engineMaxKt: optNum(1, 25, "Max speed"),
  fuelTankLiters: optNum(0, 5000, "Fuel tank"),
  fuelBurnLph: optNum(0, 100, "Fuel burn"),
  notes: optText(500),
});
export type BoatInput = z.infer<typeof boatSchema>;

export const signupSchema = z.object({
  name,
  email,
  password: passwordSchema,
  terms: z.literal("on", { error: "You must accept the terms." }),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: "Password is required." }).max(128),
});

export const emailOnlySchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { error: "Passwords don't match.", path: ["confirm"] });

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, { error: "Current password is required." }),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { error: "Passwords don't match.", path: ["confirm"] });

export const profileSchema = z.object({ name });

/** First error message per field, for inline form errors. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
