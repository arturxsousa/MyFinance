import { entryItemHandlers } from "@/lib/entry-api";

const handlers = entryItemHandlers("EXPENSE");
export const GET = handlers.GET;
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
