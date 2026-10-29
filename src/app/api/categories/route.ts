import { NextRequest, NextResponse } from "next/server";
import { withUserDb } from "@/db/with-user-db";
import { categoryRepo } from "@/db/repositories/categories";
import { requireUser } from "@/lib/guards";
import { createCategorySchema, kindSchema, toCategoryDto } from "@/lib/categories";
import { clashesWithSystemName, nameTakenResponse } from "./shared";
import { handleRouteError } from "@/lib/api-error";

// UC-12 — system categories + the caller's own, archived included (the page
// shows them; pickers filter them out).
export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireUser();

    const kindParam = req.nextUrl.searchParams.get("kind");
    const kind = kindParam === null ? undefined : kindSchema.safeParse(kindParam);
    if (kind && !kind.success) return handleRouteError(kind.error);

    const rows = await withUserDb(userId, (tx) => categoryRepo.list(tx, kind?.data));
    return NextResponse.json({ categories: rows.map(toCategoryDto) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireUser();

    const body = createCategorySchema.safeParse(await req.json());
    if (!body.success) return handleRouteError(body.error);
    const { kind, name, color } = body.data;

    const created = await withUserDb(userId, async (tx) => {
      if (await clashesWithSystemName(tx, kind, name)) return null;
      return categoryRepo.create(tx, { userId, kind, name, color });
    });

    if (!created) return nameTakenResponse();
    return NextResponse.json({ category: toCategoryDto(created) }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
