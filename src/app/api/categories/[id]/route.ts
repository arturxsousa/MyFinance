import { NextRequest, NextResponse } from "next/server";
import { withUserDb } from "@/db/with-user-db";
import { categoryRepo } from "@/db/repositories/categories";
import { requireUser } from "@/lib/guards";
import { parseId } from "@/lib/ownership";
import { toCategoryDto, updateCategorySchema } from "@/lib/categories";
import { clashesWithSystemName, nameTakenResponse, readOnlyResponse } from "../shared";
import { errorResponse, handleRouteError } from "@/lib/api-error";

type Ctx = { params: Promise<{ id: string }> };

const notFound = () => errorResponse("NOT_FOUND", "Resource not found", 404);

// Rename, recolor, archive / unarchive (isActive). Own categories only.
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { userId } = await requireUser();
    const id = parseId((await params).id);

    const body = updateCategorySchema.safeParse(await req.json());
    if (!body.success) return handleRouteError(body.error);

    const result = await withUserDb(userId, async (tx) => {
      // RLS: another user's category is invisible → 404 (BR-01); system → read-only
      const current = await categoryRepo.findById(tx, id);
      if (!current) return "NOT_FOUND" as const;
      if (current.userId === null) return "READ_ONLY" as const;

      if (body.data.name && (await clashesWithSystemName(tx, current.kind, body.data.name))) {
        return "NAME_TAKEN" as const;
      }
      return (await categoryRepo.update(tx, id, body.data)) ?? ("NAME_TAKEN" as const);
    });

    if (result === "NOT_FOUND") return notFound();
    if (result === "READ_ONLY") return readOnlyResponse();
    if (result === "NAME_TAKEN") return nameTakenResponse();
    return NextResponse.json({ category: toCategoryDto(result) });
  } catch (err) {
    return handleRouteError(err);
  }
}

// BR-06: deletes if unused, archives if in use. Response says which happened.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { userId } = await requireUser();
    const id = parseId((await params).id);

    const result = await withUserDb(userId, async (tx) => {
      const current = await categoryRepo.findById(tx, id);
      if (!current) return "not_found" as const;
      if (current.userId === null) return "read_only" as const;
      return categoryRepo.deleteOrArchive(tx, id);
    });

    if (result === "not_found") return notFound();
    if (result === "read_only") return readOnlyResponse();
    return NextResponse.json({ result });
  } catch (err) {
    return handleRouteError(err);
  }
}
