import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MoneyInput, digitsToAmount } from "@/components/ui/money-input";

describe("digitsToAmount", () => {
  it.each([
    ["", ""],
    ["0", ""],
    ["5", "0.05"],
    ["50", "0.50"],
    ["123456", "1234.56"],
    ["R$ 1.234,567", "12345.67"],
    ["000123", "1.23"],
    ["9".repeat(20), "999999999999.99"], // capped at numeric(14,2)
  ])("%j → %j", (digits, amount) => {
    expect(digitsToAmount(digits)).toBe(amount);
  });
});

function Harness({ locale = "pt-BR" }: { locale?: string }) {
  const [v, setV] = useState("");
  return (
    <>
      <MoneyInput aria-label="amount" value={v} onChange={setV} currency="BRL" locale={locale} />
      <output data-testid="value">{v}</output>
    </>
  );
}

describe("MoneyInput", () => {
  it("fills from the right and keeps an exact decimal string", () => {
    render(<Harness />);
    const input = screen.getByLabelText("amount");
    fireEvent.change(input, { target: { value: "123456" } });
    expect(screen.getByTestId("value")).toHaveTextContent("1234.56");
    expect((input as HTMLInputElement).value).toMatch(/^R\$\s1\.234,56$/); // Intl uses a no-break space
  });

  it("formats for en-US too", () => {
    render(<Harness locale="en-US" />);
    const input = screen.getByLabelText("amount");
    fireEvent.change(input, { target: { value: "123456" } });
    expect(input).toHaveValue("R$1,234.56");
  });

  it("backspace removes the last digit", () => {
    render(<Harness />);
    const input = screen.getByLabelText("amount");
    fireEvent.change(input, { target: { value: "1234" } });
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(screen.getByTestId("value")).toHaveTextContent("1.23");
    fireEvent.keyDown(input, { key: "Backspace" });
    fireEvent.keyDown(input, { key: "Backspace" });
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(screen.getByTestId("value")).toHaveTextContent("");
  });
});
