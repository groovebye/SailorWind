import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";
import { hashToken, randomToken } from "./tokens";
import { safeNext } from "./safe-redirect";
import { boatSchema, resetPasswordSchema, signupSchema } from "./schemas";

describe("password hashing", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("Sailing123");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("Sailing123", hash)).toBe(true);
    expect(await verifyPassword("sailing123", hash)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("Sailing123")).not.toBe(await hashPassword("Sailing123"));
  });

  it("rejects missing or malformed hashes", async () => {
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", "bcrypt$whatever")).toBe(false);
  });
});

describe("tokens", () => {
  it("are random, url-safe and hash deterministically", () => {
    const a = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(a);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).toHaveLength(64);
  });
});

describe("safeNext", () => {
  it("keeps same-site relative paths", () => {
    expect(safeNext("/p/abc123/map")).toBe("/p/abc123/map");
    expect(safeNext("/settings?welcome=1")).toBe("/settings?welcome=1");
  });
  it("blocks open redirects and junk", () => {
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "evil", "", null, undefined, "/x\nSet-Cookie"]) {
      expect(safeNext(bad)).toBe("/");
    }
  });
  it("never loops back to the auth pages", () => {
    expect(safeNext("/login?next=/x")).toBe("/");
    expect(safeNext("/signup")).toBe("/");
  });
});

describe("schemas", () => {
  it("signup normalises email and enforces password rules + terms", () => {
    const ok = signupSchema.safeParse({ name: " Alex ", email: " Skipper@Example.COM ", password: "abc12345", terms: "on" });
    expect(ok.success && ok.data.email).toBe("skipper@example.com");
    expect(ok.success && ok.data.name).toBe("Alex");
    expect(signupSchema.safeParse({ name: "A", email: "a@b.co", password: "abcdefgh", terms: "on" }).success).toBe(false);
    expect(signupSchema.safeParse({ name: "A", email: "a@b.co", password: "abc12345" }).success).toBe(false);
  });

  it("boat: numbers from form strings, empty optionals ignored, ranges enforced", () => {
    const b = boatSchema.safeParse({ name: "Bossanova", model: "", loaMeters: "9.5", draftMeters: "1.45", engineCruiseKt: "6.2", engineMaxKt: "" });
    expect(b.success).toBe(true);
    if (b.success) {
      expect(b.data.loaMeters).toBe(9.5);
      expect(b.data.model).toBeUndefined();
      expect(b.data.engineMaxKt).toBeUndefined();
    }
    expect(boatSchema.safeParse({ name: "X", loaMeters: "", draftMeters: "1", engineCruiseKt: "5" }).success).toBe(false);
    expect(boatSchema.safeParse({ name: "X", loaMeters: "9", draftMeters: "12", engineCruiseKt: "5" }).success).toBe(false);
  });

  it("reset password requires matching confirmation", () => {
    const token = "t".repeat(43);
    expect(resetPasswordSchema.safeParse({ token, password: "abc12345", confirm: "abc12345" }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ token, password: "abc12345", confirm: "abc12346" }).success).toBe(false);
  });
});
