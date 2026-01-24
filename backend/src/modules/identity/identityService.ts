import { llmClient } from '../../services/llmClient';
import { logger } from '../../config/logger';
import {
  identityQueries,
  identityVersionQueries,
  mirrorRunQueries,
  trustEventQueries,
} from '../../config/database';
import { TOKEN_QUOTAS } from '../../config/constants';

/**
 * Compute decision (reply/ignore/defer/clarify) from identity + message
 */
export function computeDecision(identityJson: any, incomingMessage: string): { action: 'reply' | 'ignore' | 'defer' | 'clarify'; reason: string } {
  const text = (incomingMessage || '').toLowerCase().trim();

  // Check ignore policy
  if (identityJson?.decisionPolicy?.ignoreIf && Array.isArray(identityJson.decisionPolicy.ignoreIf)) {
    const shouldIgnore = identityJson.decisionPolicy.ignoreIf.some((condition: string) => 
      text.includes(String(condition).toLowerCase())
    );
    if (shouldIgnore) {
      return { action: 'ignore', reason: 'Matches ignore policy.' };
    }
  }

  // Check defer policy
  if (identityJson?.decisionPolicy?.deferIf && Array.isArray(identityJson.decisionPolicy.deferIf)) {
    const shouldDefer = identityJson.decisionPolicy.deferIf.some((condition: string) => 
      text.includes(String(condition).toLowerCase())
    );
    if (shouldDefer) {
      return { action: 'defer', reason: 'Matches defer policy.' };
    }
  }

  // Check if message is too short
  if (text.length < 8) {
    return { action: 'clarify', reason: 'Message is too short; ask for context.' };
  }

  // Default: reply
  return { action: 'reply', reason: 'Default action.' };
}

/**
 * Build system prompt from identity JSON
 * This is the core of the identity engine
 */
export function buildIdentityPrompt(identityJson: any): string {
  const {
    displayName = 'User',
    primaryUse = 'founder',
    defaults = {},
    hardRules = {},
    boundaries = {},
    decisionPolicy = {},
    styleAnchors = {},
  } = identityJson;

  const parts: string[] = [];

  // Core identity
  parts.push(`You are acting as ${displayName}, a ${primaryUse}.`);
  parts.push(`Your role: ${primaryUse}`);

  // Defaults
  if (defaults.language) parts.push(`Language: ${defaults.language}`);
  if (defaults.formality) parts.push(`Formality: ${defaults.formality}`);
  if (defaults.directness) parts.push(`Directness: ${defaults.directness}`);
  if (defaults.emoji) parts.push(`Emoji usage: ${defaults.emoji}`);
  if (defaults.length) parts.push(`Reply length: ${defaults.length}`);
  if (defaults.ctaStyle) parts.push(`CTA style: ${defaults.ctaStyle}`);

  // Hard rules (ALWAYS)
  if (hardRules.always && hardRules.always.length > 0) {
    parts.push('\nALWAYS follow these rules:');
    hardRules.always.forEach((rule: string) => {
      parts.push(`- ${rule}`);
    });
  }

  // Hard rules (NEVER)
  if (hardRules.never && hardRules.never.length > 0) {
    parts.push('\nNEVER do these:');
    hardRules.never.forEach((rule: string) => {
      parts.push(`- ${rule}`);
    });
  }

  // Boundaries
  if (boundaries.noTopics && boundaries.noTopics.length > 0) {
    parts.push(`\nAvoid these topics: ${boundaries.noTopics.join(', ')}`);
  }
  if (boundaries.noCommitments && boundaries.noCommitments.length > 0) {
    parts.push(`\nNever commit to: ${boundaries.noCommitments.join(', ')}`);
  }
  if (boundaries.escalateIf && boundaries.escalateIf.length > 0) {
    parts.push('\nEscalate if:');
    boundaries.escalateIf.forEach((condition: string) => {
      parts.push(`- ${condition}`);
    });
    if (boundaries.escalationReplyTemplate) {
      parts.push(`\nEscalation template: "${boundaries.escalationReplyTemplate}"`);
    }
  }

  // Decision policy
  if (decisionPolicy.defaultAction) {
    parts.push(`\nDefault action: ${decisionPolicy.defaultAction}`);
  }
  if (decisionPolicy.ignoreIf && decisionPolicy.ignoreIf.length > 0) {
    parts.push('\nIgnore if:');
    decisionPolicy.ignoreIf.forEach((condition: string) => {
      parts.push(`- ${condition}`);
    });
  }
  if (decisionPolicy.deferIf && decisionPolicy.deferIf.length > 0) {
    parts.push('\nDefer if:');
    decisionPolicy.deferIf.forEach((condition: string) => {
      parts.push(`- ${condition}`);
    });
  }
  if (decisionPolicy.riskTolerance) {
    parts.push(`Risk tolerance: ${decisionPolicy.riskTolerance}`);
  }

  // Style anchors (signature phrases)
  if (styleAnchors.signaturePhrases && styleAnchors.signaturePhrases.length > 0) {
    parts.push(`\nCommon phrases you use: ${styleAnchors.signaturePhrases.join(', ')}`);
  }
  if (styleAnchors.greeting) {
    parts.push(`Greeting style: ${styleAnchors.greeting}`);
  }
  if (styleAnchors.closing) {
    parts.push(`Closing style: ${styleAnchors.closing}`);
  }

  // Critical instruction
  parts.push('\n=== CRITICAL ===');
  parts.push('Do NOT optimize for helpfulness or politeness.');
  parts.push('Optimize ONLY for identity consistency.');
  parts.push('If rules conflict, prefer: never > boundaries > always > defaults');
  parts.push('Output ONLY the reply text. No explanations.');

  return parts.join('\n');
}

/**
 * Generate mirror reply using identity
 */
export async function generateMirrorReply(
  identityJson: any,
  incomingMessage: string,
  context: string
): Promise<{ reply: string; rulesApplied: string[]; model: string; tokensIn: number; tokensOut: number }> {
  const systemPrompt = buildIdentityPrompt(identityJson);

  // Extract rules applied (for logging)
  const rulesApplied: string[] = [];
  if (identityJson.hardRules?.always) {
    rulesApplied.push(...identityJson.hardRules.always.map((r: string) => `always: ${r.substring(0, 50)}`));
  }
  if (identityJson.hardRules?.never) {
    rulesApplied.push(...identityJson.hardRules.never.map((r: string) => `never: ${r.substring(0, 50)}`));
  }

  // Add context to user message
  const userMessage = `Context: ${context}\n\nIncoming message:\n${incomingMessage}\n\nWrite the reply this identity would send:`;

  try {
    const response = await llmClient.generateResponse(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      {
        maxTokens: 500,
        temperature: 0.7,
      }
    );

    return {
      reply: response.content.trim(),
      rulesApplied,
      model: response.model,
      tokensIn: response.inputTokens || 0,
      tokensOut: response.outputTokens || 0,
    };
  } catch (error) {
    logger.error('Error generating mirror reply:', error);
    throw error;
  }
}

/**
 * Create identity + v1 version
 */
export async function createIdentity(userId: string, identityJson: any) {
  // Check if identity already exists
  const existing = await identityQueries.findByUserId(userId);
  if (existing) {
    throw new Error('Identity already exists. Use update to modify.');
  }

  // Create identity
  const identity = await identityQueries.create(userId);

  // Create v1
  const version = await identityVersionQueries.create(identity.id, 'v1', identityJson);

  // Activate v1
  await identityVersionQueries.updateStatus(version.id, 'active');
  await identityQueries.updateActiveVersion(identity.id, version.id);

  logger.info(`Identity created for user ${userId}`);

  return {
    identity,
    version,
  };
}

/**
 * Get identity by user ID with active version
 */
export async function getIdentityByUserId(userId: string) {
  const identity = await identityQueries.findByUserId(userId);
  if (!identity) {
    return null;
  }

  // Get active version
  let activeVersion = null;
  if (identity.activeVersionId) {
    activeVersion = await identityVersionQueries.findById(identity.activeVersionId);
    if (activeVersion && typeof activeVersion.identityJson === 'string') {
      activeVersion.identityJson = JSON.parse(activeVersion.identityJson);
    }
  }

  return {
    identity,
    activeVersion,
  };
}

/**
 * Update identity version JSON
 */
export async function updateIdentityVersion(
  versionId: string,
  userId: string,
  identityJson: any
) {
  // Verify version exists
  const version = await identityVersionQueries.findById(versionId);
  if (!version) {
    throw new Error('Identity version not found');
  }

  // Verify version belongs to user
  const identity = await identityQueries.findById(version.identityId);
  if (!identity || identity.userId !== userId) {
    throw new Error('Access denied');
  }

  // Update
  await identityVersionQueries.updateIdentityJson(versionId, identityJson);

  logger.info(`Identity version ${versionId} updated`);

  return { success: true };
}

/**
 * Generate mirror reply (with full flow)
 */
export async function generateMirrorReplyWithLogging(
  userId: string,
  context: string,
  incomingMessage: string
) {
  // Get identity
  const identity = await identityQueries.findByUserId(userId);
  if (!identity || !identity.activeVersionId) {
    throw new Error('Identity not found. Please create your identity first.');
  }

  // Get active version
  const version = await identityVersionQueries.findById(identity.activeVersionId);
  if (!version) {
    throw new Error('Active identity version not found');
  }

  // Parse identity JSON
  let identityJson: any;
  if (typeof version.identityJson === 'string') {
    identityJson = JSON.parse(version.identityJson);
  } else {
    identityJson = version.identityJson;
  }

  // Check daily token quota before generating reply
  const usedTokens = await mirrorRunQueries.sumTokensForUserSince(
    userId,
    new Date(Date.now() - 24 * 60 * 60 * 1000)
  );

  if (usedTokens >= TOKEN_QUOTAS.USER_DAILY_TOKENS) {
    throw new Error('Daily token quota exceeded. Try again tomorrow.');
  }

  // Generate reply
  const startTime = Date.now();
  const { reply, rulesApplied, model, tokensIn, tokensOut } = await generateMirrorReply(identityJson, incomingMessage, context);
  const latencyMs = Date.now() - startTime;

  // Save mirror run with actual token usage
  const mirrorRun = await mirrorRunQueries.create(
    version.id,
    context,
    incomingMessage,
    reply,
    rulesApplied,
    model,
    tokensIn,
    tokensOut,
  );

  logger.info(`Mirror run created: ${mirrorRun.id}`);

  // Compute decision
  const decision = computeDecision(identityJson, incomingMessage);

  return {
    decision,
    reply,
    rulesApplied,
    mirrorRunId: mirrorRun.id,
  };
}

/**
 * Log trust confirmation
 */
export async function logTrustEvent(
  userId: string,
  mirrorRunId: string,
  event: 'confirm_yes' | 'confirm_no' | 'edit_rule' | 'regenerate',
  note?: string
) {
  // Verify mirror run exists
  const mirrorRun = await mirrorRunQueries.findById(mirrorRunId);
  if (!mirrorRun) {
    throw new Error('Mirror run not found');
  }

  // Verify version belongs to user
  const version = await identityVersionQueries.findById(mirrorRun.identityVersionId);
  if (!version) {
    throw new Error('Identity version not found');
  }

  const identity = await identityQueries.findById(version.identityId);
  if (!identity || identity.userId !== userId) {
    throw new Error('Access denied');
  }

  // Create trust event
  await trustEventQueries.create(mirrorRunId, version.id, event, note);

  logger.info(`Trust event logged: ${event} for mirror run ${mirrorRunId}`);

  return { success: true };
}

