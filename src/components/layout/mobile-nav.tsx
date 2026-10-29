"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  CreditCard,
  Tag,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { AdminOnly } from "./admin-only";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/translator";

interface NavEntry {
  href: string;
  label: MessageKey;
  icon: React.ElementType;
}

const navItems: NavEntry[] = [
  { href: "/dashboard", label: "nav.dashboard", icon: LayoutDashboard },
  { href: "/incomes", label: "nav.incomes", icon: TrendingUp },
  { href: "/expenses", label: "nav.expenses", icon: TrendingDown },
  { href: "/investments", label: "nav.investments", icon: PiggyBank },
  { href: "/cards", label: "nav.cards", icon: CreditCard },
  { href: "/categories", label: "nav.categories", icon: Tag },
];

const settingsItem: NavEntry = { href: "/settings", label: "nav.settings", icon: Settings };
const adminItem: NavEntry = { href: "/admin", label: "nav.admin", icon: ShieldCheck };

export function MobileNav({
  isAdmin,
  onNavigate,
}: {
  isAdmin: Promise<boolean>;
  /** Called when a link is tapped, so the sheet can close */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const t = useT();

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 h-14 px-4 border-b">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-bold text-sm">
          MF
        </span>
        <span className="font-semibold text-sm">{t("common.appName")}</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-0.5 p-2 overflow-y-auto">
        {navItems.map((item) => (
          <MobileNavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-2">
        <Separator className="mb-2" />
        <nav className="flex flex-col gap-0.5">
          <MobileNavLink item={settingsItem} pathname={pathname} onNavigate={onNavigate} />
          <AdminOnly isAdmin={isAdmin}>
            <MobileNavLink item={adminItem} pathname={pathname} onNavigate={onNavigate} />
          </AdminOnly>
        </nav>
      </div>
    </div>
  );
}

interface MobileNavLinkProps {
  item: NavEntry;
  pathname: string;
  onNavigate?: () => void;
}

function MobileNavLink({ item, pathname, onNavigate }: MobileNavLinkProps) {
  const t = useT();
  const Icon = item.icon;
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        "text-muted-foreground hover:text-foreground hover:bg-muted",
        isActive && "bg-muted text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {t(item.label)}
    </Link>
  );
}
