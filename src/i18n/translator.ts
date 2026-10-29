import type { ReactNode } from "react";
import type { Messages } from "./messages";

// "settings.title" | "validation.required" | … — typos are compile errors
type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;
type Vars = Record<string, string | number>;

export interface Translator {
  (key: MessageKey, vars?: Vars): string;
  /** For keys that arrive at runtime, e.g. validation messages from the API */
  has(key: string | undefined): key is MessageKey;
  /** Translates a runtime key, or `fallback` if it isn't a known key */
  dynamic(key: string | undefined, fallback: MessageKey): string;
  /** Like t(), but {placeholders} may be React nodes (links, <strong>…) */
  rich(key: MessageKey, nodes: Record<string, ReactNode>): ReactNode[];
}

function lookup(messages: Messages, key: string): string | undefined {
  // Dictionaries are one level deep: "<group>.<key>". Split on the first dot only.
  const i = key.indexOf(".");
  const group = (messages as unknown as Record<string, Record<string, string>>)[key.slice(0, i)];
  const value = group?.[key.slice(i + 1)];
  return typeof value === "string" ? value : undefined;
}

export function createTranslator(messages: Messages): Translator {
  const t = ((key: MessageKey, vars?: Vars) => {
    const raw = lookup(messages, key) ?? key;
    return vars ? raw.replace(/\{(\w+)\}/g, (m, name) => String(vars[name] ?? m)) : raw;
  }) as Translator;

  t.has = (key): key is MessageKey =>
    !!key && key.includes(".") && lookup(messages, key) !== undefined;

  t.dynamic = (key, fallback) => (t.has(key) ? t(key) : t(fallback));

  t.rich = (key, nodes) =>
    (lookup(messages, key) ?? key)
      .split(/\{(\w+)\}/)
      .map((part, i) => (i % 2 === 1 ? (nodes[part] ?? `{${part}}`) : part));

  return t;
}
