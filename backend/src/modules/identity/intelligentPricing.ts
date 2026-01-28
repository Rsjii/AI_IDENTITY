/**
 * Intelligent pricing detection for pay-per-chat
 * Determines if a message requires payment based on content analysis
 */

export interface PricingDecision {
  requiresPayment: boolean;
  tier: 'basic' | 'premium' | 'vip' | null;
  reason?: string;
}

export function shouldRequirePayment(
  message: string,
  conversationContext: string[],
  identityConfig?: any
): PricingDecision {
  const lowerMessage = message.toLowerCase();

  // ✅ Keywords that indicate paid-tier questions
  const premiumKeywords = [
    'create', 'build', 'design', 'plan', 'strategy', 'review', 'analyze',
    'custom', 'personalized', 'detailed', 'step-by-step', 'guide',
    'help me', 'can you make', 'can you create', 'can you build',
  ];

  const vipKeywords = [
    'consulting', 'audit', 'full', 'complete', 'comprehensive',
    '1-on-1', 'coaching', 'mentorship', 'personalized plan',
    'detailed analysis', 'full review',
  ];

  // Check message length (longer = more complex)
  const wordCount = message.split(/\s+/).length;
  const charCount = message.length;

  // Check if it's a follow-up question (conversation context)
  const isFollowUp = conversationContext.length > 2;
  const isDeepConversation = conversationContext.length > 5;

  // Decision logic
  if (vipKeywords.some(kw => lowerMessage.includes(kw))) {
    return { 
      requiresPayment: true, 
      tier: 'vip',
      reason: 'VIP keyword detected'
    }; // $25-50
  }

  if (premiumKeywords.some(kw => lowerMessage.includes(kw)) || wordCount > 30) {
    return { 
      requiresPayment: true, 
      tier: 'premium',
      reason: 'Premium keyword or long message detected'
    }; // $10-25
  }

  // Basic questions with context depth check
  if (wordCount > 50 || (isFollowUp && isDeepConversation)) {
    return { 
      requiresPayment: true, 
      tier: 'basic',
      reason: 'Complex question or deep conversation'
    }; // $5
  }

  // Check for question patterns that indicate detailed requests
  const detailedPatterns = [
    /how do i (.{20,})/i,
    /can you help me (.{20,})/i,
    /what should i do (.{20,})/i,
    /create a (.{15,})/i,
    /build a (.{15,})/i,
    /design a (.{15,})/i,
  ];

  if (detailedPatterns.some(pattern => pattern.test(message))) {
    return { 
      requiresPayment: true, 
      tier: 'premium',
      reason: 'Detailed request pattern detected'
    };
  }

  return { requiresPayment: false, tier: null };
}

/**
 * Generate preview reply before payment
 */
export async function generatePreviewReply(
  userId: string,
  message: string
): Promise<string> {
  // This would call the identity service with limited tokens
  // For now, return a placeholder
  return "I'd be happy to help you with that! This requires a detailed response. Click below to unlock the full answer.";
}

