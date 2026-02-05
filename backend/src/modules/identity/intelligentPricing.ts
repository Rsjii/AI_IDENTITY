/**
 * B3: Enhanced Intelligent Pricing Detection for Pay-Per-Chat
 * Uses AI-based intent classification + keyword matching + context awareness
 */

import { logger } from '../../config/logger';

export interface PricingDecision {
  requiresPayment: boolean;
  tier: 'basic' | 'premium' | 'vip' | null;
  reason?: string;
  confidence: number; // 0-1 scale
  suggestedPrice?: number; // in cents
}

export interface CreatorPriceConfig {
  enabled: boolean;
  basicPrice?: number; // cents
  premiumPrice?: number; // cents
  vipPrice?: number; // cents
  keywords?: string[];
  minLength?: number;
  alwaysRequire?: boolean;
  freeMessageLimit?: number;
}

// Intent categories for classification
type IntentCategory = 'simple' | 'informational' | 'advisory' | 'creative' | 'consulting';

interface IntentClassification {
  category: IntentCategory;
  confidence: number;
  requiresExpertise: boolean;
  estimatedEffort: 'low' | 'medium' | 'high';
}

/**
 * AI-based intent classification using pattern analysis
 * Classifies the complexity and type of request
 */
function classifyIntent(message: string): IntentClassification {
  const lowerMessage = message.toLowerCase();
  const wordCount = message.split(/\s+/).length;
  const questionMarks = (message.match(/\?/g) || []).length;

  // Simple greetings and basic queries
  const simplePatterns = [
    /^(hi|hello|hey|thanks|thank you|ok|okay|got it|sure|yes|no|maybe)/i,
    /^(what is|what's|who is|who's|when is|where is) .{1,30}$/i,
    /^(how are you|nice to meet|good (morning|afternoon|evening))/i,
  ];

  // Informational queries (lookup-style)
  const informationalPatterns = [
    /what (is|are|was|were) .{10,}/i,
    /how (does|do|did) .{5,} work/i,
    /explain .{5,}/i,
    /tell me about .{5,}/i,
    /define .{3,}/i,
  ];

  // Advisory/recommendation queries
  const advisoryPatterns = [
    /should i .{10,}/i,
    /what do you (think|recommend|suggest)/i,
    /is it (worth|good|better|best) .{5,}/i,
    /advice (on|for|about)/i,
    /recommend(ation)?/i,
    /opinion (on|about)/i,
  ];

  // Creative/generation requests
  const creativePatterns = [
    /create (a|an|me|my) .{5,}/i,
    /write (a|an|me|my) .{5,}/i,
    /design (a|an|me|my) .{5,}/i,
    /build (a|an|me|my) .{5,}/i,
    /make (a|an|me|my) .{5,}/i,
    /generate (a|an|me|my) .{5,}/i,
    /draft (a|an|me|my) .{5,}/i,
  ];

  // Consulting-level requests (deep analysis, personalized plans)
  const consultingPatterns = [
    /review (my|our|the) .{10,}/i,
    /analyze (my|our|the) .{10,}/i,
    /audit (my|our|the) .{5,}/i,
    /assess (my|our|the) .{5,}/i,
    /personalized .{5,} plan/i,
    /custom(ized)? .{5,} (strategy|plan|program|roadmap)/i,
    /step.?by.?step .{5,}/i,
    /detailed .{5,} (plan|guide|analysis|breakdown)/i,
    /comprehensive .{5,}/i,
    /complete .{5,} (review|analysis|guide)/i,
    /coaching|mentoring|consulting/i,
    /1.?on.?1|one.?on.?one/i,
  ];

  // Score each category
  let scores: Record<IntentCategory, number> = {
    simple: 0,
    informational: 0,
    advisory: 0,
    creative: 0,
    consulting: 0,
  };

  // Check patterns
  if (simplePatterns.some(p => p.test(message))) scores.simple += 3;
  if (informationalPatterns.some(p => p.test(message))) scores.informational += 2;
  if (advisoryPatterns.some(p => p.test(message))) scores.advisory += 2;
  if (creativePatterns.some(p => p.test(message))) scores.creative += 3;
  if (consultingPatterns.some(p => p.test(message))) scores.consulting += 4;

  // Adjust by message length
  if (wordCount < 5) scores.simple += 2;
  else if (wordCount < 15) scores.informational += 1;
  else if (wordCount < 30) scores.advisory += 1;
  else if (wordCount < 50) scores.creative += 1;
  else scores.consulting += 2;

  // Multiple questions = more complex
  if (questionMarks > 1) {
    scores.advisory += 1;
    scores.consulting += 1;
  }

  // Find highest scoring category
  const entries = Object.entries(scores) as [IntentCategory, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const [topCategory, topScore] = entries[0];
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

  // Calculate confidence
  const confidence = totalScore > 0 ? topScore / totalScore : 0.5;

  // Determine effort level
  let estimatedEffort: 'low' | 'medium' | 'high' = 'low';
  if (topCategory === 'consulting') estimatedEffort = 'high';
  else if (topCategory === 'creative' || topCategory === 'advisory') estimatedEffort = 'medium';

  // Requires expertise check
  const requiresExpertise = ['advisory', 'creative', 'consulting'].includes(topCategory);

  return {
    category: topCategory,
    confidence: Math.min(confidence, 1),
    requiresExpertise,
    estimatedEffort,
  };
}

/**
 * Check if follow-up question in context changes pricing
 */
function analyzeConversationContext(
  message: string,
  conversationContext: string[]
): { isFollowUp: boolean; contextDepth: number; shouldUpgrade: boolean } {
  const contextLength = conversationContext.length;
  const isFollowUp = contextLength > 0;

  // Check if this is deepening an existing topic
  let shouldUpgrade = false;
  if (contextLength >= 3) {
    // After 3+ messages, user is going deeper - might need premium
    const recentMessages = conversationContext.slice(-3).join(' ').toLowerCase();
    const currentLower = message.toLowerCase();

    // If asking for more detail on same topic
    const moreDetailPatterns = [
      /more detail/i, /explain more/i, /go deeper/i, /expand on/i,
      /can you elaborate/i, /tell me more/i, /what about/i,
    ];
    if (moreDetailPatterns.some(p => p.test(message))) {
      shouldUpgrade = true;
    }
  }

  return {
    isFollowUp,
    contextDepth: contextLength,
    shouldUpgrade,
  };
}

/**
 * Main pricing decision function
 * Uses AI classification + keyword matching + context analysis
 */
export function shouldRequirePayment(
  message: string,
  conversationContext: string[],
  identityConfig?: any,
  creatorPriceConfig?: CreatorPriceConfig,
  sessionMessageCount: number = 0
): PricingDecision {
  const lowerMessage = message.toLowerCase();
  const wordCount = message.split(/\s+/).length;

  // Default config
  const config: CreatorPriceConfig = {
    enabled: true,
    basicPrice: 500, // $5
    premiumPrice: 1500, // $15
    vipPrice: 5000, // $50
    freeMessageLimit: 3,
    ...creatorPriceConfig,
  };

  // If payments disabled, always free
  if (!config.enabled) {
    return { requiresPayment: false, tier: null, confidence: 1 };
  }

  // If always require payment (after free limit)
  if (config.alwaysRequire && sessionMessageCount >= (config.freeMessageLimit || 3)) {
    return {
      requiresPayment: true,
      tier: 'basic',
      confidence: 1,
      reason: 'Free message limit reached',
      suggestedPrice: config.basicPrice,
    };
  }

  // Check creator-defined keywords
  if (config.keywords && config.keywords.length > 0) {
    const matchedKeyword = config.keywords.find(kw =>
      lowerMessage.includes(kw.toLowerCase())
    );
    if (matchedKeyword) {
      return {
        requiresPayment: true,
        tier: 'premium',
        confidence: 0.9,
        reason: `Keyword match: "${matchedKeyword}"`,
        suggestedPrice: config.premiumPrice,
      };
    }
  }

  // Check minimum length trigger
  if (config.minLength && config.minLength > 0 && message.length >= config.minLength) {
    return {
      requiresPayment: true,
      tier: 'basic',
      confidence: 0.7,
      reason: `Message length (${message.length}) exceeds threshold (${config.minLength})`,
      suggestedPrice: config.basicPrice,
    };
  }

  // AI-based intent classification
  const intent = classifyIntent(message);

  // Context analysis
  const context = analyzeConversationContext(message, conversationContext);

  // Decision matrix based on intent category
  let decision: PricingDecision = { requiresPayment: false, tier: null, confidence: 0.5 };

  switch (intent.category) {
    case 'simple':
      // Simple messages are free
      decision = {
        requiresPayment: false,
        tier: null,
        confidence: intent.confidence,
        reason: 'Simple query - free tier'
      };
      break;

    case 'informational':
      // Informational is usually free, unless very deep conversation
      if (context.contextDepth > 5 && context.shouldUpgrade) {
        decision = {
          requiresPayment: true,
          tier: 'basic',
          confidence: 0.6,
          reason: 'Deep informational conversation',
          suggestedPrice: config.basicPrice,
        };
      } else {
        decision = {
          requiresPayment: false,
          tier: null,
          confidence: intent.confidence,
          reason: 'Informational query - free tier'
        };
      }
      break;

    case 'advisory':
      // Advisory requests often need premium
      if (intent.confidence > 0.6 || wordCount > 25) {
        decision = {
          requiresPayment: true,
          tier: 'premium',
          confidence: intent.confidence,
          reason: 'Advisory/recommendation request',
          suggestedPrice: config.premiumPrice,
        };
      } else {
        decision = {
          requiresPayment: true,
          tier: 'basic',
          confidence: intent.confidence,
          reason: 'Light advisory request',
          suggestedPrice: config.basicPrice,
        };
      }
      break;

    case 'creative':
      // Creative requests are premium
      decision = {
        requiresPayment: true,
        tier: 'premium',
        confidence: intent.confidence,
        reason: 'Creative/generation request',
        suggestedPrice: config.premiumPrice,
      };
      break;

    case 'consulting':
      // Consulting is VIP tier
      decision = {
        requiresPayment: true,
        tier: 'vip',
        confidence: intent.confidence,
        reason: 'Consulting/deep analysis request',
        suggestedPrice: config.vipPrice,
      };
      break;
  }

  // Upgrade tier if context suggests deeper engagement
  if (decision.requiresPayment && context.shouldUpgrade && decision.tier !== 'vip') {
    if (decision.tier === 'basic') {
      decision.tier = 'premium';
      decision.suggestedPrice = config.premiumPrice;
    } else if (decision.tier === 'premium') {
      decision.tier = 'vip';
      decision.suggestedPrice = config.vipPrice;
    }
    decision.reason += ' (upgraded due to conversation depth)';
  }

  logger.debug('[Intelligent Pricing] Decision:', {
    message: message.substring(0, 50) + '...',
    intent,
    context: { ...context, messages: conversationContext.length },
    decision,
  });

  return decision;
}

/**
 * Get price for a tier from config
 */
export function getPriceForTier(
  tier: 'basic' | 'premium' | 'vip',
  creatorPriceConfig?: CreatorPriceConfig
): number {
  const defaults = {
    basic: 500,
    premium: 1500,
    vip: 5000,
  };

  if (!creatorPriceConfig) return defaults[tier];

  switch (tier) {
    case 'basic': return creatorPriceConfig.basicPrice || defaults.basic;
    case 'premium': return creatorPriceConfig.premiumPrice || defaults.premium;
    case 'vip': return creatorPriceConfig.vipPrice || defaults.vip;
  }
}

/**
 * Generate preview/teaser for paid content
 */
export function generateTeaserPrompt(tier: 'basic' | 'premium' | 'vip'): string {
  const teasers = {
    basic: "I'd be happy to help! This is a detailed question that requires a thoughtful response. Unlock the full answer below.",
    premium: "Great question! I can provide you with a comprehensive, personalized answer. This includes step-by-step guidance tailored to your situation.",
    vip: "This is exactly the kind of deep, consulting-level question I love to answer! I'll provide you with a complete analysis, action plan, and expert recommendations.",
  };
  return teasers[tier];
}
















