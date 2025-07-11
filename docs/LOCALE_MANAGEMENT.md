# Locale Management in Savyy Web Application

This document describes how locale and internationalization are managed in the Savyy web application.

## Overview

The Savyy web app implements a comprehensive locale management system that handles:
- User locale preferences
- Currency formatting based on locale
- Market code mapping for Tink API integration
- Persistent locale storage

## Architecture

### Core Components

1. **LocaleProvider** (`/apps/web/providers/locale-provider.tsx`)
   - React Context provider that manages locale state
   - Handles locale persistence in localStorage
   - Maps locales to Tink market codes
   - Provides locale update functionality

2. **useLocale Hook** (`/apps/web/lib/hooks/useLocale.ts`)
   - Custom hook for accessing locale configuration
   - Provides both read and update capabilities
   - Exports `LocaleConfig` interface

3. **Formatting Utilities** (`/apps/web/lib/utils.ts`)
   - Currency formatting functions that accept locale parameter
   - Handles amount scaling and conversion
   - Provides consistent formatting across the app

## Implementation Details

### LocaleProvider

The provider wraps the entire application and:
- Initializes with browser locale or saved preference
- Stores locale preference in localStorage with key `savyy-locale`
- Automatically maps locale to Tink market codes
- Handles SSR/hydration correctly

```typescript
// Usage in layout
<LocaleProvider>
  {children}
</LocaleProvider>
```

### Locale to Market Mapping

The system maintains a comprehensive mapping of locales to Tink market codes:

```typescript
const LOCALE_TO_MARKET: Record<string, string> = {
  "fr-FR": "FR",  // France
  "de-DE": "DE",  // Germany
  "en-GB": "GB",  // United Kingdom
  // ... 20+ European markets
  "en-US": "US",  // Default fallback
};
```

### Hooks Usage

```typescript
// Get current locale config
const { locale, market } = useLocale();

// Update locale
const updateLocale = useUpdateLocale();
updateLocale("fr-FR");

// Or use the context directly
const { locale, market, updateLocale } = useLocaleContext();
```

### Currency Formatting

The utility functions accept locale as a parameter:

```typescript
// Format transaction amount
formatAmount(amount, scale, currency, locale, defaultCurrency);

// Format balance from cents
formatBalance(balance, currency, locale, defaultCurrency);

// Format simple amount
formatSimpleAmount(amount, currency, locale, options);
```

## Usage in Components

### Dashboard Components

Components like `StatsCards`, `MonthlySpendingChart`, and `CategoryBreakdown` use the locale system:

```typescript
const { locale } = useLocale();

// Format currency values
const formatted = formatSimpleAmount(
  totalSpending, 
  "EUR", 
  locale,
  { minimumFractionDigits: 0, maximumFractionDigits: 0 }
);
```

### Transaction Components

Transaction detail sheets and lists use locale-aware formatting:

```typescript
const { locale } = useLocale();
const formattedAmount = formatAmount(
  transaction.amount,
  transaction.scale,
  transaction.currency,
  locale
);
```

## Locale Detection Strategy

1. **Server-Side Rendering**: Defaults to `en-US`
2. **Client-Side Hydration**:
   - Check localStorage for saved preference
   - If no saved preference, use browser's `navigator.language`
   - Save the detected/selected locale for future visits

## Supported Locales

The system supports 24 European locales plus US English:
- Western Europe: FR, DE, IT, ES, NL, PT, GB
- Nordic: SE, FI, DK, NO
- Eastern Europe: PL, CZ, SK, HU, RO, BG, HR, SI
- Baltic: EE, LV, LT
- Mediterranean: GR

## Default Behavior

- **Default Locale**: `en-US` (falls back to browser locale)
- **Default Market**: `FR` (when no mapping found)
- **Default Currency**: `EUR` (used when currency is null)

## Best Practices

1. **Always use locale from context** rather than hardcoding
2. **Pass locale to formatting functions** for consistent display
3. **Use the provider at the app root** to ensure availability
4. **Handle SSR appropriately** with server-side defaults

## Future Enhancements

Potential improvements could include:
- User preference UI for selecting locale
- Automatic currency detection based on user's accounts
- Translation system integration for UI text
- Regional date/time formatting