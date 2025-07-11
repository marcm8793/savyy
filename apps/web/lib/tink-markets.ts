// Tink supported markets with their locale mappings
export const TINK_MARKETS = [
  { 
    code: "FR", 
    name: "France", 
    flag: "🇫🇷",
    locales: ["fr_FR", "en_US"],
    description: "France - Full banking support"
  },
  { 
    code: "DE", 
    name: "Germany", 
    flag: "🇩🇪",
    locales: ["de_DE", "en_US"],
    description: "Germany - Full banking support"
  },
  { 
    code: "GB", 
    name: "United Kingdom", 
    flag: "🇬🇧",
    locales: ["en_GB", "en_US"],
    description: "United Kingdom - Full banking support"
  },
  { 
    code: "SE", 
    name: "Sweden", 
    flag: "🇸🇪",
    locales: ["sv_SE", "en_US"],
    description: "Sweden - Full banking support"
  },
  { 
    code: "NO", 
    name: "Norway", 
    flag: "🇳🇴",
    locales: ["nb_NO", "en_US"],
    description: "Norway - Full banking support"
  },
  { 
    code: "DK", 
    name: "Denmark", 
    flag: "🇩🇰",
    locales: ["da_DK", "en_US"],
    description: "Denmark - Full banking support"
  },
  { 
    code: "FI", 
    name: "Finland", 
    flag: "🇫🇮",
    locales: ["fi_FI", "en_US"],
    description: "Finland - Full banking support"
  },
  { 
    code: "ES", 
    name: "Spain", 
    flag: "🇪🇸",
    locales: ["es_ES", "en_US"],
    description: "Spain - Full banking support"
  },
  { 
    code: "IT", 
    name: "Italy", 
    flag: "🇮🇹",
    locales: ["it_IT", "en_US"],
    description: "Italy - Full banking support"
  },
  { 
    code: "PT", 
    name: "Portugal", 
    flag: "🇵🇹",
    locales: ["pt_PT", "en_US"],
    description: "Portugal - Full banking support"
  },
  { 
    code: "NL", 
    name: "Netherlands", 
    flag: "🇳🇱",
    locales: ["nl_NL", "en_US"],
    description: "Netherlands - Full banking support"
  },
  { 
    code: "BE", 
    name: "Belgium", 
    flag: "🇧🇪",
    locales: ["fr_BE", "nl_BE", "en_US"],
    description: "Belgium - Full banking support"
  },
  { 
    code: "AT", 
    name: "Austria", 
    flag: "🇦🇹",
    locales: ["de_AT", "en_US"],
    description: "Austria - Full banking support"
  },
  { 
    code: "CH", 
    name: "Switzerland", 
    flag: "🇨🇭",
    locales: ["de_CH", "fr_CH", "it_CH", "en_US"],
    description: "Switzerland - Full banking support"
  },
] as const;

export type TinkMarket = typeof TINK_MARKETS[number];
export type TinkMarketCode = TinkMarket['code'];
export type TinkLocale = TinkMarket['locales'][number];

// Helper function to check if a string is a valid TinkLocale
export const isTinkLocale = (value: string): value is TinkLocale => {
  return TINK_MARKETS.some(market => 
    (market.locales as readonly string[]).includes(value)
  );
};