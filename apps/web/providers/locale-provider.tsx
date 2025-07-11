"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { LocaleConfig } from "@/lib/hooks/useLocale";

const LOCALE_STORAGE_KEY = "savyy-locale";

// Map of locales to Tink market codes
const LOCALE_TO_MARKET: Record<string, string> = {
  // European markets
  "fr-FR": "FR",
  "de-DE": "DE",
  "it-IT": "IT",
  "es-ES": "ES",
  "nl-NL": "NL",
  "pt-PT": "PT",
  "en-GB": "GB",
  "sv-SE": "SE",
  "fi-FI": "FI",
  "da-DK": "DK",
  "no-NO": "NO",
  "pl-PL": "PL",
  "cs-CZ": "CZ",
  "sk-SK": "SK",
  "hu-HU": "HU",
  "ro-RO": "RO",
  "bg-BG": "BG",
  "hr-HR": "HR",
  "sl-SI": "SI",
  "et-EE": "EE",
  "lv-LV": "LV",
  "lt-LT": "LT",
  "el-GR": "GR",
  // Default fallback
  "en-US": "US",
};

function getMarketFromLocale(locale: string): string {
  // Try exact match first
  if (LOCALE_TO_MARKET[locale]) {
    return LOCALE_TO_MARKET[locale];
  }
  
  // Try matching just the language code
  const languageCode = locale.split("-")[0];
  const matchingLocale = Object.keys(LOCALE_TO_MARKET).find(
    (key) => key.startsWith(languageCode + "-")
  );
  
  if (matchingLocale) {
    return LOCALE_TO_MARKET[matchingLocale];
  }
  
  // Default to FR if no match found (as the app was originally built for France)
  return "FR";
}

interface LocaleContextValue extends LocaleConfig {
  updateLocale: (newLocale: string) => void;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<string>(() => {
    // Check if we're on the server
    if (typeof window === "undefined") {
      return "en-US";
    }
    
    // Try to get saved preference
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved) {
      return saved;
    }
    
    // Fall back to browser locale
    return navigator.language || "en-US";
  });

  useEffect(() => {
    // Only run on client-side after hydration
    if (typeof window === "undefined") return;
    
    // Check if we need to update from server-side default
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (!saved) {
      // No saved preference, use browser locale
      const browserLocale = navigator.language || "en-US";
      if (browserLocale !== locale) {
        setLocale(browserLocale);
      }
    }
  }, []);

  const updateLocale = (newLocale: string) => {
    localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
    setLocale(newLocale);
  };

  const market = getMarketFromLocale(locale);

  const value: LocaleContextValue = {
    locale,
    market,
    updateLocale,
  };

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocaleContext() {
  const context = useContext(LocaleContext);
  
  if (!context) {
    throw new Error("useLocaleContext must be used within a LocaleProvider");
  }
  
  return context;
}
