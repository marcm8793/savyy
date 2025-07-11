"use client";

import { useLocaleContext } from "@/providers/locale-provider";

export interface LocaleConfig {
  locale: string;
  market: string;
}

// Re-export the context hook for backward compatibility
export { useLocaleContext } from "@/providers/locale-provider";

// This hook is now a thin wrapper around useLocaleContext
// It's kept for backward compatibility but components should prefer useLocaleContext
export function useLocale(): LocaleConfig {
  const { locale, market } = useLocaleContext();
  return { locale, market };
}

export function useUpdateLocale() {
  const { updateLocale } = useLocaleContext();
  return updateLocale;
}