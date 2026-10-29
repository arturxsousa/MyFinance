import { entryItemHandlers } from "@/lib/entry-api";

const handlers = entryItemHandlers("INCOME");
export const GET = handlers.GET;
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
