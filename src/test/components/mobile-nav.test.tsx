import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

import { I18nProvider } from "@/i18n/client";
import { messages } from "@/i18n/messages";
import { MobileNav } from "@/components/layout/mobile-nav";

describe("MobileNav", () => {
  it.each(["Expenses", "Settings"])("tapping %s calls onNavigate so the sheet closes", (label) => {
    const onNavigate = vi.fn();
    render(
      <I18nProvider locale="en-US" messages={messages["en-US"]}>
        <MobileNav isAdmin={Promise.resolve(false)} onNavigate={onNavigate} />
      </I18nProvider>
    );
    fireEvent.click(screen.getByRole("link", { name: label }));
    expect(onNavigate).toHaveBeenCalledOnce();
  });
});
