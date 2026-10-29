"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  CreditCard,
  Tag,
  Settings,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
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

interface SidebarProps {
  isAdmin: Promise<boolean>;
}

export function Sidebar({ isAdmin }: SidebarProps) {
  const pathname = usePathname();
  const t = useT();
  // Start collapsed (matches SSR), then sync from localStorage after hydration
  const [collapsed, setCollapsed] = useState(true);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("sidebar-collapsed");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored !== null) setCollapsed(stored === "true");
    } catch {}
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("sidebar-collapsed", String(next));
    } catch {}
  };

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-screen border-r bg-background transition-all duration-200",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center h-14 px-3 border-b shrink-0",
          collapsed ? "justify-center" : "gap-3"
        )}
      >
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-bold text-sm shrink-0">
          MF
        </span>
        {!collapsed && <span className="font-semibold text-sm">{t("common.appName")}</span>}
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 py-2">
        <nav className="flex flex-col gap-0.5 px-2">
          {navItems.map((item) => (
            <NavItem key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
          ))}
        </nav>
      </ScrollArea>

      {/* Bottom */}
      <div className="pb-2 px-2">
        <Separator className="mb-2" />
        <nav className="flex flex-col gap-0.5">
          <NavItem item={settingsItem} pathname={pathname} collapsed={collapsed} />
          <AdminOnly isAdmin={isAdmin}>
            <NavItem item={adminItem} pathname={pathname} collapsed={collapsed} />
          </AdminOnly>
        </nav>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggle}
        aria-label={t("nav.toggleSidebar")}
        className="flex items-center justify-center h-10 border-t text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <ChevronRight
          className={cn("h-4 w-4 transition-transform duration-200", !collapsed && "rotate-180")}
        />
      </button>
    </aside>
  );
}

interface NavItemProps {
  item: NavEntry;
  pathname: string;
  collapsed: boolean;
}

function NavItem({ item, pathname, collapsed }: NavItemProps) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
  const t = useT();
  const Icon = item.icon;

  const linkClass = cn(
    "flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors",
    "text-muted-foreground hover:text-foreground hover:bg-muted",
    isActive && "bg-muted text-foreground",
    collapsed && "justify-center"
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger render={<Link href={item.href} className={linkClass} />}>
          <Icon className="h-4 w-4 shrink-0" />
        </TooltipTrigger>
        <TooltipContent side="right">{t(item.label)}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link href={item.href} className={linkClass}>
      <Icon className="h-4 w-4 shrink-0" />
      <span>{t(item.label)}</span>
    </Link>
  );
}
