import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => {
  const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return { toast };
});

import { toast } from "sonner";
import { I18nProvider } from "@/i18n/client";
import { messages } from "@/i18n/messages";
import { DeleteEntryDialog, UNDO_MS } from "@/components/entries/delete-entry-dialog";
import type { EntryDto } from "@/lib/entry-api";

const entry = {
  id: "e1",
  kind: "EXPENSE",
  categoryId: "c1",
  amount: "42.90",
  entryDate: "2026-10-12",
  description: "Lunch",
  notes: null,
  paymentMethod: "PIX",
} as EntryDto;

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  refresh.mockReset();
  vi.mocked(toast).mockReset();
  vi.mocked(toast.success).mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function setup() {
  const onClose = vi.fn();
  const onDeleted = vi.fn();
  render(
    <I18nProvider locale="pt-BR" messages={messages["pt-BR"]}>
      <DeleteEntryDialog
        kind="EXPENSE"
        entry={entry}
        categories={[]}
        currency="BRL"
        onClose={onClose}
        onDeleted={onDeleted}
      />
    </I18nProvider>
  );
  return { onClose, onDeleted };
}

describe("DeleteEntryDialog (UC-10)", () => {
  it("shows which entry is being deleted", () => {
    setup();
    expect(screen.getByText("Excluir este lançamento?")).toBeInTheDocument();
    expect(screen.getByText("Lunch")).toBeInTheDocument();
    expect(screen.getByText(/42,90/)).toBeInTheDocument();
  });

  it("soft-deletes, then offers Undo for 5 s which calls /restore", async () => {
    fetchMock.mockResolvedValue({ ok: true } as Response);
    const { onClose, onDeleted } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/api/expenses/e1", { method: "DELETE" });
    expect(onDeleted).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();

    const [message, opts] = vi.mocked(toast).mock.calls[0]!;
    expect(message).toBe("Lançamento excluído");
    expect(opts).toMatchObject({ duration: UNDO_MS, action: { label: "Desfazer" } });
    expect(UNDO_MS).toBe(5000);

    // Clicking Undo restores the entry
    (opts!.action as unknown as { onClick: () => void }).onClick();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith("/api/expenses/e1/restore", { method: "POST" })
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Lançamento restaurado"));
  });

  it("keeps the dialog open and reports an error if the delete fails", async () => {
    fetchMock.mockResolvedValue({ ok: false } as Response);
    const { onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });
});
