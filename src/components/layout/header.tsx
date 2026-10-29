"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Menu, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { MobileNav } from "./mobile-nav";
import { useT } from "@/i18n/client";

export function Header({ isAdmin }: { isAdmin: Promise<boolean> }) {
  const { theme, setTheme } = useTheme();
  const t = useT();
  // Controlled so tapping a link can close the menu
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="flex items-center justify-between h-14 px-4 border-b bg-background shrink-0">
      {/* Mobile menu */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger
          render={
            <button
              className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label={t("nav.openMenu")}
            />
          }
        >
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-56">
          <SheetTitle className="sr-only">{t("nav.navigation")}</SheetTitle>
          <MobileNav isAdmin={isAdmin} onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Logo — visible on mobile only */}
      <span className="font-semibold text-sm md:hidden">{t("common.appName")}</span>

      {/* Right side */}
      <div className="flex items-center gap-2 ml-auto">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">{t("nav.toggleTheme")}</span>
        </Button>
      </div>
    </header>
  );
}
