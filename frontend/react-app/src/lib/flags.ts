/**
 * Frontend Feature Flags
 * Controls UI visibility based on VITE_ENABLE_* environment variables
 * 
 * Phase 1 defaults:
 * - ENABLE_WIDGET: true (Phase 1 feature)
 * - ENABLE_PAYMENTS: true (subscription only)
 * - Everything else: false (Phase 2/3 features)
 */

export const FLAGS = {
  widget: import.meta.env.VITE_ENABLE_WIDGET === 'true',
  payPerChat: import.meta.env.VITE_ENABLE_PAY_PER_CHAT === 'true',
  voice: import.meta.env.VITE_ENABLE_VOICE === 'true',
  marketplace: import.meta.env.VITE_ENABLE_MARKETPLACE === 'true',
  video: import.meta.env.VITE_ENABLE_VIDEO === 'true',
  phone: import.meta.env.VITE_ENABLE_PHONE === 'true',
  whatsapp: import.meta.env.VITE_ENABLE_WHATSAPP === 'true',
  instagram: import.meta.env.VITE_ENABLE_INSTAGRAM === 'true',
  
  // ✅ Phase-1: Integrations page is required for WEBSITE embed generator
  integrationsPage: import.meta.env.VITE_ENABLE_WIDGET === 'true',
};

