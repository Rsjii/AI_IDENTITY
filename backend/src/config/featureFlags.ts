/**
 * Feature Flags Configuration
 * Controls functionality based on environment and validation mode
 */

import { isDev } from './env';

export interface FeatureFlags {
  VALIDATION_MODE: boolean;
  ENABLE_AI_GENERATION: boolean;
  ENABLE_PUBLIC_PROFILES: boolean;
  ENABLE_INVITES: boolean;
  ENABLE_ANALYTICS: boolean;
  ENABLE_RATE_LIMITING: boolean;
  ENABLE_CONTENT_FILTERING: boolean;
  ENABLE_EMAIL_NOTIFICATIONS: boolean;
  ENABLE_PAYMENTS: boolean; // ✅ Payment integration flag

  // ✅ Token-based pricing system
  ENABLE_TOKEN_SYSTEM: boolean;

  // Phase 2/3 feature toggles (integrations + revenue modules)
  ENABLE_WIDGET: boolean;
  ENABLE_PAY_PER_CHAT: boolean;
  ENABLE_MARKETPLACE: boolean;
  ENABLE_VOICE: boolean;
  ENABLE_VIDEO: boolean;
  ENABLE_PHONE: boolean;
  ENABLE_WHATSAPP: boolean;
  ENABLE_INSTAGRAM: boolean;
  DEBUG_MODE: boolean;
}

/**
 * Helper function to read env flags with explicit true/false support
 * - Returns true if env var is explicitly 'true'
 * - Returns false if env var is explicitly 'false'
 * - Returns defaultValue if env var is undefined or empty
 */
function envFlag(name: string, defaultValue: boolean): boolean {
  const v = process.env[name];
  if (v === 'true') return true;
  if (v === 'false') return false;
  return defaultValue;
}

/**
 * Get feature flags based on environment variables
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    // Core validation mode - when true, everything is approve-only
    VALIDATION_MODE: envFlag('VALIDATION_MODE', isDev),
    
    // AI functionality
    ENABLE_AI_GENERATION: envFlag('ENABLE_AI_GENERATION', true),
    
    // Public features
    ENABLE_PUBLIC_PROFILES: envFlag('ENABLE_PUBLIC_PROFILES', true),
    ENABLE_INVITES: envFlag('ENABLE_INVITES', true),
    
    // Analytics and tracking
    ENABLE_ANALYTICS: envFlag('ENABLE_ANALYTICS', true),
    
    // Security features
    ENABLE_RATE_LIMITING: envFlag('ENABLE_RATE_LIMITING', true),
    ENABLE_CONTENT_FILTERING: envFlag('ENABLE_CONTENT_FILTERING', true),
    
    // Notifications
    ENABLE_EMAIL_NOTIFICATIONS: envFlag('ENABLE_EMAIL_NOTIFICATIONS', true),
    
    // Payments (Phase 1: subscription only, disabled by default)
    ENABLE_PAYMENTS: envFlag('ENABLE_PAYMENTS', false),

    // ✅ Token-based pricing system (disabled by default)
    ENABLE_TOKEN_SYSTEM: envFlag('ENABLE_TOKEN_SYSTEM', false),

    // Phase 1 features (ON by default for Phase 1)
    ENABLE_WIDGET: envFlag('ENABLE_WIDGET', true),

    // Phase 2/3 feature modules (OFF by default, opt-in via env=true)
    ENABLE_PAY_PER_CHAT: envFlag('ENABLE_PAY_PER_CHAT', false),
    ENABLE_MARKETPLACE: envFlag('ENABLE_MARKETPLACE', false),
    ENABLE_VOICE: envFlag('ENABLE_VOICE', false),
    ENABLE_VIDEO: envFlag('ENABLE_VIDEO', false),
    ENABLE_PHONE: envFlag('ENABLE_PHONE', false),
    ENABLE_WHATSAPP: envFlag('ENABLE_WHATSAPP', false),
    ENABLE_INSTAGRAM: envFlag('ENABLE_INSTAGRAM', false),
    
    // Debug mode
    DEBUG_MODE: envFlag('DEBUG_MODE', isDev),
  };
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  const flags = getFeatureFlags();
  return flags[feature];
}

/**
 * Middleware to check feature flags
 */
export function requireFeature(feature: keyof FeatureFlags) {
  return (req: any, res: any, next: any) => {
    if (!isFeatureEnabled(feature)) {
      return res.status(503).json({
        error: 'Feature not available',
        feature,
        message: 'This feature is currently disabled'
      });
    }
    next();
  };
}

/**
 * Get validation mode specific settings
 */
export function getValidationSettings() {
  const flags = getFeatureFlags();
  
  return {
    // In validation mode, all AI content must be approved
    requireApproval: flags.VALIDATION_MODE,
    
    // Rate limits are stricter in validation mode
    strictRateLimiting: flags.VALIDATION_MODE,
    
    // All public content must be watermarked
    requireWatermarks: flags.VALIDATION_MODE,
    
    // Enhanced logging in validation mode
    enhancedLogging: flags.VALIDATION_MODE,
    
    // Debug information available
    showDebugInfo: flags.DEBUG_MODE,
  };
}

/**
 * Log feature flag usage for analytics
 */
export function logFeatureUsage(feature: keyof FeatureFlags, userId?: string) {
  if (isFeatureEnabled('ENABLE_ANALYTICS')) {
    // This would integrate with your event logger
    // Feature usage logging can be added here if needed
  }
}

// Export the current feature flags
export const featureFlags = getFeatureFlags();
export const validationSettings = getValidationSettings();


/**
 * Global Feature Flags - Control V2 features from environment variables
 * 
 * Usage:
 * - Set env vars to 'true' to enable features
 * - Default: all false (MVP mode)
 */
export const FEATURE_FLAGS = {
  advancedLearningUI: process.env['ENABLE_ADVANCED_LEARNING_UI'] === 'true',
  memoryUI: process.env['ENABLE_MEMORY_UI'] === 'true',
  styleAnchorsUI: process.env['ENABLE_STYLE_ANCHORS_UI'] === 'true',
  chatFeedbackUI: process.env['ENABLE_CHAT_FEEDBACK_UI'] === 'true',
  advancedPublicAnalyticsUI: process.env['ENABLE_ADV_PUBLIC_ANALYTICS'] === 'true',
  aiToolsUI: process.env['ENABLE_AI_TOOLS_UI'] === 'true', // ✅ MVP: AI Edit page (V2 feature)
};