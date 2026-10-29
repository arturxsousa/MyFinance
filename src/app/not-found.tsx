import Link from "next/link";
import { getT } from "@/i18n/server";

export default async function NotFound() {
  const t = await getT();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-5xl font-bold text-emerald-600">404</p>
      <h1 className="text-xl font-semibold">{t("notFound.title")}</h1>
      <p className="text-sm text-muted-foreground">{t("notFound.body")}</p>
      <Link href="/dashboard" className="text-sm text-emerald-600 hover:underline font-medium">
        {t("notFound.back")}
      </Link>
    </div>
  );
}
