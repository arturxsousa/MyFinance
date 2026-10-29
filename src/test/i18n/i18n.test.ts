// @vitest-environment node
import { describe, it, expect } from "vitest";
import { matchLocale, resolveLocale } from "@/i18n/config";
import { messages } from "@/i18n/messages";
import { createTranslator } from "@/i18n/translator";

describe("matchLocale (browser language)", () => {
  it.each([
    ["pt-BR,pt;q=0.9,en;q=0.8", "pt-BR"],
    ["pt-PT", "pt-BR"],
    ["pt", "pt-BR"],
    ["en-US,en;q=0.9", "en-US"],
    ["en-GB", "en-US"],
    ["fr-FR,en;q=0.5,pt;q=0.8", "pt-BR"], // highest-q supported language wins
    ["fr-FR,de;q=0.9", "en-US"], // nothing supported → fallback
    ["*", "en-US"],
    ["", "en-US"],
    [null, "en-US"],
  ])("%s → %s", (header, expected) => {
    expect(matchLocale(header)).toBe(expected);
  });
});

describe("resolveLocale", () => {
  it("prefers the saved cookie over the browser", () => {
    expect(resolveLocale("en-US", "pt-BR")).toBe("en-US");
  });

  it("ignores an unsupported cookie value", () => {
    expect(resolveLocale("fr-FR", "pt-BR")).toBe("pt-BR");
  });
});

describe("translator", () => {
  const t = createTranslator(messages["pt-BR"]);

  it("translates and interpolates", () => {
    expect(t("nav.settings")).toBe("Configurações");
    expect(t("forgot.doneBody", { email: "a@b.c" })).toContain("a@b.c");
  });

  it("handles timezone keys containing slashes", () => {
    expect(t("timezones.Europe/London")).toBe("Londres");
  });

  it("translates runtime keys and falls back for unknown ones", () => {
    expect(t.dynamic("validation.passwordMin", "validation.invalid")).toBe(
      "A senha deve ter pelo menos 8 caracteres"
    );
    expect(t.dynamic("Some raw server message", "validation.invalid")).toBe("Valor inválido");
    expect(t.dynamic(undefined, "validation.invalid")).toBe("Valor inválido");
  });

  it("rich() splices nodes into placeholders", () => {
    const parts = t.rich("forgot.doneBody", { email: "NODE" });
    expect(parts).toContain("NODE");
    expect(parts.join("")).not.toContain("{email}");
  });
});

describe("dictionaries", () => {
  // Type-checked already (pt-BR is typed as Messages); this guards empty strings
  it.each(Object.entries(messages))("%s has no empty strings", (_locale, dict) => {
    for (const [group, entries] of Object.entries(dict)) {
      for (const [key, value] of Object.entries(entries as Record<string, string>)) {
        expect(value.trim(), `${group}.${key}`).not.toBe("");
      }
    }
  });

  it("every validation key used by the schemas exists", async () => {
    const { profileSchema } = await import("@/lib/preferences");
    const { passwordSchema } = await import("@/lib/password");
    const t = createTranslator(messages["en-US"]);
    const issues = [
      ...profileSchema.safeParse({
        firstName: "",
        lastName: "x".repeat(81),
        currency: "JPY",
        locale: "fr",
        timezone: "Mars/X",
      }).error!.issues,
      ...["short1", "x".repeat(73) + "1", "12345678", "abcdefgh", "password123"].flatMap(
        (pw) => passwordSchema.safeParse(pw).error!.issues
      ),
    ];
    for (const issue of issues) expect(t.has(issue.message), issue.message).toBe(true);
  });
});
