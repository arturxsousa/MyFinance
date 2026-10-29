import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/guards";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Not awaited: only the Admin nav item suspends on it, so the shell streams
  // immediately. Display only — the JWT role may be up to 15 min stale.
  const isAdmin = getSession().then((s) => s?.role === "ADMIN");

  return (
    <div className="flex h-full">
      <Sidebar isAdmin={isAdmin} />
      <div className="flex flex-col flex-1 min-w-0">
        <Header isAdmin={isAdmin} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
