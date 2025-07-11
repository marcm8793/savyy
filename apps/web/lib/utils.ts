import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calculates the scaled amount from a string amount and scale factor.
 * @param amount - The amount as a string
 * @param scale - The scale factor (typically from transaction data)
 * @returns The scaled amount as a number
 */
export function calculateScaledAmount(
  amount: string,
  scale: number | null
): number {
  if (!amount || typeof amount !== "string") {
    throw new Error("Amount must be a non-empty string");
  }
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) {
    throw new Error("Amount must be a valid number string");
  }
  return numAmount / Math.pow(10, scale || 0);
}

/**
 * Formats an amount with currency using Intl.NumberFormat.
 * @param amount - The amount as a string
 * @param scale - The scale factor (typically from transaction data)
 * @param currency - The currency code (e.g., "EUR", "USD")
 * @param locale - The locale for formatting (defaults to "en-US")
 * @param defaultCurrency - The default currency to use if currency is null/undefined
 * @returns Formatted currency string
 */
export function formatAmount(
  amount: string,
  scale: number | null,
  currency: string | null,
  locale: string = "en-US",
  defaultCurrency: string = "EUR"
): string {
  const scaledAmount = calculateScaledAmount(amount, scale);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency || defaultCurrency,
  }).format(scaledAmount);
}

/**
 * Formats a balance stored as cents (or similar unit) with currency.
 * @param balance - The balance in cents/smallest unit
 * @param currency - The currency code
 * @param locale - The locale for formatting (defaults to "en-US")
 * @param defaultCurrency - The default currency to use if currency is null/undefined
 * @returns Formatted currency string or "N/A" if balance is null
 */
export function formatBalance(
  balance: number | null,
  currency: string | null,
  locale: string = "en-US",
  defaultCurrency: string = "EUR"
): string {
  if (balance === null) return "N/A";
  const amount = balance / 100; // Convert from cents
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency || defaultCurrency,
  }).format(amount);
}

/**
 * Formats a simple amount (already scaled) with currency.
 * @param amount - The amount as a number
 * @param currency - The currency code
 * @param locale - The locale for formatting (defaults to "en-US")
 * @param options - Additional Intl.NumberFormatOptions to override defaults
 * @returns Formatted currency string
 */
export function formatSimpleAmount(
  amount: number,
  currency: string | null = "EUR",
  locale: string = "en-US",
  options?: Partial<Intl.NumberFormatOptions>
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency || "EUR",
    ...options,
  }).format(amount);
}
