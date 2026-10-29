import { entryCollectionHandlers } from "@/lib/entry-api";

const handlers = entryCollectionHandlers("EXPENSE");
export const GET = handlers.GET;
export const POST = handlers.POST;
