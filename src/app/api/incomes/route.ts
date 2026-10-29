import { entryCollectionHandlers } from "@/lib/entry-api";

const handlers = entryCollectionHandlers("INCOME");
export const GET = handlers.GET;
export const POST = handlers.POST;
