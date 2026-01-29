# Integration Tests

This directory contains integration tests for critical user flows.

## Test Files

- `auth.test.ts` - Authentication flow (signup, login, OTP verification)
- `payment.test.ts` - Payment flow (Stripe integration, payment splits)
- `api-smoke.test.ts` - API health checks and basic endpoint tests

## Running Tests

```bash
# Set test environment variables
export TEST_API_URL=http://localhost:3000
export STRIPE_SECRET_KEY=sk_test_...

# Run all integration tests
npm test -- tests/integration

# Run specific test file
npm test -- tests/integration/auth.test.ts
```

## Test Requirements

1. **Backend server must be running** on the TEST_API_URL
2. **Database must be accessible** (test database recommended)
3. **Stripe test keys** for payment tests
4. **Email service** should be mocked or use test mode

## Notes

- These tests make real HTTP requests to the API
- They require the backend to be running
- Use test database to avoid polluting production data
- Some tests may be skipped if required services aren't configured

