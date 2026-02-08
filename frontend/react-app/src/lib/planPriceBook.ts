export type BillingCountry = 'IN' | 'OTHER';
export type Tier = 'starter' | 'growth' | 'scale';

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


