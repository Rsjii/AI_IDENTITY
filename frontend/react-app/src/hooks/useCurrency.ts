import { useState, useEffect } from 'react';
import { detectUserCurrency, getBillingCountry, type DetectedLocation } from '@/lib/currencyDetection';
import type { BillingCountry, Currency } from '@/lib/planPriceBook';

interface CurrencyState {
  billingCountry: BillingCountry;
  currency: Currency;
  isDetecting: boolean;
  detectionMethod: 'browser_locale' | 'ip_geolocation' | 'default' | null;
}

/**
 * Hook to detect and manage user's currency
 * Auto-detects on mount, caches in localStorage
 */
export function useCurrency() {
  const [state, setState] = useState<CurrencyState>({
    billingCountry: 'OTHER',  // Default to USD
    currency: 'USD',
    isDetecting: true,
    detectionMethod: null,
  });

  useEffect(() => {
    async function detectCurrency() {
      // Check if we already detected currency (cached in localStorage)
      const cached = localStorage.getItem('user_currency_detection');
      if (cached) {
        try {
          const parsed: DetectedLocation = JSON.parse(cached);
          setState({
            billingCountry: getBillingCountry(parsed),
            currency: parsed.currency,
            isDetecting: false,
            detectionMethod: parsed.method,
          });
          return;
        } catch (err) {
          console.error('Error parsing cached currency:', err);
        }
      }

      // Detect currency
      const detected = await detectUserCurrency();

      // Cache the result
      localStorage.setItem('user_currency_detection', JSON.stringify(detected));

      setState({
        billingCountry: getBillingCountry(detected),
        currency: detected.currency,
        isDetecting: false,
        detectionMethod: detected.method,
      });
    }

    detectCurrency();
  }, []);

  /**
   * Manually override detected currency
   * Useful for "Not in India? Change region" feature
   */
  const setCurrency = (billingCountry: BillingCountry) => {
    const currency: Currency = billingCountry === 'IN' ? 'INR' : 'USD';
    const override: DetectedLocation = {
      country: billingCountry === 'IN' ? 'IN' : 'US',
      currency,
      method: 'default',
    };

    localStorage.setItem('user_currency_detection', JSON.stringify(override));

    setState({
      billingCountry,
      currency,
      isDetecting: false,
      detectionMethod: 'default',
    });
  };

  return {
    ...state,
    setCurrency,
  };
}
