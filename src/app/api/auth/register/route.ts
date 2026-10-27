import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import argon2 from "argon2";
import { db } from "@/db/client";
import { userRepo } from "@/db/repositories/users";
import { passwordSchema } from "@/lib/password";
import { handleRouteError, errorResponse } from "@/lib/api-error";

const bodySchema = z.object({
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  password: passwordSchema,
  acceptedTerms: z.literal(true, { message: "You must accept the terms" }),
});

export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.safeParse(await req.json());
    if (!body.success) return handleRouteError(body.error);

    const { firstName, lastName, email, password } = body.data;
    const ip = req.headers.get("x-forwarded-for") ?? null;

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
        // Email verification on standby — activate immediately
        status: "ACTIVE",
        acceptedTermsAt: new Date(),
      });
    });

    if (emailTaken) {
      return errorResponse("EMAIL_TAKEN", "An account with this email already exists", 409, {
        email: ["An account with this email already exists"],
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
