import { logger } from '../config/logger';

/**
 * Cost Calculator Service
 * Calculates LLM API costs based on tokens and model used
 */

interface ModelPricing {
  input: number;  // Cost per token for input
  output: number; // Cost per token for output
}

// Groq pricing (free tier - no cost)
const GROQ_PRICING: ModelPricing = {
  input: 0,
  output: 0,
};

// OpenAI pricing (as of 2024, update as needed)
const OPENAI_PRICING: Record<string, ModelPricing> = {
  'gpt-4o': {
    input: 0.0025 / 1000,  // $0.0025 per 1K input tokens
    output: 0.01 / 1000,    // $0.01 per 1K output tokens
  },
  'gpt-4o-mini': {
    input: 0.00015 / 1000, // $0.00015 per 1K input tokens
    output: 0.0006 / 1000,  // $0.0006 per 1K output tokens
  },
  'gpt-4': {
    input: 0.03 / 1000,     // $0.03 per 1K input tokens
    output: 0.06 / 1000,    // $0.06 per 1K output tokens
  },
  'gpt-3.5-turbo': {
    input: 0.0005 / 1000,  // $0.0005 per 1K input tokens
    output: 0.0015 / 1000,  // $0.0015 per 1K output tokens
  },
};

/**
 * Calculate cost in USD based on tokens and model
 * @param tokensIn - Input tokens used
 * @param tokensOut - Output tokens generated
 * @param model - Model name (e.g., 'groq-llama-3.1-70b', 'gpt-4o')
 * @returns Cost in USD (decimal)
 */
export function calculateCost(
  tokensIn: number,
  tokensOut: number,
  model: string
): number {
  try {
    // Determine pricing based on model name
    let pricing: ModelPricing;
    
    if (!model || model.toLowerCase().includes('groq')) {
      // Groq models are free
      pricing = GROQ_PRICING;
    } else {
      // Try to find OpenAI pricing
      const modelKey = Object.keys(OPENAI_PRICING).find(key => 
        model.toLowerCase().includes(key.toLowerCase())
      );
      pricing = modelKey 
        ? OPENAI_PRICING[modelKey]
        : OPENAI_PRICING['gpt-4o-mini']; // Default to cheapest
    }
    
    const inputCost = tokensIn * pricing.input;
    const outputCost = tokensOut * pricing.output;
    const totalCost = inputCost + outputCost;
    
    // Round to 6 decimal places for precision
    return Math.round(totalCost * 1000000) / 1000000;
  } catch (error) {
    logger.error('Cost calculation error:', error);
    // Return 0 on error (fail-safe)
    return 0;
  }
}

/**
 * Convert USD cost to cents (for database storage)
 * @param costUsd - Cost in USD
 * @returns Cost in cents (integer)
 */
export function costToCents(costUsd: number): number {
  return Math.round(costUsd * 100);
}

/**
 * Convert cents to USD (for display)
 * @param costCents - Cost in cents
 * @returns Cost in USD
 */
export function centsToUsd(costCents: number): number {
  return costCents / 100;
}

/**
 * Get model pricing info (for display/debugging)
 */
export function getModelPricing(model: string): ModelPricing {
  if (!model || model.toLowerCase().includes('groq')) {
    return GROQ_PRICING;
  }
  
  const modelKey = Object.keys(OPENAI_PRICING).find(key => 
    model.toLowerCase().includes(key.toLowerCase())
  );
  
  return modelKey 
    ? OPENAI_PRICING[modelKey]
    : OPENAI_PRICING['gpt-4o-mini'];
}



















