"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/incomes", label: "Incomes", icon: TrendingUp },
  { href: "/expenses", label: "Expenses", icon: TrendingDown },
  { href: "/investments", label: "Investments", icon: PiggyBank },
  { href: "/cards", label: "Cards", icon: CreditCard },
  { href: "/categories", label: "Categories", icon: Tag },
];

const bottomItems = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
];

interface SidebarProps {
  isAdmin?: boolean;
}

export function Sidebar({ isAdmin = true }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem("sidebar-collapsed");
      return stored !== null ? stored === "true" : true;
    } catch {
      return true;
    }
  });

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  };

  const visibleBottom = bottomItems.filter((i) => !i.adminOnly || isAdmin);

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
        {!collapsed && <span className="font-semibold text-sm">My Finance</span>}
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
          {visibleBottom.map((item) => (
            <NavItem key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
          ))}
        </nav>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggle}
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
  item: { href: string; label: string; icon: React.ElementType };
  pathname: string;
  collapsed: boolean;
}

function NavItem({ item, pathname, collapsed }: NavItemProps) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
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
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link href={item.href} className={linkClass}>
      <Icon className="h-4 w-4 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}
