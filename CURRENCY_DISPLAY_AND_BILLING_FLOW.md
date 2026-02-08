# Currency Display and Billing Country Selection Flow

## Overview

This document explains how the application determines and displays prices in different currencies (INR for India, USD for International) based on user selection, and how the billing country selection flows through the checkout process.

---

## Core Principle: User-Driven Currency Display

**Standard websites approach:** The application does **not** guess the user's location. Instead, it:

1. **Shows prices based on user's explicit billing country selection** (via dropdown)
2. **Pre-fills the selection intelligently** using multiple fallback hints
3. **Persists the selection** in localStorage for better UX
4. **Routes to the correct payment gateway** based on the selected billing country

---

## Billing Country Selection Logic

### Order of Priority (Standard Practice)

When a user visits any plan selection page, the default billing country is determined in this order:

1. **Last Selection (localStorage)** → User's previous choice (if available)
2. **Strong Hint: Phone Number Prefix** → If phone starts with `+91` or `91` → India
3. **Soft Hint: Browser Locale** → If `navigator.language` includes `-in` → India
4. **Soft Hint: Timezone** → If timezone is `Asia/Kolkata` → India
5. **Default** → `OTHER` (International/USD)

### Implementation

All plan pages use this logic:

```typescript
const defaultBillingCountry: BillingCountry = useMemo(() => {
  const stored = getLastBillingCountry(); // localStorage
  if (stored) return stored;

  const p = String(userPhone || '').trim();
  if (p.startsWith('+91') || p.startsWith('91')) return 'IN';

  // Soft hint: browser locale/timezone
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language || '';
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (lang.toLowerCase().includes('-in') || tz === 'Asia/Kolkata') return 'IN';
  }

  return 'OTHER';
}, [userPhone]);
```

---

## Currency Display: Price Book System

### Centralized Price Book

All prices are managed in a single source of truth: `frontend/react-app/src/lib/planPriceBook.ts`

**Price Book Structure:**
- **India (IN):** INR (₹) - ₹999/₹1999/₹4999 per month
- **International (OTHER):** USD ($) - $49/$149/$499 per month

**Why This Approach:**
- ✅ Consistent pricing across all pages
- ✅ Easy to update prices in one place
- ✅ No hard-coded currency values scattered in UI
- ✅ Matches backend Razorpay paise (99900/199900/499900) and LemonSqueezy variants

### Price Display Function

```typescript
export function formatMonthlyPrice(billingCountry: BillingCountry, tier: Tier) {
  const book = billingCountry === 'IN' ? PRICE_BOOK.IN : PRICE_BOOK.OTHER;
  return `${book.symbol}${book.amount}/mo`;
}
```

**Usage:** All plan pages call `formatMonthlyPrice(billingCountry, tier)` to display prices dynamically.

---

## Pages Using Currency Display

### 1. Onboarding Plan Page (`/onboarding/plan`)
- Shows plan cards with prices based on selected billing country
- User can change billing country via dropdown
- Selection persists to localStorage

### 2. Setup Plan Page (`/setup/plan`)
- Displays all plan tiers with dynamic pricing
- Billing country selector at top
- Prices update immediately when country changes

### 3. Pricing Page (`/pricing`)
- Public-facing pricing page
- Shows all plans with comparison table
- All prices use price book (fixed previous mismatch: $99/$199 → $149/$499)

### 4. Settings Page (`/settings?tab=billing`)
- Plan upgrade buttons show prices based on billing country
- Billing country selector in billing tab
- Selection persists across sessions

---

## Checkout Flow Integration

### Step 1: User Selects Billing Country
- User sees dropdown: "India" or "Outside India"
- Prices update immediately to show correct currency
- Selection saved to localStorage: `selflyx.billingCountry`

### Step 2: User Clicks "Choose Plan"
- Frontend calls `startPlanCheckout({ tier, billingCountry, returnUrl })`
- `billingCountry` is sent to backend API

### Step 3: Backend Gateway Selection
- Backend receives `billingCountry` in request body
- **Priority:** Explicit `billingCountry` from request overrides any heuristic
- **Routing:**
  - `billingCountry === 'IN'` → Razorpay (INR)
  - `billingCountry === 'OTHER'` → LemonSqueezy (USD)

### Step 4: Payment Processing
- **Razorpay (India):** Opens modal, user pays in INR
- **LemonSqueezy (International):** Redirects to checkout, user pays in USD

---

## Payment Gateway Mapping

| Billing Country | Gateway | Currency | Prices |
|----------------|---------|----------|--------|
| `IN` (India) | Razorpay | INR (₹) | ₹999 / ₹1999 / ₹4999 |
| `OTHER` (International) | LemonSqueezy | USD ($) | $49 / $149 / $499 |

**Important:** The frontend price book **must match** the backend gateway prices:
- Razorpay amounts in paise: 99900 / 199900 / 499900 (displayed as ₹999 / ₹1999 / ₹4999)
- LemonSqueezy variant prices: $49 / $149 / $499 (configured in LemonSqueezy dashboard)

---

## User Experience Flow

### First-Time User (No localStorage)
1. User visits pricing page
2. System checks phone number → If `+91` → defaults to "India"
3. If no phone, checks browser locale/timezone → If India-related → defaults to "India"
4. Otherwise defaults to "Outside India"
5. Prices display in selected currency immediately
6. User can change selection via dropdown
7. Selection saved to localStorage for next visit

### Returning User (Has localStorage)
1. User visits any plan page
2. System loads last selection from localStorage
3. Prices display in that currency immediately
4. User can still change selection if needed
5. New selection overwrites localStorage

---

## Static Content Updates

To avoid confusion, all hard-coded currency references were removed from:

- **Terms Page:** Now says "Pricing is shown in INR for India and USD internationally"
- **Marketplace Manage Page:** Removed `($49/month)` from upgrade banners
- **Creator Dashboard:** Removed `($49/month)` from upgrade banners

**Reason:** Prices are dynamic, so static text should not reference specific amounts.

---

## Technical Implementation Details

### Files Modified

1. **`frontend/react-app/src/lib/planPriceBook.ts`** (NEW)
   - Centralized price book
   - `formatMonthlyPrice()` helper function

2. **`frontend/react-app/src/pages/OnboardingPlanPage.tsx`**
   - Added price book import
   - Updated default billing country logic (locale/timezone fallback)
   - Replaced hard-coded `$49/mo`, `$149/mo`, `$499/mo` with `formatMonthlyPrice()`

3. **`frontend/react-app/src/pages/setup/SetupPlanPage.tsx`**
   - Added price book import
   - Updated default billing country logic
   - Replaced `plan.price` with dynamic price calculation

4. **`frontend/react-app/src/pages/PricingPage.tsx`**
   - Added price book import
   - Updated default billing country logic
   - Fixed mismatch: `$99` → `$149`, `$199` → `$499`
   - Updated comparison table to use price book

5. **`frontend/react-app/src/pages/SettingsPage.tsx`**
   - Added price book import
   - Updated default billing country logic
   - Replaced button labels: `Pro ($49/mo)` → `Pro ({formatMonthlyPrice(...)})`

6. **`frontend/react-app/src/pages/TermsPage.tsx`**
   - Made currency-neutral: removed specific USD amounts

7. **`frontend/react-app/src/pages/MarketplaceManagePage.tsx`**
   - Removed hard-coded `($49/month)` from upgrade banner

8. **`frontend/react-app/src/pages/CreatorDashboardPage.tsx`**
   - Removed hard-coded `($49/month)` from upgrade banner

---

## Best Practices Followed

✅ **No Location Guessing:** User explicitly selects billing country  
✅ **Smart Defaults:** Multiple fallback hints (localStorage → phone → locale → timezone)  
✅ **Persistence:** Selection saved in localStorage for better UX  
✅ **Consistency:** Single source of truth (price book) for all prices  
✅ **Currency-Neutral Static Text:** No hard-coded currency in help text  
✅ **Immediate Feedback:** Prices update instantly when country changes  
✅ **Standard Approach:** Matches how major websites handle currency selection  

---

## Future Enhancements (Optional)

1. **Server-Driven Price Book:** Backend endpoint that returns prices (eliminates frontend/backend drift)
2. **IP-Based Suggestion:** Soft hint from user's IP geolocation (not used for routing, only suggestion)
3. **Currency Conversion:** Show approximate conversion when user switches countries
4. **Multi-Currency Support:** Support more countries/currencies beyond INR and USD

---

## Summary

The application now follows industry-standard practices for currency display:

- **User chooses billing country** → Prices display in that currency
- **Smart defaults** → Pre-filled based on multiple hints
- **Persistent selection** → Remembered across sessions
- **Consistent pricing** → Single source of truth (price book)
- **Gateway routing** → Based on explicit user choice, not guesswork

This ensures users always see prices in the currency they expect, and the payment gateway matches their selection.

