import { entryCollectionHandlers } from "@/lib/entry-api";

const handlers = entryCollectionHandlers("INVESTMENT");
export const GET = handlers.GET;
export const POST = handlers.POST;
