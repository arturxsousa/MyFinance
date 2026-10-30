import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { I18nProvider } from "@/i18n/client";
import { messages } from "@/i18n/messages";
import { DuplicateEntryDialog } from "@/components/entries/duplicate-entry-dialog";
import type { EntryDto } from "@/lib/entry-api";

const entry = {
  id: "e1",
  kind: "EXPENSE",
  categoryId: "c1",
  amount: "2200.00",
  entryDate: "2026-10-01",
  description: "Rent",
  notes: null,
  paymentMethod: "TRANSFER",
} as EntryDto;

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  refresh.mockReset();
  vi.mocked(toast.success).mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function setup(viewedMonth = "2026-10") {
  const onClose = vi.fn();
  const onViewMonth = vi.fn();
  render(
    <I18nProvider locale="en-US" messages={messages["en-US"]}>
      <DuplicateEntryDialog
        kind="EXPENSE"
        entry={entry}
        categories={[]}
        currency="BRL"
        today="2026-10-29"
        viewedMonth={viewedMonth}
        onClose={onClose}
        onViewMonth={onViewMonth}
      />
    </I18nProvider>
  );
  return { onClose, onViewMonth };
}

describe("DuplicateEntryDialog (UC-11)", () => {
  it("defaults the new date to today and posts only the date", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ entry: {} }) } as Response);
    const { onClose } = setup();
    expect(screen.getByRole("button", { name: "New date" })).toHaveTextContent("10/29/2026");
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/expenses/e1/duplicate");
    expect(JSON.parse(init.body)).toEqual({ entryDate: "2026-10-29" });
    expect(toast.success).toHaveBeenCalledWith("Copy added on 10/29/2026", undefined);
    expect(refresh).toHaveBeenCalled();
  });

  it("offers to jump to the copy when it lands in another month", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ entry: {} }) } as Response);
    const { onViewMonth } = setup("2026-09");
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const opts = vi.mocked(toast.success).mock.calls[0]![1] as {
      action: { label: string; onClick: () => void };
    };
    expect(opts.action.label).toBe("View");
    opts.action.onClick();
    expect(onViewMonth).toHaveBeenCalledWith("2026-10");
  });

  it("explains when the category was archived since (BR-06)", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { fields: { categoryId: ["validation.categoryArchived"] } } }),
    } as Response);
    const { onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    expect(
      await screen.findByText(/category is archived and can.t receive new entries/)
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
