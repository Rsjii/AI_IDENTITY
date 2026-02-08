// Stripe Connect removed - stub functions for backward compatibility
// These functions are not used in runtime (Stripe Connect disabled)

export async function getOrCreateConnectAccount(_userId: string): Promise<never> {
  throw new Error('Stripe Connect has been removed. Use RazorpayX or LemonSqueezy for payouts instead.');
}

export async function createConnectOnboardingLink(
  _userId: string,
  _returnUrl: string,
  _refreshUrl: string
): Promise<never> {
  throw new Error('Stripe Connect has been removed.');
}

export async function getConnectAccountStatus(_userId: string): Promise<null> {
  return null;
}
