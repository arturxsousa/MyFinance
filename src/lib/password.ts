import { z } from "zod";

// Messages are i18n keys (src/i18n/messages), translated by the client.

const COMMON_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "password",
  "password1",
  "password123",
  "iloveyou",
  "sunshine",
  "princess",
  "football",
  "monkey",
  "shadow",
  "master",
  "dragon",
  "letmein",
  "welcome",
  "abc12345",
  "qwerty123",
  "admin123",
  "root1234",
  "passw0rd",
]);

export const passwordSchema = z
  .string()
  .min(8, "validation.passwordMin")
  .max(72, "validation.passwordMax")
  .regex(/[a-zA-Z]/, "validation.passwordLetter")
  .regex(/[0-9]/, "validation.passwordNumber")
  .refine((v) => !COMMON_PASSWORDS.has(v.toLowerCase()), "validation.passwordCommon");
