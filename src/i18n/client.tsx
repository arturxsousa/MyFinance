"use client";

import { createContext, use, useEffect, useMemo } from "react";
import type { Locale } from "./config";
import type { Messages } from "./messages";
import { createTranslator, type Translator } from "./translator";

const I18nContext = createContext<{ locale: Locale; t: Translator } | null>(null);

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ locale, t: createTranslator(messages) }), [locale, messages]);

  // The root <html> is rendered before the locale is known (it lives outside
  // the Suspense boundary), so sync lang here for screen readers.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <I18nContext value={value}>{children}</I18nContext>;
}

function useI18n() {
  const ctx = use(I18nContext);
  if (!ctx) throw new Error("useT/useLocale must be used inside <I18nProvider>");
  return ctx;
}

export const useT = () => useI18n().t;
export const useLocale = () => useI18n().locale;
