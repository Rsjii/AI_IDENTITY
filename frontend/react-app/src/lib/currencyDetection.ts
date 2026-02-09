/**
 * Currency Detection Utilities
 * Based on MVP_CURRENCY_STRATEGY.md
 *
 * Auto-detect user's currency based on:
 * 1. Browser locale (fastest)
 * 2. IP geolocation (fallback)
 */

export type DetectedLocation = {
  country: string;
  currency: 'INR' | 'USD';
  method: 'browser_locale' | 'ip_geolocation' | 'default';
};

/**
 * Detect currency from browser locale
 * Fast and works offline
 */
export function detectCurrencyFromBrowser(): DetectedLocation | null {
  try {
    // Get browser language setting
    const locale = navigator.language; // e.g., 'en-IN', 'en-US', 'hi-IN'
    const countryCode = locale.split('-')[1]?.toUpperCase();

    if (!countryCode) return null;

    // Map country code to currency
    const currencyMap: Record<string, 'INR' | 'USD'> = {
      'IN': 'INR',
      'US': 'USD',
      'GB': 'USD',  // Will expand to GBP in Phase 2
      'CA': 'USD',  // Will expand to CAD in Phase 2
      'AU': 'USD',  // Will expand to AUD in Phase 2
      // Add more as needed
    };

    const currency = currencyMap[countryCode];
    if (!currency) return null;

    return {
      country: countryCode,
      currency,
      method: 'browser_locale',
    };
  } catch (error) {
    console.error('Error detecting currency from browser:', error);
    return null;
  }
}

/**
 * Detect currency from IP geolocation
 * Requires API call, use as fallback
 */
export async function detectCurrencyFromIP(): Promise<DetectedLocation> {
  try {
    // Using ipapi.co - Free tier: 30k requests/month
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();

    // Map country to currency (for MVP: only IN=INR, rest=USD)
    const currency = data.country_code === 'IN' ? 'INR' : 'USD';

    return {
      country: data.country_code || 'US',
      currency,
      method: 'ip_geolocation',
    };
  } catch (error) {
    console.error('Error detecting currency from IP:', error);
    // Fallback to USD
    return {
      country: 'US',
      currency: 'USD',
      method: 'default',
    };
  }
}

/**
 * Detect user's currency (tries browser locale first, then IP)
 * This is the main function to use
 */
export async function detectUserCurrency(): Promise<DetectedLocation> {
  // Try browser locale first (instant)
  const browserDetection = detectCurrencyFromBrowser();
  if (browserDetection) {
    return browserDetection;
  }

  // Fallback to IP geolocation (requires API call)
  return await detectCurrencyFromIP();
}

/**
 * Get billing country from detected location
 * 'IN' for India, 'OTHER' for everything else (MVP)
 */
export function getBillingCountry(location: DetectedLocation): 'IN' | 'OTHER' {
  return location.country === 'IN' ? 'IN' : 'OTHER';
}

/**
 * Hook-friendly version - returns billing country directly
 */
export async function detectBillingCountry(): Promise<'IN' | 'OTHER'> {
  const location = await detectUserCurrency();
  return getBillingCountry(location);
}
