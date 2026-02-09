export type BillingCountry = 'IN' | 'OTHER';
export type Tier = 'starter' | 'growth' | 'scale';
export type Currency = 'INR' | 'USD';

// Exchange rates (should be updated periodically - ideally from an API)
const EXCHANGE_RATES = {
  INR_TO_USD: 0.012,  // 1 INR = $0.012
  USD_TO_INR: 83.33,  // $1 = ₹83.33
} as const;

const PRICE_BOOK = {
  IN: {
    currency: 'INR',
    symbol: '₹',
    // MUST match Razorpay paise backend defaults: 99900/199900/499900
    monthly: { starter: 999, growth: 1999, scale: 4999 },
  },
  OTHER: {
    currency: 'USD',
    symbol: '$',
    // MUST match LemonSqueezy variants you configured in dashboard
    monthly: { starter: 49, growth: 149, scale: 499 },
  },
} as const;

export function getMonthlyPrice(billingCountry: BillingCountry, tier: Tier) {
  const book = billingCountry === 'IN' ? PRICE_BOOK.IN : PRICE_BOOK.OTHER;
  return { amount: book.monthly[tier], currency: book.currency, symbol: book.symbol };
}

export function formatMonthlyPrice(billingCountry: BillingCountry, tier: Tier) {
  const p = getMonthlyPrice(billingCountry, tier);
  return `${p.symbol}${p.amount}/mo`;
}

/**
 * Smart rounding - make prices look clean while keeping < 2% difference
 * Based on MVP_CURRENCY_STRATEGY.md
 * @param amount - Amount in target currency (NOT in cents)
 * @param currency - Target currency
 * @returns Rounded amount
 */
function smartRound(amount: number, currency: Currency): number {
  if (currency === 'INR') {
    // Indian Rupees - round based on magnitude
    if (amount < 100) {
      // Under ₹100: Round to nearest ₹1
      // ₹83.7 → ₹84
      return Math.round(amount);
    } else if (amount < 1000) {
      // ₹100-₹1000: Round to nearest ₹10
      // ₹837 → ₹840
      return Math.round(amount / 10) * 10;
    } else if (amount < 10000) {
      // ₹1000-₹10000: Round to nearest ₹50
      // ₹8,249 → ₹8,250
      return Math.round(amount / 50) * 50;
    } else {
      // Over ₹10000: Round to nearest ₹100
      // ₹12,345 → ₹12,300
      return Math.round(amount / 100) * 100;
    }
  } else {
    // US Dollars - round based on magnitude
    if (amount < 10) {
      // Under $10: Round to nearest $0.50
      // $8.37 → $8.50
      return Math.round(amount * 2) / 2;
    } else if (amount < 100) {
      // $10-$100: Round to nearest $1
      // $62.5 → $63 (NOT $49!)
      return Math.round(amount);
    } else if (amount < 1000) {
      // $100-$1000: Round to nearest $10
      // $625 → $630
      return Math.round(amount / 10) * 10;
    } else {
      // Over $1000: Round to nearest $50
      // $1,234 → $1,250
      return Math.round(amount / 50) * 50;
    }
  }
}

/**
 * Validate that rounding difference is < 2%
 * @param original - Original converted amount
 * @param rounded - Rounded amount
 * @returns true if difference is acceptable
 */
function validateRounding(original: number, rounded: number): boolean {
  const diff = Math.abs(rounded - original);
  const percentDiff = (diff / original) * 100;

  // If difference > 2%, log warning
  if (percentDiff > 2) {
    console.warn(`Rounding difference too large: ${percentDiff.toFixed(2)}%`);
    return false;
  }

  return true;
}

/**
 * Convert price amount from one currency to another with smart rounding
 * @param amount - Amount in source currency (NOT in cents - e.g., 100 for $100 or ₹100)
 * @param fromCurrency - Source currency
 * @param toCurrency - Target currency
 * @returns Converted and smartly rounded amount in target currency
 */
export function convertPrice(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency
): number {
  if (fromCurrency === toCurrency) return amount;

  // Step 1: Convert at real exchange rate
  let converted: number;
  if (fromCurrency === 'INR' && toCurrency === 'USD') {
    converted = amount * EXCHANGE_RATES.INR_TO_USD;
  } else if (fromCurrency === 'USD' && toCurrency === 'INR') {
    converted = amount * EXCHANGE_RATES.USD_TO_INR;
  } else {
    return amount;
  }

  // Step 2: Apply smart rounding
  const rounded = smartRound(converted, toCurrency);

  // Step 3: Validate < 2% difference
  if (!validateRounding(converted, rounded)) {
    // If rounding changed price too much, use exact conversion
    return toCurrency === 'USD'
      ? Math.round(converted * 100) / 100  // 2 decimal places for USD
      : Math.round(converted);              // Whole number for INR
  }

  return rounded;
}

/**
 * Format price with currency symbol
 * @param amount - Amount (NOT in cents)
 * @param currency - Currency code
 * @returns Formatted price string (e.g., "$100" or "₹1,000")
 */
export function formatPrice(amount: number, currency: Currency): string {
  const symbol = currency === 'INR' ? '₹' : '$';

  if (currency === 'INR') {
    // Format INR with comma separators (Indian numbering system)
    return `${symbol}${amount.toLocaleString('en-IN')}`;
  } else {
    // Format USD with 2 decimal places
    return `${symbol}${amount.toFixed(2)}`;
  }
}

/**
 * Display price for user with optional conversion display
 * @param amount - Amount in creator's base currency
 * @param creatorCurrency - Creator's base currency
 * @param viewerCountry - Viewer's billing country
 * @param showBoth - Whether to show both currencies
 * @returns Formatted price string with optional conversion in parentheses
 * @example
 * displayPrice(1000, 'INR', 'OTHER', true) => "$12.00 (₹1,000)"
 * displayPrice(50, 'USD', 'IN', true) => "₹4,167 ($50.00)"
 */
export function displayPrice(
  amount: number,
  creatorCurrency: Currency,
  viewerCountry: BillingCountry,
  showBoth = true
): string {
  const viewerCurrency = viewerCountry === 'IN' ? 'INR' : 'USD';

  if (creatorCurrency === viewerCurrency) {
    // Same currency, just format
    return formatPrice(amount, creatorCurrency);
  }

  // Different currency, show converted + original
  const converted = convertPrice(amount, creatorCurrency, viewerCurrency);

  if (showBoth) {
    return `${formatPrice(converted, viewerCurrency)} (${formatPrice(amount, creatorCurrency)})`;
  }

  return formatPrice(converted, viewerCurrency);
}

/**
 * Get currency info for a billing country
 */
export function getCurrencyInfo(billingCountry: BillingCountry): {
  currency: Currency;
  symbol: string;
  name: string;
} {
  if (billingCountry === 'IN') {
    return {
      currency: 'INR',
      symbol: '₹',
      name: 'Indian Rupee',
    };
  }
  return {
    currency: 'USD',
    symbol: '$',
    name: 'US Dollar',
  };
}


