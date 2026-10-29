import { Suspense } from "react";
import { requireAdminPage } from "@/lib/guards";
import { getT } from "@/i18n/server";

// Placeholder until the admin area is built (Phase 10, UC-18–20).
// Every admin page must call requireAdminPage() itself — a layout check does
// not stop a page from rendering.
export default function AdminPage() {
  return (
    <Suspense>
      <AdminContent />
    </Suspense>
  );
}

async function AdminContent() {
  await requireAdminPage();
  const t = await getT();
  return (
    <div>
      <h1 className="text-2xl font-semibold">{t("admin.title")}</h1>
      <p className="text-muted-foreground mt-1">{t("admin.placeholder")}</p>
    </div>
  );
}
