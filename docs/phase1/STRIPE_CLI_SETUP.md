# Stripe CLI Setup Guide

## Overview

The Stripe CLI is required to test Stripe webhooks locally during development. This guide explains how to install and use it.

## Installation

### Windows (PowerShell)

```powershell
# Option 1: Using Scoop (recommended)
scoop install stripe

# Option 2: Using Chocolatey
choco install stripe

# Option 3: Manual installation
# Download from: https://github.com/stripe/stripe-cli/releases/latest
# Extract and add to PATH
```

### macOS

```bash
# Using Homebrew (recommended)
brew install stripe/stripe-cli/stripe

# Or download from: https://github.com/stripe/stripe-cli/releases/latest
```

### Linux

```bash
# Download and install
wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_*_linux_x86_64.tar.gz
tar -xvf stripe_*_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

## Authentication

1. **Login to Stripe CLI:**
   ```bash
   stripe login
   ```
   This will open your browser to authenticate with your Stripe account.

2. **Verify installation:**
   ```bash
   stripe --version
   ```

## Testing Webhooks Locally

### Start the Backend Server

Make sure your backend is running on `localhost:3000`:
```bash
cd backend
npm run dev
```

### Forward Webhooks to Local Server

In a separate terminal, run:
```bash
stripe listen --forward-to localhost:3000/api/billing/stripe/webhook
```

This will:
- Forward all webhook events from your Stripe account to your local server
- Display the webhook signing secret (needed for testing)
- Show all webhook events in real-time

### Get Webhook Signing Secret

After running `stripe listen`, you'll see output like:
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

**Important:** Add this secret to your `.env` file:
```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### Test Specific Events

You can trigger test events:
```bash
# Test payment succeeded
stripe trigger payment_intent.succeeded

# Test subscription created
stripe trigger customer.subscription.created

# Test invoice payment failed
stripe trigger invoice.payment_failed
```

## Production Webhooks

For production, configure webhooks in the Stripe Dashboard:
1. Go to: https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://yourdomain.com/api/billing/stripe/webhook`
3. Select events to listen for
4. Copy the webhook signing secret to your production environment variables

## Troubleshooting

### "stripe: command not found"

**Windows:**
- Make sure Stripe CLI is installed and added to PATH
- Restart PowerShell/terminal after installation
- Try using full path: `C:\path\to\stripe.exe listen ...`

**Alternative (using npx):**
```bash
npx stripe-cli listen --forward-to localhost:3000/api/billing/stripe/webhook
```

### Connection Refused

- Ensure backend server is running on port 3000
- Check firewall settings
- Verify the webhook endpoint path: `/api/billing/stripe/webhook`

### Webhook Secret Not Working

- Make sure you're using the secret from `stripe listen` output
- Restart backend server after updating `.env`
- Check that `STRIPE_WEBHOOK_SECRET` is set correctly in your environment

## Additional Resources

- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Webhook Testing Guide](https://stripe.com/docs/webhooks/test)
- [Webhook Best Practices](https://stripe.com/docs/webhooks/best-practices)

