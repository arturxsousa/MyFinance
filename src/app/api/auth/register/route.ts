import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import argon2 from "argon2";
import { db } from "@/db/client";
import { userRepo } from "@/db/repositories/users";
import { passwordSchema } from "@/lib/password";
import { handleRouteError, errorResponse } from "@/lib/api-error";
import { LOCALE_COOKIE, resolveLocale } from "@/i18n/config";

// Messages are i18n keys, translated by the client
const bodySchema = z.object({
  firstName: z.string().trim().min(1, "validation.required").max(60, "validation.tooLong"),
  lastName: z.string().trim().min(1, "validation.required").max(80, "validation.tooLong"),
  email: z.string().email("validation.email"),
  password: passwordSchema,
  acceptedTerms: z.literal(true, { message: "validation.termsRequired" }),
});

export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.safeParse(await req.json());
    if (!body.success) return handleRouteError(body.error);

    const { firstName, lastName, email, password } = body.data;
    const ip = req.headers.get("x-forwarded-for") ?? null;
    // New accounts start in the language the browser asked for
    const locale = resolveLocale(
      req.cookies.get(LOCALE_COOKIE)?.value,
      req.headers.get("accept-language")
    );

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    let emailTaken = false;
    await db.transaction(async (tx) => {
      const existing = await userRepo.findByEmail(tx, email);
      if (existing) {
        emailTaken = true;
        return;
      }

      void ip;
      await userRepo.create(tx, {
        firstName,
        lastName,
        email: email.toLowerCase(),
        passwordHash,
        role: "USER",
        locale,
        // Email verification on standby — activate immediately
        status: "ACTIVE",
        acceptedTermsAt: new Date(),
      });
    });

    if (emailTaken) {
      return errorResponse("EMAIL_TAKEN", "An account with this email already exists", 409, {
        email: ["validation.emailTaken"],
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
