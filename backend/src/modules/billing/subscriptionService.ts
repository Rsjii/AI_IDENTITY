// Stripe removed - this file is stubbed out for backward compatibility
// These functions are not used in runtime (Stripe has been replaced with Razorpay/LemonSqueezy)

export async function upgradePlan(
  _userId: string,
  _newPlan: 'starter' | 'growth' | 'scale'
): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
  return { success: false, error: 'Stripe subscription management is disabled. Use Razorpay (India) or LemonSqueezy (International) instead.' };
}

export async function downgradePlan(
  _userId: string,
  _newPlan: 'starter' | 'growth' | 'free'
): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Stripe subscription management is disabled.' };
}

export async function cancelSubscription(
  _userId: string,
  _gracePeriodDays?: number
): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Stripe subscription management is disabled.' };
}
