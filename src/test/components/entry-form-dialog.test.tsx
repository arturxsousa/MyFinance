import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { I18nProvider } from "@/i18n/client";
import { messages } from "@/i18n/messages";
import { EntryFormDialog, type EntryFormState } from "@/components/entries/entry-form-dialog";
import type { CategoryDto } from "@/lib/categories";
import type { EntryDto } from "@/lib/entry-api";

const food: CategoryDto = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "EXPENSE",
  name: "Food",
  systemKey: "food",
  color: "#ea580c",
  isActive: true,
  isSystem: true,
};

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  refresh.mockReset();
  vi.mocked(toast.success).mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function setup(state: EntryFormState, kind: "EXPENSE" | "INCOME" = "EXPENSE") {
  const onClose = vi.fn();
  const onViewMonth = vi.fn();
  render(
    <I18nProvider locale="en-US" messages={messages["en-US"]}>
      <EntryFormDialog
        kind={kind}
        state={state}
        categories={[food]}
        currency="BRL"
        today="2026-10-29"
        viewedMonth="2026-10"
        onClose={onClose}
        onViewMonth={onViewMonth}
      />
    </I18nProvider>
  );
  return { onClose, onViewMonth };
}

const ok = (entry: Partial<EntryDto>) =>
  ({ ok: true, json: async () => ({ entry: { entryDate: "2026-10-29", ...entry } }) }) as Response;

describe("EntryFormDialog", () => {
  it("creates an expense: date defaults to today, amount sent as an exact string", async () => {
    fetchMock.mockResolvedValue(ok({}));
    const { onClose } = setup({ mode: "create" });
    expect(screen.getByRole("heading", { name: "New expense" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Date" })).toHaveTextContent("10/29/2026");

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "4290" } });
    // Pick the category through the select
    fireEvent.click(screen.getByRole("combobox", { name: "Category" }));
    fireEvent.click(await screen.findByRole("option", { name: /Food/ }));
    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: "Lunch" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/expenses");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      amount: "42.90",
      entryDate: "2026-10-29",
      categoryId: food.id,
      description: "Lunch",
      notes: "",
      paymentMethod: "PIX",
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("Entry added");
  });

  it("closes and refreshes the list after saving", async () => {
    fetchMock.mockResolvedValue(ok({}));
    const { onClose } = setup({
      mode: "edit",
      entry: {
        id: "e1",
        amount: "10.00",
        entryDate: "2026-10-05",
        categoryId: food.id,
        description: null,
        notes: null,
        paymentMethod: "CASH",
      } as EntryDto,
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(refresh).toHaveBeenCalled();
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/expenses/e1");
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).paymentMethod).toBe("CASH");
  });

  it("prefills when editing", () => {
    setup({
      mode: "edit",
      entry: {
        id: "e1",
        amount: "1234.50",
        entryDate: "2026-10-05",
        categoryId: food.id,
        description: "Rent",
        notes: "Oct",
        paymentMethod: "TRANSFER",
      } as EntryDto,
    });
    expect(screen.getByRole("heading", { name: "Edit expense" })).toBeInTheDocument();
    expect(screen.getByLabelText("Amount")).toHaveValue("R$1,234.50");
    expect(screen.getByLabelText(/Description/)).toHaveValue("Rent");
  });

  it("shows translated field errors from the API", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: {
          code: "INVALID_CATEGORY",
          fields: { categoryId: ["validation.categoryArchived"] },
        },
      }),
    } as Response);
    setup({
      mode: "edit",
      entry: {
        id: "e1",
        amount: "10.00",
        entryDate: "2026-10-05",
        categoryId: food.id,
        description: null,
        notes: null,
        paymentMethod: "PIX",
      } as EntryDto,
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("This category is archived — choose another one")
    ).toBeInTheDocument();
  });

  it("marks a future date as scheduled", () => {
    setup({
      mode: "edit",
      entry: {
        id: "e1",
        amount: "10.00",
        entryDate: "2026-11-05",
        categoryId: food.id,
        description: null,
        notes: null,
        paymentMethod: "PIX",
      } as EntryDto,
    });
    expect(screen.getByText(/this entry will be marked as scheduled/)).toBeInTheDocument();
  });

  it("offers to jump to the month an entry was saved into", async () => {
    fetchMock.mockResolvedValue(ok({ entryDate: "2026-11-05" }));
    setup({
      mode: "edit",
      entry: {
        id: "e1",
        amount: "10.00",
        entryDate: "2026-11-05",
        categoryId: food.id,
        description: null,
        notes: null,
        paymentMethod: "PIX",
      } as EntryDto,
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(vi.mocked(toast.success).mock.calls[0]![0]).toBe("Saved in November 2026");
  });

  it("only shows kind-specific fields for their kind", () => {
    setup({ mode: "create" }, "INCOME");
    expect(screen.queryByText("Payment method")).not.toBeInTheDocument();
    expect(screen.queryByText("Institution")).not.toBeInTheDocument();
  });
});
