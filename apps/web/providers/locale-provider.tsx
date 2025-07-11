"use client";

import React, { createContext, useContext } from "react";
import { useLocale, LocaleConfig } from "@/lib/hooks/useLocale";

const LocaleContext = createContext<LocaleConfig | undefined>(undefined);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const localeConfig = useLocale();

  return (
    <LocaleContext.Provider value={localeConfig}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocaleContext() {
  const context = useContext(LocaleContext);
  const fallback = useLocale();
  
  // Return context if available, otherwise use fallback
  return context || fallback;
}
