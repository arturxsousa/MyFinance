import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { userRepo } from "@/db/repositories/users";
import { authTokenRepo } from "@/db/repositories/auth-tokens";
import { generateToken } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";
import { handleRouteError } from "@/lib/api-error";

const bodySchema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.safeParse(await req.json());
    if (!body.success) return handleRouteError(body.error);

    const { email } = body.data;
    const { raw, hash } = generateToken();

    await db.transaction(async (tx) => {
      const user = await userRepo.findByEmail(tx, email);
      if (!user || user.status !== "PENDING") return; // generic — reveal nothing

      await authTokenRepo.create(tx, {
        userId: user.id,
        purpose: "VERIFY_EMAIL",
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await sendVerificationEmail(email, raw);
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
