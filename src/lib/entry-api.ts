import { NextRequest, NextResponse } from "next/server";
import { withUserDb, type UserTx } from "@/db/with-user-db";
import { entryRepos, type EntryRow } from "@/db/repositories/entries";
import { userRepo } from "@/db/repositories/users";
import { requireUser } from "@/lib/guards";
import { parseId, requireOwned } from "@/lib/ownership";
import { checkEntryCategory } from "@/lib/entry-category";
import { currentYearMonth, isScheduled, monthDateRange } from "@/lib/date";
import {
  PAGE_SIZE,
  createEntrySchemas,
  listEntriesQuerySchema,
  updateEntrySchemas,
  type EntryKind,
} from "@/lib/entries";
import { ApiError, errorResponse, handleRouteError } from "@/lib/api-error";

// Generic /{kind} API (UC-07 to UC-10), instantiated once per kind by the
// route files under src/app/api/{incomes,expenses,investments}.

type IdContext = { params: Promise<{ id: string }> };

/** Client-facing shape. Kind-specific fields only appear on their kind. */
export function toEntryDto(kind: EntryKind, row: EntryRow, timezone: string) {
  const dto = {
    id: row.id,
    kind,
    categoryId: row.categoryId,
    amount: row.amount, // string with 2 decimals — never a float
    entryDate: row.entryDate,
    description: row.description,
    notes: row.notes,
    recurrenceId: row.recurrenceId,
    isScheduled: isScheduled(row.entryDate, timezone), // BR-03
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  if ("paymentMethod" in row) return { ...dto, paymentMethod: row.paymentMethod };
  if ("institution" in row) return { ...dto, institution: row.institution };
  return dto;
}

export type EntryDto = ReturnType<typeof toEntryDto> & {
  paymentMethod?: string;
  institution?: string | null;
};

async function userTimezone(tx: UserTx, userId: string) {
  return (await userRepo.findById(tx, userId))?.timezone ?? "America/Sao_Paulo";
}

const categoryError = (error: string) =>
  errorResponse("INVALID_CATEGORY", "Invalid category", 422, { categoryId: [error] });

const notFound = () => errorResponse("NOT_FOUND", "Resource not found", 404);

// ── /{kind} ──────────────────────────────────────────────────────────────────

export function entryCollectionHandlers(kind: EntryKind) {
  const repo = entryRepos[kind];

  /** List one month: filters, sort, page of 20, plus the month total for the same filters */
  async function GET(req: NextRequest) {
    try {
      const { userId } = await requireUser();
      const query = listEntriesQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
      if (!query.success) return handleRouteError(query.error);
      const { month, category, q, sort, page } = query.data;

      const result = await withUserDb(userId, async (tx) => {
        const timezone = await userTimezone(tx, userId);
        const ym = month ?? currentYearMonth(timezone); // default: this month, user's clock
        const filter = { ...monthDateRange(ym), categoryId: category, q };
        const [rows, summary] = await Promise.all([
          repo.list(tx, filter, { sort, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
          repo.summary(tx, filter),
        ]);
        return { ym, timezone, rows, summary };
      });

      return NextResponse.json({
        month: result.ym,
        entries: result.rows.map((r) => toEntryDto(kind, r, result.timezone)),
        total: result.summary.total,
        page,
        pageSize: PAGE_SIZE,
        totalCount: result.summary.count,
        totalPages: Math.max(1, Math.ceil(result.summary.count / PAGE_SIZE)),
      });
    } catch (err) {
      return handleRouteError(err);
    }
  }

  async function POST(req: NextRequest) {
    try {
      const { userId } = await requireUser();
      const body = createEntrySchemas[kind].safeParse(await req.json());
      if (!body.success) return handleRouteError(body.error);

      const result = await withUserDb(userId, async (tx) => {
        const check = await checkEntryCategory(tx, body.data.categoryId, kind);
        if (!check.ok) return check;
        const row = await repo.create(tx, { ...body.data, userId } as never);
        return { ok: true as const, dto: toEntryDto(kind, row, await userTimezone(tx, userId)) };
      });

      if (!result.ok) return categoryError(result.error);
      return NextResponse.json({ entry: result.dto }, { status: 201 });
    } catch (err) {
      return handleRouteError(err);
    }
  }

  return { GET, POST };
}

// ── /{kind}/{id} ─────────────────────────────────────────────────────────────

export function entryItemHandlers(kind: EntryKind) {
  const repo = entryRepos[kind];

  async function GET(_req: NextRequest, { params }: IdContext) {
    try {
      const { userId } = await requireUser();
      const id = parseId((await params).id);
      const dto = await withUserDb(userId, async (tx) => {
        // BR-01: RLS hides other users' rows; requireOwned is the API-layer check
        const row = requireOwned(await repo.findById(tx, id), userId);
        return toEntryDto(kind, row, await userTimezone(tx, userId));
      });
      return NextResponse.json({ entry: dto });
    } catch (err) {
      return handleRouteError(err);
    }
  }

  async function PUT(req: NextRequest, { params }: IdContext) {
    try {
      const { userId } = await requireUser();
      const id = parseId((await params).id);
      const body = updateEntrySchemas[kind].safeParse(await req.json());
      if (!body.success) return handleRouteError(body.error);

      const result = await withUserDb(userId, async (tx) => {
        const current = requireOwned(await repo.findById(tx, id), userId);
        if (body.data.categoryId && body.data.categoryId !== current.categoryId) {
          const check = await checkEntryCategory(
            tx,
            body.data.categoryId,
            kind,
            current.categoryId
          );
          if (!check.ok) return check;
        }
        const row = await repo.update(tx, id, body.data as never);
        if (!row) throw new ApiError("NOT_FOUND", "Resource not found", 404);
        return { ok: true as const, dto: toEntryDto(kind, row, await userTimezone(tx, userId)) };
      });

      if (!result.ok) return categoryError(result.error);
      return NextResponse.json({ entry: result.dto });
    } catch (err) {
      return handleRouteError(err);
    }
  }

  /** UC-10: soft delete — the row stays restorable via /restore */
  async function DELETE(_req: NextRequest, { params }: IdContext) {
    try {
      const { userId } = await requireUser();
      const id = parseId((await params).id);
      const deleted = await withUserDb(userId, (tx) => repo.softDelete(tx, id));
      if (!deleted) return notFound();
      return NextResponse.json({ ok: true });
    } catch (err) {
      return handleRouteError(err);
    }
  }

  return { GET, PUT, DELETE };
}

// ── /{kind}/{id}/restore ─────────────────────────────────────────────────────

export function entryRestoreHandler(kind: EntryKind) {
  const repo = entryRepos[kind];

  /** Undo a delete. The category may have been archived since — the entry keeps it (BR-06). */
  async function POST(_req: NextRequest, { params }: IdContext) {
    try {
      const { userId } = await requireUser();
      const id = parseId((await params).id);

      const result = await withUserDb(userId, async (tx) => {
        const existing = requireOwned(await repo.findAnyById(tx, id), userId);
        if (!existing.deletedAt) return "NOT_DELETED" as const;
        const row = (await repo.restore(tx, id))!;
        return toEntryDto(kind, row, await userTimezone(tx, userId));
      });

      if (result === "NOT_DELETED") {
        return errorResponse("NOT_DELETED", "Entry is not deleted", 409);
      }
      return NextResponse.json({ entry: result });
    } catch (err) {
      return handleRouteError(err);
    }
  }

  return { POST };
}
