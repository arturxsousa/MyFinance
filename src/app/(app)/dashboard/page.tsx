import { getT } from "@/i18n/server";

export default async function DashboardPage() {
  const t = await getT();
  return (
    <div>
      <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>
      <p className="text-muted-foreground mt-1">{t("dashboard.placeholder")}</p>
    </div>
  );
}
