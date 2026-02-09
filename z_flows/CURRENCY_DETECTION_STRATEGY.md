# 💰 Currency Detection Strategy - AI Identity Platform

## Overview
Automatic currency detection using IP geolocation + browser locale. NO explicit user questions.

---

## Detection Methods (Priority Order)

### Method 1: Browser Locale (Fastest)
```javascript
// frontend/utils/currencyDetection.ts

export function detectCurrencyFromBrowser(): string | null {
  // Get browser language setting
  const locale = navigator.language; // e.g., 'en-IN', 'en-US', 'hi-IN'

  const countryCode = locale.split('-')[1]?.toUpperCase();

  const currencyMap: Record<string, string> = {
    'IN': 'INR',
    'US': 'USD',
    'GB': 'GBP',
    'CA': 'CAD',
    'AU': 'AUD',
    'EU': 'EUR',
    // ... add more
  };

  return currencyMap[countryCode] || null;
}
```

### Method 2: IP Geolocation (Fallback)
```javascript
export async function detectCurrencyFromIP(): Promise<{
  country: string;
  currency: string;
  timezone: string;
}> {
  try {
    // Free tier: 30k requests/month
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();

    return {
      country: data.country_code,  // 'IN'
      currency: data.currency,     // 'INR'
      timezone: data.timezone,     // 'Asia/Kolkata'
    };
  } catch (error) {
    // Fallback to default
    return {
      country: 'US',
      currency: 'USD',
      timezone: 'America/New_York'
    };
  }
}

// Alternative: Use Cloudflare Workers (if using CF)
export function detectFromCloudflare(request: Request) {
  // Cloudflare automatically adds location headers
  const country = request.headers.get('CF-IPCountry');
  const timezone = request.headers.get('CF-Timezone');

  return {
    country,
    currency: getCurrencyForCountry(country),
    timezone
  };
}
```

### Method 3: Phone Number (During Signup)
```javascript
// If user signs up with phone number
export function detectFromPhoneNumber(phone: string): string {
  // Use libphonenumber-js
  import { parsePhoneNumber } from 'libphonenumber-js';

  try {
    const phoneNumber = parsePhoneNumber(phone);
    const countryCode = phoneNumber.country; // 'IN', 'US'

    return getCurrencyForCountry(countryCode);
  } catch {
    return 'USD'; // default
  }
}
```

---

## Implementation Flow

### A. Creator Onboarding (First Time Setup)

```javascript
// pages/OnboardingCurrencyPage.tsx

export function OnboardingCurrencyPage() {
  const [detectedRegion, setDetectedRegion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function autoDetect() {
      // Try browser locale first
      let currency = detectCurrencyFromBrowser();

      // Fallback to IP geolocation
      if (!currency) {
        const geoData = await detectCurrencyFromIP();
        currency = geoData.currency;
        setDetectedRegion(geoData);
      }

      setLoading(false);
    }

    autoDetect();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="animate-spin" />
        <span>Detecting your region...</span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Payment Settings</CardTitle>
        <CardDescription>
          Based on your location, we've configured your payout currency
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Auto-detected region display */}
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="text-green-600" />
          <AlertDescription>
            <div className="flex items-center gap-3">
              <span className="text-4xl">
                {detectedRegion.country === 'IN' ? '🇮🇳' : '🇺🇸'}
              </span>
              <div>
                <p className="font-semibold">
                  {detectedRegion.country === 'IN'
                    ? 'India - Indian Rupee (INR)'
                    : 'United States - US Dollar (USD)'
                  }
                </p>
                <p className="text-sm text-muted-foreground">
                  Detected from your location
                </p>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        {/* Payment gateway info */}
        <div className="mt-4 p-4 bg-gray-50 rounded">
          <h4 className="font-medium mb-2">Your Payout Method</h4>
          {detectedRegion.country === 'IN' ? (
            <div className="flex items-center gap-2">
              <img src="/razorpay-logo.svg" className="h-6" />
              <span>→ Indian Bank Account (UPI/NEFT/IMPS)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <img src="/lemonsqueezy-logo.svg" className="h-6" />
              <span>→ International Bank/PayPal</span>
            </div>
          )}
        </div>

        {/* Allow manual override (collapsed by default) */}
        <Collapsible className="mt-6">
          <CollapsibleTrigger className="text-sm text-blue-600 hover:underline">
            Not in {detectedRegion.country === 'IN' ? 'India' : 'the US'}?
            Change your region →
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Select
              value={selectedCountry}
              onChange={handleCountryChange}
              className="mt-2"
            >
              <option value="IN">🇮🇳 India (INR - Razorpay)</option>
              <option value="US">🇺🇸 United States (USD - LemonSqueezy)</option>
              <option value="GB">🇬🇧 United Kingdom (GBP - LemonSqueezy)</option>
              <option value="CA">🇨🇦 Canada (CAD - LemonSqueezy)</option>
              <option value="AU">🇦🇺 Australia (AUD - LemonSqueezy)</option>
            </Select>

            <p className="text-xs text-muted-foreground mt-2">
              💡 Choose based on where you want to receive payments
            </p>
          </CollapsibleContent>
        </Collapsible>

        <Button onClick={handleContinue} className="mt-6 w-full">
          Continue with {detectedRegion.currency} →
        </Button>
      </CardContent>
    </Card>
  );
}
```

### B. Buyer Price Display (Fully Automatic)

```javascript
// components/PriceDisplay.tsx

export function PriceDisplay({
  creatorBaseCurrency,
  basePriceCents
}: {
  creatorBaseCurrency: 'INR' | 'USD',
  basePriceCents: number
}) {
  const [buyerCurrency, setBuyerCurrency] = useState<string>('USD');
  const [convertedPrice, setConvertedPrice] = useState(basePriceCents);

  useEffect(() => {
    async function detectAndConvert() {
      // Auto-detect buyer's currency
      let currency = detectCurrencyFromBrowser();

      if (!currency) {
        const geo = await detectCurrencyFromIP();
        currency = geo.currency;
      }

      setBuyerCurrency(currency);

      // Convert price if needed
      if (currency !== creatorBaseCurrency) {
        const converted = await convertCurrency(
          basePriceCents,
          creatorBaseCurrency,
          currency
        );
        setConvertedPrice(converted);
      }
    }

    detectAndConvert();
  }, []);

  // Same currency - just display
  if (buyerCurrency === creatorBaseCurrency) {
    return (
      <div className="price">
        <span className="text-3xl font-bold">
          {formatPrice(basePriceCents, creatorBaseCurrency)}
        </span>
        <span className="text-sm text-muted">/month</span>
      </div>
    );
  }

  // Different currency - show converted + original
  return (
    <div className="price">
      <span className="text-3xl font-bold">
        {formatPrice(convertedPrice, buyerCurrency)}
      </span>
      <span className="text-sm text-muted">/month</span>

      <p className="text-xs text-muted-foreground mt-1">
        Original price: {formatPrice(basePriceCents, creatorBaseCurrency)}
      </p>

      {/* Optional: Allow currency override */}
      <button
        className="text-xs text-blue-600 hover:underline mt-2"
        onClick={() => setShowCurrencyPicker(true)}
      >
        Show in different currency
      </button>
    </div>
  );
}
```

---

## Backend Implementation

### Database Schema
```sql
-- Users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS base_currency VARCHAR(3) DEFAULT 'USD';
ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_country VARCHAR(2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS detected_timezone VARCHAR(50);

-- Store detection metadata
ALTER TABLE users ADD COLUMN IF NOT EXISTS currency_detection_method VARCHAR(20);
-- Values: 'browser_locale', 'ip_geolocation', 'phone_number', 'manual'
```

### API Endpoint
```typescript
// backend/routes/currency.ts

import { Request, Response } from 'express';
import fetch from 'node-fetch';

// Server-side IP geolocation (more reliable)
export async function detectUserCurrency(req: Request, res: Response) {
  try {
    // Get user's IP
    const userIP = req.headers['x-forwarded-for'] ||
                   req.connection.remoteAddress;

    // Call geolocation API
    const response = await fetch(`https://ipapi.co/${userIP}/json/`);
    const data = await response.json();

    return res.json({
      country: data.country_code,
      currency: data.currency,
      timezone: data.timezone,
      city: data.city,
      region: data.region,
      method: 'ip_geolocation'
    });
  } catch (error) {
    // Fallback
    return res.json({
      country: 'US',
      currency: 'USD',
      timezone: 'America/New_York',
      method: 'default'
    });
  }
}

// Cloudflare Workers version (if using CF)
export async function detectCurrencyWorker(request: Request) {
  const country = request.headers.get('CF-IPCountry');
  const timezone = request.headers.get('CF-Timezone');

  const currencyMap: Record<string, string> = {
    'IN': 'INR',
    'US': 'USD',
    'GB': 'GBP',
    'CA': 'CAD',
    'AU': 'AUD',
    // ... add all countries
  };

  return new Response(JSON.stringify({
    country,
    currency: currencyMap[country] || 'USD',
    timezone,
    method: 'cloudflare_headers'
  }));
}
```

---

## Currency Conversion

### Exchange Rate API
```typescript
// utils/currencyConverter.ts

const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/USD';

interface ExchangeRates {
  [currency: string]: number;
}

let cachedRates: ExchangeRates | null = null;
let lastFetch: number = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export async function getExchangeRates(): Promise<ExchangeRates> {
  const now = Date.now();

  // Return cached if fresh
  if (cachedRates && (now - lastFetch) < CACHE_DURATION) {
    return cachedRates;
  }

  // Fetch fresh rates
  const response = await fetch(EXCHANGE_RATE_API);
  const data = await response.json();

  cachedRates = data.rates;
  lastFetch = now;

  return cachedRates;
}

export async function convertCurrency(
  amountCents: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  if (fromCurrency === toCurrency) return amountCents;

  const rates = await getExchangeRates();

  // Convert to USD first (base currency)
  const amountInUSD = amountCents / rates[fromCurrency];

  // Then to target currency
  const converted = amountInUSD * rates[toCurrency];

  // Round to nearest whole number for clean pricing
  return Math.round(converted);
}

export function formatPrice(cents: number, currency: string): string {
  const symbols: Record<string, string> = {
    'USD': '$',
    'INR': '₹',
    'GBP': '£',
    'EUR': '€',
    'CAD': 'C$',
    'AUD': 'A$',
  };

  const symbol = symbols[currency] || currency;
  const amount = (cents / 100).toFixed(2);

  return `${symbol}${amount}`;
}
```

---

## UX Patterns

### ✅ DO:
- Auto-detect silently in background
- Show "Detected from your location" badge
- Display detected region with flag/emoji
- Allow easy override (collapsed/modal)
- Save detection method for analytics

### ❌ DON'T:
- Ask "What's your currency?"
- Show country dropdown as primary input
- Force users to scroll through 200 countries
- Make them guess their currency code

### Example: Good vs Bad

**❌ BAD (Explicit Question)**
```
What currency do you want to receive payments in?
[Dropdown with 150+ currencies]
```

**✅ GOOD (Auto-detect with confirmation)**
```
✓ We detected you're in India
  Currency: INR (₹)
  Payouts: Razorpay → Indian Bank

  [Continue with INR ₹]  [Change region]
```

---

## Error Handling

### Detection Failures
```javascript
try {
  const currency = await detectCurrency();
} catch (error) {
  // Fallback hierarchy:
  // 1. Browser locale
  // 2. Default to USD
  // 3. Let user select manually

  const browserCurrency = detectCurrencyFromBrowser();
  if (browserCurrency) {
    return browserCurrency;
  }

  // Show manual selector as last resort
  setShowManualSelector(true);
}
```

### VPN/Proxy Users
```javascript
// Detect VPN/proxy mismatch
if (browserLocale === 'en-IN' && geoIP === 'US') {
  // User might be using VPN
  return (
    <Alert variant="info">
      <AlertDescription>
        We detected you might be using a VPN. Please confirm your actual
        location for accurate payment setup.

        <Select>
          <option>🇮🇳 India (from browser)</option>
          <option>🇺🇸 USA (from IP)</option>
        </Select>
      </AlertDescription>
    </Alert>
  );
}
```

---

## Analytics Tracking

```typescript
// Track detection accuracy
analytics.track('currency_detected', {
  method: 'ip_geolocation',
  detected_country: 'IN',
  detected_currency: 'INR',
  user_changed: false,  // Did user override?
  final_currency: 'INR'
});

// If user changes
analytics.track('currency_manual_override', {
  detected: 'USD',
  selected: 'INR',
  reason: 'vpn' | 'wrong_detection' | 'preference'
});
```

---

## Cost Analysis

### IP Geolocation APIs (Free Tiers)

| Service | Free Tier | Cost After |
|---------|-----------|------------|
| ipapi.co | 30k req/month | $10/100k |
| IPGeolocation | 30k req/month | $15/150k |
| Cloudflare Workers | Unlimited* | Included |
| MaxMind GeoIP2 | Pay per DB | $0.004/query |

**Recommendation:** Use ipapi.co for MVP, migrate to Cloudflare Workers at scale.

---

## Testing

### Test Cases
```javascript
describe('Currency Detection', () => {
  it('detects INR for Indian users', async () => {
    mockBrowserLocale('en-IN');
    const currency = detectCurrencyFromBrowser();
    expect(currency).toBe('INR');
  });

  it('falls back to IP geolocation', async () => {
    mockBrowserLocale(null);
    mockIPGeolocation({ country: 'IN', currency: 'INR' });
    const currency = await detectCurrency();
    expect(currency).toBe('INR');
  });

  it('handles VPN edge case', async () => {
    mockBrowserLocale('en-IN');
    mockIPGeolocation({ country: 'US' });
    const result = await detectCurrency();
    expect(result.showConfirmation).toBe(true);
  });
});
```

---

## Summary

### Detection Priority:
1. **Browser locale** (fastest, works offline)
2. **IP geolocation** (most accurate)
3. **Phone number** (during signup)
4. **Manual selection** (last resort)

### User Experience:
- **Silent detection** in background
- **Confirmation UI** showing detected region
- **Easy override** option (collapsed)
- **Never force** - always allow change

### Implementation:
- Frontend: Browser API + ipapi.co
- Backend: Cloudflare headers or MaxMind
- Cache: 24hr for exchange rates
- Fallback: USD default

---

## Sources
- [Stripe Adaptive Pricing](https://docs.stripe.com/payments/currencies/localize-prices/adaptive-pricing)
- [Shopify Geolocation Guide](https://help.shopify.com/en/manual/international/geolocation)
- [GeoLocation Best Practices 2026](https://geotargetly.com/blog/shopify-multi-currency)
