import { z } from "zod";

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
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[a-zA-Z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .refine((v) => !COMMON_PASSWORDS.has(v.toLowerCase()), "Password is too common");
