import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/i18n/client";
import { messages } from "@/i18n/messages";
import { CategorySelect } from "@/components/categories/category-select";
import type { CategoryDto } from "@/lib/categories";

const cat = (over: Partial<CategoryDto>): CategoryDto => ({
  id: crypto.randomUUID(),
  kind: "EXPENSE",
  name: "x",
  systemKey: null,
  color: "#123456",
  isActive: true,
  isSystem: false,
  ...over,
});

const food = cat({ name: "Food", systemKey: "food", isSystem: true, color: "#ea580c" });
const housing = cat({ name: "Housing", systemKey: "housing", isSystem: true });
const pets = cat({ name: "Pets", color: "#f59e0b" });
const oldGym = cat({ name: "Old gym", isActive: false });
const salary = cat({ name: "Salary", systemKey: "salary", isSystem: true, kind: "INCOME" });
const ALL = [food, housing, pets, oldGym, salary];

function setup(
  props: Partial<React.ComponentProps<typeof CategorySelect>> = {},
  locale: "en-US" | "pt-BR" = "en-US"
) {
  const onChange = vi.fn();
  render(
    <I18nProvider locale={locale} messages={messages[locale]}>
      <CategorySelect categories={ALL} kind="EXPENSE" value={null} onChange={onChange} {...props} />
    </I18nProvider>
  );
  return { onChange };
}

async function openOptions() {
  fireEvent.click(screen.getByRole("combobox"));
  return within(await screen.findByRole("listbox"));
}

describe("CategorySelect", () => {
  it("shows a placeholder when nothing is selected", () => {
    setup();
    expect(screen.getByRole("combobox")).toHaveTextContent("Select a category");
  });

  it('lists "Pets" alongside the defaults — Phase 5 done-when', async () => {
    setup();
    const list = await openOptions();
    expect(list.getByRole("option", { name: /Pets/ })).toBeInTheDocument();
    expect(list.getByRole("option", { name: /Food/ })).toBeInTheDocument();
  });

  it("only shows categories of the requested kind", async () => {
    setup();
    const list = await openOptions();
    expect(list.queryByRole("option", { name: /Salary/ })).not.toBeInTheDocument();
  });

  it("hides archived categories", async () => {
    setup();
    const list = await openOptions();
    expect(list.queryByRole("option", { name: /Old gym/ })).not.toBeInTheDocument();
  });

  it("groups own categories before the defaults", async () => {
    setup();
    const list = await openOptions();
    const names = list.getAllByRole("option").map((o) => o.textContent);
    expect(names.indexOf("Pets")).toBeLessThan(names.indexOf("Food"));
    expect(list.getByText("Your categories")).toBeInTheDocument();
    expect(list.getByText("Default categories")).toBeInTheDocument();
  });

  it("translates default category names", async () => {
    setup({}, "pt-BR");
    const list = await openOptions();
    expect(list.getByRole("option", { name: /Alimentação/ })).toBeInTheDocument();
    expect(list.getByRole("option", { name: /Moradia/ })).toBeInTheDocument();
  });

  it("calls onChange with the category id", async () => {
    const { onChange } = setup();
    const list = await openOptions();
    fireEvent.click(list.getByRole("option", { name: /Pets/ }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(pets.id));
  });

  it("keeps an archived category visible when it is the current value (BR-06)", async () => {
    setup({ value: oldGym.id });
    expect(screen.getByRole("combobox")).toHaveTextContent("Old gym (archived)");
    const list = await openOptions();
    const option = list.getByRole("option", { name: /Old gym/ });
    expect(option).toHaveAttribute("aria-disabled", "true");
  });
});
