# Currency Formatting and Digit Management

This document describes the currency formatting system used throughout the Savyy application, with a focus on controlling decimal places and ensuring locale-aware formatting.

## Overview

The application uses the native JavaScript `Intl.NumberFormat` API for all currency formatting, ensuring proper locale-aware display of monetary values across different regions and currencies.

## Core Formatting Functions

### `formatSimpleAmount`

Located in `/apps/web/lib/utils.ts:81-92`, this is the primary function for formatting currency values.

```typescript
export function formatSimpleAmount(
  amount: number,
  currency: string | null = "EUR",
  locale: string = "en-US",
  options?: Partial<Intl.NumberFormatOptions>
): string
```

#### Parameters:
- `amount`: The numeric value to format
- `currency`: ISO 4217 currency code (defaults to "EUR")
- `locale`: Locale string for formatting (defaults to "en-US")
- `options`: Optional override for `Intl.NumberFormat` options

#### Usage Examples:

```typescript
// Standard currency formatting with decimals
formatSimpleAmount(123.45, "EUR", "en-US")
// Output: "€123.45"

// Remove decimal places for whole number display
formatSimpleAmount(123.45, "EUR", "en-US", { 
  minimumFractionDigits: 0, 
  maximumFractionDigits: 0 
})
// Output: "€123"

// Custom decimal precision
formatSimpleAmount(123.456, "EUR", "en-US", { 
  minimumFractionDigits: 2, 
  maximumFractionDigits: 3 
})
// Output: "€123.456"
```

### Other Formatting Functions

- **`formatAmount`**: Handles amounts with scale factors (e.g., from payment APIs)
- **`formatBalance`**: Specifically for account balances stored in cents
- **`calculateScaledAmount`**: Utility for converting scaled amounts to decimal values

## Decimal Digit Management

### When to Remove Decimals

Decimal places are typically removed in the following scenarios:

1. **Daily/Monthly Averages**: When showing averaged values where cents are less meaningful
2. **Chart Axes**: Y-axis labels in charts to reduce visual clutter
3. **Large Round Numbers**: When displaying totals or summaries

### Implementation Pattern

Instead of using regex replacement (`replace(/\.\d{2}$/, "")`), always use the `Intl.NumberFormat` options:

```typescript
// ❌ Avoid: Regex-based decimal removal
formatSimpleAmount(amount, "EUR", locale).replace(/\.\d{2}$/, "")

// ✅ Preferred: Native formatting options
formatSimpleAmount(amount, "EUR", locale, { 
  minimumFractionDigits: 0, 
  maximumFractionDigits: 0 
})
```

### Benefits of This Approach

1. **Locale Awareness**: Different locales use different decimal separators (. vs ,)
2. **Currency Flexibility**: Some currencies don't use decimal places (e.g., JPY)
3. **Consistency**: Single source of truth for formatting logic
4. **Future-Proof**: Easy to adjust precision requirements per use case

## Common Use Cases

### Dashboard Statistics Cards
```typescript
// Daily spending average without cents
formatSimpleAmount(averageDailySpending, "EUR", locale, { 
  minimumFractionDigits: 0, 
  maximumFractionDigits: 0 
})
```

### Chart Formatting
```typescript
// Y-axis tick formatter for spending charts
tickFormatter={(value) => formatSimpleAmount(Number(value), "EUR", locale, { 
  minimumFractionDigits: 0, 
  maximumFractionDigits: 0 
})}
```

### Transaction Lists
```typescript
// Full precision for individual transactions
formatSimpleAmount(transaction.amount, transaction.currency, locale)
```

## Best Practices

1. **Always use the locale from context**: Access locale via `useLocaleContext()` hook
2. **Be consistent with currency codes**: Default to "EUR" when currency is unknown
3. **Consider the context**: Show full precision for transactions, reduce for summaries
4. **Test with different locales**: Ensure formatting works correctly for various regions
5. **Handle null/undefined gracefully**: Use default values when currency data is missing

## Future Considerations

- Consider creating preset formatting options for common use cases
- Add support for cryptocurrency formatting (higher precision requirements)
- Implement user preferences for decimal display
- Add formatting for percentages and other non-currency numbers