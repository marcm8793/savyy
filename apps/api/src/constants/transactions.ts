/**
 * Centralised limits used by every transaction-sync code path.
 * Immutable at runtime – adjust only via code review.
 */
export const TRANSACTION_SYNC_CONFIG = Object.freeze({
  DEFAULT_DATE_RANGE_MONTHS: 3,
  MIN_DATE_RANGE_MONTHS: 1,
  MAX_DATE_RANGE_MONTHS: 24,
  WEBHOOK_LOOKBACK_DAYS: 7,
  STATUS_UPDATE_LOOKBACK_DAYS: 30,
});