import { NextResponse } from "next/server";
import { ZodError } from "zod";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
  };
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400
  ) {
    super(message);
  }
}

export function errorResponse(
  code: string,
  message: string,
  status: number = 400,
  fields?: Record<string, string[]>
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: { code, message, ...(fields && { fields }) } }, { status });
}

export function handleRouteError(err: unknown): NextResponse<ApiErrorBody> {
  if (err instanceof ApiError) {
    return errorResponse(err.code, err.message, err.status);
  }

  if (err instanceof ZodError) {
    const fields: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".");
      (fields[key] ??= []).push(issue.message);
    }
    return errorResponse("VALIDATION_ERROR", "Invalid request data", 422, fields);
  }

  console.error("[API Error]", err);
  return errorResponse("INTERNAL_ERROR", "An unexpected error occurred", 500);
}
