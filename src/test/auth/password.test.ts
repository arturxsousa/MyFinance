// @vitest-environment node
import { describe, it, expect } from "vitest";
import { passwordSchema } from "@/lib/password";

describe("passwordSchema (BR-08)", () => {
  it.each(["abcdefg1", "MyFinance2026", "a1".repeat(36)])("accepts %s", (pw) => {
    expect(passwordSchema.safeParse(pw).success).toBe(true);
  });

  it.each([
    ["shorter than 8", "abc123"],
    ["longer than 72", "a1".repeat(36) + "x"],
    ["no number", "abcdefgh"],
    ["no letter", "12345678901"],
    ["common password", "password123"],
    ["common password, different case", "PassWord123"],
  ])("rejects %s", (_label, pw) => {
    expect(passwordSchema.safeParse(pw).success).toBe(false);
  });
});
